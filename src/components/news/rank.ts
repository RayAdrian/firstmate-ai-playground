// Ordering rules shared by the digest and its tests (PRD N-1.2).

export type Rankable = { id: string; score: number | null; published_at: string | null };

export const RELEVANCE_BAR = 60;
export const DIGEST_SIZE = 10;

const time = (iso: string | null): number => (iso === null ? Number.NEGATIVE_INFINITY : Date.parse(iso));

/** Score desc, then published_at desc (nulls last), then id asc so the order is total. */
export function compareRanked(a: Rankable, b: Rankable): number {
  const byScore = (b.score ?? -1) - (a.score ?? -1);
  if (byScore !== 0) return byScore;
  const ta = time(a.published_at);
  const tb = time(b.published_at);
  if (ta !== tb) return tb === Number.NEGATIVE_INFINITY ? -1 : ta === Number.NEGATIVE_INFINITY ? 1 : tb - ta;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Scored items at or above the bar, best first, capped. */
export function selectDigest<T extends Rankable & { scoring_status: string }>(
  items: readonly T[],
  limit: number = DIGEST_SIZE,
): T[] {
  return items
    .filter((i) => i.scoring_status === "scored" && i.score !== null && i.score >= RELEVANCE_BAR)
    .sort(compareRanked)
    .slice(0, limit);
}
