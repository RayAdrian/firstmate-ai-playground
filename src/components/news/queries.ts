import "server-only";
import type { IngestRunRow, NewsItemRow, NewsSourceRow } from "@/lib/contracts";
import { dbRead } from "@/lib/db";
import { getReadClient } from "@/lib/db/server";
import { ARCHIVE_PAGE_SIZE, type ArchiveParams } from "./archive-params";
import { manilaDate } from "@/lib/time/now";
import { compareRanked, DIGEST_SIZE, RELEVANCE_BAR, selectDigest } from "./rank";

/** What a news card needs. `url` is null when the stored URL is not http(s): the title then renders as text. */
export type NewsCardItem = {
  id: string;
  title: string;
  url: string | null;
  sourceName: string;
  publishedAt: string | null;
  score: number | null;
  tags: NewsItemRow["tags"];
  why: string | null;
  status: NewsItemRow["scoring_status"];
};

/** Feed content is untrusted: only http(s) URLs become links. */
export function safeHttpUrl(value: string): string | null {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

export function toCardItem(row: NewsItemRow, sourceNames: ReadonlyMap<string, string>): NewsCardItem {
  return {
    id: row.id,
    title: row.title,
    url: safeHttpUrl(row.url),
    sourceName: sourceNames.get(row.source_id) ?? "Unknown source",
    publishedAt: row.published_at,
    score: row.score,
    tags: row.tags,
    why: row.why_it_matters,
    status: row.scoring_status,
  };
}

async function loadSources(): Promise<NewsSourceRow[]> {
  const db = getReadClient();
  return dbRead(db.from("news_sources").select("*").order("name", { ascending: true }));
}

export type Digest =
  | { kind: "none" }
  | {
      kind: "digest";
      /** yyyy-MM-dd (Manila) the digest belongs to. */
      digestDate: string;
      /** finished_at of the run (falls back to started_at), for "updated 08:03". */
      updatedAt: string;
      stale: boolean;
      ranked: NewsCardItem[];
      /** Every scored item of the day, best first (the "All" view of /news). Optional so test doubles can omit it. */
      scoredAll?: NewsCardItem[];
      /** How many scored items the digest date had, ranked or not. */
      scoredCount: number;
      unscored: NewsCardItem[];
    };

/**
 * The latest digest as of `now`: the newest success/partial run that started by now, and the items
 * whose digest_date is that run's Manila date. A later failed run never replaces it (N-1.1).
 */
export async function getDigest(
  now: Date,
  opts: { limit?: number; withUnscored?: boolean; date?: string } = {},
): Promise<Digest> {
  const limit = opts.limit ?? DIGEST_SIZE;
  const db = getReadClient();
  let runQuery = db
    .from("ingest_runs")
    .select("*")
    .in("status", ["success", "partial"])
    .lte("started_at", now.toISOString());
  if (opts.date) {
    // A specific Manila day: runs that started within it (Manila has no DST, so a day is 24h).
    const start = new Date(`${opts.date}T00:00:00+08:00`);
    runQuery = runQuery
      .gte("started_at", start.toISOString())
      .lt("started_at", new Date(start.getTime() + 86_400_000).toISOString());
  }
  const runs: IngestRunRow[] = await dbRead(runQuery.order("started_at", { ascending: false }).limit(1));
  const run = runs[0];
  if (!run) return { kind: "none" };

  const digestDate = manilaDate(new Date(run.started_at));
  const [sources, rows] = await Promise.all([
    loadSources(),
    dbRead(db.from("news_items").select("*").eq("digest_date", digestDate)),
  ]);
  const names = new Map(sources.map((s) => [s.id, s.name]));
  const items: NewsItemRow[] = rows;

  const ranked = selectDigest(items, limit).map((r) => toCardItem(r, names));
  const scoredAll = items
    .filter((i) => i.scoring_status === "scored" && i.score !== null)
    .sort(compareRanked)
    .map((r) => toCardItem(r, names));
  const scoredCount = items.filter((i) => i.scoring_status === "scored").length;
  const unscored = opts.withUnscored
    ? items
        .filter((i) => i.scoring_status === "pending" || i.scoring_status === "failed")
        .sort((a, b) => compareRanked({ ...a, score: null }, { ...b, score: null }))
        .map((r) => toCardItem(r, names))
    : [];

  return {
    kind: "digest",
    digestDate,
    updatedAt: run.finished_at ?? run.started_at,
    stale: !opts.date && digestDate !== manilaDate(now),
    ranked,
    scoredAll,
    scoredCount,
    unscored,
  };
}

/** Every Manila day that has a digest (a success/partial run that started by `now`), newest first. */
export async function getDigestDates(now: Date): Promise<string[]> {
  const db = getReadClient();
  const runs: Pick<IngestRunRow, "started_at">[] = await dbRead(
    db
      .from("ingest_runs")
      .select("started_at")
      .in("status", ["success", "partial"])
      .lte("started_at", now.toISOString())
      .order("started_at", { ascending: false })
      .limit(1000),
  );
  return [...new Set(runs.map((r) => manilaDate(new Date(r.started_at))))];
}

export { RELEVANCE_BAR };

export type ArchivePage = {
  items: NewsCardItem[];
  total: number;
  page: number;
  pageCount: number;
};

export type ArchiveData = { sources: { slug: string; name: string }[]; result: ArchivePage };

/** Filtered, paginated archive (N-4.1). Newest published first; tags match any (OR). */
export async function getArchive(p: ArchiveParams): Promise<ArchiveData> {
  const db = getReadClient();
  const sources = await loadSources();
  const names = new Map(sources.map((s) => [s.id, s.name]));
  const sourceList = sources.map((s) => ({ slug: s.slug, name: s.name }));
  const empty: ArchiveData = {
    sources: sourceList,
    result: { items: [], total: 0, page: p.page, pageCount: 0 },
  };

  let sourceId: string | null = null;
  if (p.source) {
    sourceId = sources.find((s) => s.slug === p.source)?.id ?? null;
    if (sourceId === null) return empty;
  }

  const build = () => {
    let q = db.from("news_items").select("*", { count: "exact" });
    if (p.tags.length > 0) q = q.overlaps("tags", p.tags);
    if (p.min > 0) q = q.gte("score", p.min);
    if (sourceId) q = q.eq("source_id", sourceId);
    if (p.from) q = q.gte("digest_date", p.from);
    if (p.to) q = q.lte("digest_date", p.to);
    return q
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true });
  };

  let count: number | null = null;
  const fetchRange = async (from: number, to: number): Promise<NewsItemRow[]> =>
    dbRead(
      build()
        .range(from, to)
        .then((res) => {
          count = res.count;
          return res;
        }),
    );

  // A page past the end makes PostgREST answer 416, so probe the total first for page > 1.
  if (p.page > 1) {
    await fetchRange(0, 0);
    const total = count ?? 0;
    if ((p.page - 1) * ARCHIVE_PAGE_SIZE >= total) {
      return { sources: sourceList, result: { items: [], total, page: p.page, pageCount: Math.ceil(total / ARCHIVE_PAGE_SIZE) } };
    }
  }
  const offset = (p.page - 1) * ARCHIVE_PAGE_SIZE;
  const rows = await fetchRange(offset, offset + ARCHIVE_PAGE_SIZE - 1);
  const total: number = count ?? rows.length;
  return {
    sources: sourceList,
    result: {
      items: rows.map((r) => toCardItem(r, names)),
      total,
      page: p.page,
      pageCount: Math.ceil(total / ARCHIVE_PAGE_SIZE),
    },
  };
}
