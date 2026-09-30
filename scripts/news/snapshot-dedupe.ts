import type { SnapshotItem } from "@/lib/contracts";

/** Deterministic preference: a scored row beats an unscored one, then the newest first_seen_at, then digest_date, then id. */
function better(a: SnapshotItem, b: SnapshotItem): boolean {
  const scoredA = a.scoring_status === "scored";
  const scoredB = b.scoring_status === "scored";
  if (scoredA !== scoredB) return scoredA;
  if (a.first_seen_at !== b.first_seen_at) return a.first_seen_at > b.first_seen_at;
  if (a.digest_date !== b.digest_date) return a.digest_date > b.digest_date;
  return a.id > b.id;
}

export interface Deduped {
  items: SnapshotItem[];
  /** One warning per dropped duplicate: which id was mapped onto which. */
  warnings: string[];
}

/**
 * Snapshots are per digest date, so after the publisher's DB was reset the same canonical_url can sit under two
 * ids in two files. Collapse to one item per canonical_url (and per id) before writing so one bad pair can never
 * block the whole import.
 */
export function dedupeSnapshotItems(items: readonly SnapshotItem[]): Deduped {
  const warnings: string[] = [];
  const byUrl = new Map<string, SnapshotItem>();
  for (const item of items) {
    const cur = byUrl.get(item.canonical_url);
    if (!cur) {
      byUrl.set(item.canonical_url, item);
    } else if (cur.id === item.id) {
      if (better(item, cur)) byUrl.set(item.canonical_url, item);
    } else if (better(item, cur)) {
      warnings.push(`snapshot duplicate: id ${cur.id} mapped to ${item.id} (${item.canonical_url})`);
      byUrl.set(item.canonical_url, item);
    } else {
      warnings.push(`snapshot duplicate: id ${item.id} mapped to ${cur.id} (${item.canonical_url})`);
    }
  }
  // The same id under two different urls: keep the preferred one.
  const byId = new Map<string, SnapshotItem>();
  for (const item of byUrl.values()) {
    const cur = byId.get(item.id);
    if (!cur || better(item, cur)) {
      if (cur) warnings.push(`snapshot duplicate id ${item.id}: dropped ${cur.canonical_url}`);
      byId.set(item.id, item);
    } else {
      warnings.push(`snapshot duplicate id ${item.id}: dropped ${item.canonical_url}`);
    }
  }
  return { items: [...byId.values()], warnings };
}
