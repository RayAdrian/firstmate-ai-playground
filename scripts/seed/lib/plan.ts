/**
 * Write planning for tables with a UNIQUE key that archived rows keep holding
 * (levels.number, exercises.lesson_id; the frozen schema has no partial unique indexes).
 * Rows are matched by slug; a renamed row is reused in place via its key so nothing collides,
 * and unmatched rows that block a needed key are moved off it. Pure: no database access.
 */
export interface ExistingRow<K> {
  id: string;
  slug: string;
  key: K;
  archived: boolean;
}

export interface Want<K> {
  slug: string;
  key: K;
}

export interface UniquePlan<K> {
  /** Unmatched rows that must change key before anything else so a needed key is free. */
  releases: { id: string; key: K }[];
  /** Wanted rows in a collision-free write order: moves first, then unchanged, then inserts (id null). */
  matched: { want: Want<K>; id: string | null }[];
  /** Unmatched rows to archive (they keep their key unless released). */
  archive: string[];
  error?: string;
}

export function planUnique<K>(
  existing: ExistingRow<K>[],
  wanted: Want<K>[],
  opts: { reuseByKey: boolean; freeKeys?: K[] },
): UniquePlan<K> {
  const bySlug = new Map(existing.map((r) => [r.slug, r]));
  const byKey = new Map(existing.map((r) => [r.key, r]));
  const wantedSlugs = new Set(wanted.map((w) => w.slug));
  const claimed = new Set<string>();

  const matchedRaw = wanted.map((want) => {
    let found = bySlug.get(want.slug);
    if (!found && opts.reuseByKey) {
      const holder = byKey.get(want.key);
      if (holder && !wantedSlugs.has(holder.slug) && !claimed.has(holder.id)) found = holder;
    }
    if (found) claimed.add(found.id);
    return { want, row: found };
  });

  const fail = (error: string): UniquePlan<K> => ({ releases: [], matched: [], archive: [], error });
  const unmatched = existing.filter((r) => !claimed.has(r.id));
  const occupied = new Map<K, string>(existing.map((r) => [r.key, r.id]));
  const targets = new Set(wanted.map((w) => w.key));
  const unmatchedById = new Map(unmatched.map((r) => [r.id, r]));

  // Unmatched rows squatting on a key that a wanted row needs.
  const releases: { id: string; key: K }[] = [];
  for (const { want, row } of matchedRaw) {
    if (row && row.key === want.key) continue;
    const holderId = occupied.get(want.key);
    const holder = holderId ? unmatchedById.get(holderId) : undefined;
    if (!holder) continue;
    const spare = (opts.freeKeys ?? []).find((k) => !occupied.has(k) && !targets.has(k));
    if (spare === undefined) {
      return fail(`key ${String(want.key)} needed by '${want.slug}' is held by archived '${holder.slug}' and no free key is available to move it to`);
    }
    releases.push({ id: holder.id, key: spare });
    occupied.delete(want.key);
    occupied.set(spare, holder.id);
  }

  // Order the moves of matched rows so each target is free when written.
  const pending = matchedRaw.filter((m) => m.row && m.row.key !== m.want.key);
  const moves: typeof matchedRaw = [];
  while (pending.length > 0) {
    const i = pending.findIndex((m) => !occupied.has(m.want.key));
    if (i === -1) {
      const stuck = pending[0];
      const blocker = stuck ? occupied.get(stuck.want.key) : undefined;
      const blockerSlug = existing.find((r) => r.id === blocker)?.slug ?? "another row";
      return fail(`cannot re-key '${stuck?.want.slug}' to ${String(stuck?.want.key)}: held by '${blockerSlug}' (a swap or cycle cannot be applied without a spare key; do it in two steps)`);
    }
    const [m] = pending.splice(i, 1);
    if (!m?.row) continue;
    occupied.delete(m.row.key);
    occupied.set(m.want.key, m.row.id);
    moves.push(m);
  }

  const unchanged = matchedRaw.filter((m) => m.row && m.row.key === m.want.key);
  const inserts = matchedRaw.filter((m) => !m.row);
  for (const m of inserts) {
    if (occupied.has(m.want.key)) return fail(`key ${String(m.want.key)} for new '${m.want.slug}' is already held`);
  }

  return {
    releases,
    matched: [...moves, ...unchanged, ...inserts].map((m) => ({ want: m.want, id: m.row?.id ?? null })),
    archive: unmatched.filter((r) => !r.archived).map((r) => r.id),
  };
}
