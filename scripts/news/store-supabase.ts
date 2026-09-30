import type { SupabaseClient } from "@supabase/supabase-js";
import type { NewsItemRow, SnapshotItem, SnapshotRun } from "@/lib/contracts";
import type { Database } from "@/lib/db/types";
import { sanitize } from "./sanitize";
import type { SourceConfig } from "./sources";
import {
  MAX_ATTEMPTS,
  type ImportResult,
  type NewsStore,
  type RunFinish,
  type ScoredUpdate,
  type StoredItem,
} from "./types";

type Client = SupabaseClient<Database>;

const CHUNK = 200;
const ITEM_COLUMNS = "id, source_id, canonical_url, url, title, excerpt, published_at, first_seen_at, digest_date, attempts";

function chunk<T>(arr: readonly T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Split values into groups whose combined length stays under `budget` chars, so a `.in()` filter never overflows the request URL. */
function chunkByChars(values: readonly string[], budget = 2500): string[][] {
  const out: string[][] = [];
  let cur: string[] = [];
  let size = 0;
  for (const v of values) {
    const cost = encodeURIComponent(v).length + 3;
    if (cur.length > 0 && size + cost > budget) {
      out.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(v);
    size += cost;
  }
  if (cur.length > 0) out.push(cur);
  return out;
}

function fail(action: string, error: { message: string } | null): asserts error is null {
  if (error) throw new StoreError(`${action}: ${error.message}`);
}

export class StoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "StoreError";
  }
}

const iso = (v: string | null): string | null => (v === null ? null : new Date(v).toISOString());

type ItemRow = Pick<NewsItemRow, "id" | "source_id" | "canonical_url" | "url" | "title" | "excerpt" | "published_at" | "first_seen_at" | "digest_date" | "attempts">;

export function createSupabaseStore(client: Client): NewsStore {
  const slugById = new Map<string, string>();
  const idBySlug = new Map<string, string>();

  async function loadSources(): Promise<void> {
    const { data, error } = await client.from("news_sources").select("id, slug");
    fail("read news_sources", error);
    for (const s of data ?? []) {
      slugById.set(s.id, s.slug);
      idBySlug.set(s.slug, s.id);
    }
  }

  const toStored = (r: ItemRow): StoredItem => ({
    id: r.id,
    source_slug: slugById.get(r.source_id) ?? "unknown",
    canonical_url: r.canonical_url,
    url: r.url,
    title: r.title,
    excerpt: r.excerpt,
    published_at: iso(r.published_at),
    first_seen_at: new Date(r.first_seen_at).toISOString(),
    digest_date: r.digest_date,
    attempts: r.attempts,
  });

  return {
    async upsertSources(sources: readonly SourceConfig[]) {
      const { error } = await client.from("news_sources").upsert(
        sources.map((s) => ({ slug: s.slug, name: s.name, url: s.url, type: s.type, enabled: s.enabled, filters: s.filters })),
        { onConflict: "slug" },
      );
      fail("upsert news_sources", error);
      await loadSources();
    },

    async existingCanonicals(urls) {
      const found = new Set<string>();
      for (const part of chunkByChars(urls)) {
        const { data, error } = await client.from("news_items").select("canonical_url").in("canonical_url", part);
        fail("read news_items", error);
        for (const r of data ?? []) found.add(r.canonical_url);
      }
      return found;
    },

    async insertCandidates(rows) {
      if (idBySlug.size === 0) await loadSources();
      const inserted: StoredItem[] = [];
      for (const part of chunk(rows)) {
        // (source, guid) dedupe: a guid we already stored under another url is the same article.
        const guids = part.map((r) => r.guid).filter((g): g is string => g !== null);
        const knownGuid = new Set<string>();
        for (const guidPart of chunkByChars(guids)) {
          const { data, error } = await client.from("news_items").select("source_id, guid").in("guid", guidPart);
          fail("read news_items guids", error);
          for (const r of data ?? []) knownGuid.add(`${r.source_id}\u0000${r.guid}`);
        }
        const payload = part.flatMap((r) => {
          const sourceId = idBySlug.get(r.source_slug);
          if (!sourceId) return [];
          if (r.guid !== null && knownGuid.has(`${sourceId}\u0000${r.guid}`)) return [];
          return [
            {
              source_id: sourceId,
              guid: r.guid,
              canonical_url: r.canonical_url,
              url: r.url,
              title: r.title,
              author: r.author,
              published_at: r.published_at,
              first_seen_at: r.first_seen_at,
              digest_date: r.digest_date,
              excerpt: r.excerpt,
              scoring_status: r.scoring_status,
              attempts: 0,
              tags: [],
            },
          ];
        });
        if (payload.length === 0) continue;
        const { data, error } = await client
          .from("news_items")
          .upsert(payload, { onConflict: "canonical_url", ignoreDuplicates: true })
          .select(ITEM_COLUMNS);
        fail("insert news_items", error);
        for (const r of (data ?? []) as ItemRow[]) inserted.push(toStored(r));
      }
      return inserted;
    },

    async listScorable(limit) {
      if (idBySlug.size === 0) await loadSources();
      const { data, error } = await client
        .from("news_items")
        .select(ITEM_COLUMNS)
        .eq("scoring_status", "pending")
        .lt("attempts", MAX_ATTEMPTS)
        .order("first_seen_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(limit);
      fail("read pending news_items", error);
      return ((data ?? []) as ItemRow[]).map(toStored);
    },

    async markScored(id, u: ScoredUpdate) {
      const { error } = await client
        .from("news_items")
        .update({ score: u.score, tags: u.tags, why_it_matters: u.why, scoring_status: "scored", scored_at: u.at, scorer_model: u.model })
        .eq("id", id);
      fail("update news_items", error);
    },

    async markUnscored(id, attempts, status) {
      const { error } = await client.from("news_items").update({ attempts, scoring_status: status }).eq("id", id);
      fail("update news_items", error);
    },

    async closeOpenRuns(at) {
      const { data, error } = await client
        .from("ingest_runs")
        .update({ finished_at: at, status: "failed", error_summary: "interrupted (process ended before the run finished)" })
        .is("finished_at", null)
        .select("id");
      fail("close open ingest_runs", error);
      return data?.length ?? 0;
    },

    async startRun(run) {
      // Written as `failed` + open until finishRun, so a crashed run is never mistaken for a success (I-4.6).
      const { data, error } = await client
        .from("ingest_runs")
        .insert({ started_at: run.started_at, trigger: run.trigger, status: "failed", error_summary: "in progress or interrupted" })
        .select("id")
        .single();
      fail("insert ingest_runs", error);
      return data.id;
    },

    async finishRun(id, patch: RunFinish) {
      const { error } = await client.from("ingest_runs").update(patch).eq("id", id);
      fail("update ingest_runs", error);
    },

    async recentRunStatuses(limit, excludeId) {
      const { data, error } = await client
        .from("ingest_runs")
        .select("status")
        .not("finished_at", "is", null)
        .neq("id", excludeId)
        .order("started_at", { ascending: false })
        .limit(limit);
      fail("read ingest_runs", error);
      return (data ?? []).map((r) => r.status);
    },

    async snapshotFor(digestDate) {
      if (idBySlug.size === 0) await loadSources();
      const items: SnapshotItem[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await client
          .from("news_items")
          .select("*")
          .eq("digest_date", digestDate)
          .order("canonical_url", { ascending: true })
          .range(from, from + 999);
        fail("read news_items", error);
        const rows = (data ?? []) as NewsItemRow[];
        for (const r of rows) {
          items.push({
            id: r.id,
            source_slug: slugById.get(r.source_id) ?? "unknown",
            guid: r.guid,
            canonical_url: r.canonical_url,
            url: r.url,
            title: r.title,
            author: r.author,
            published_at: iso(r.published_at),
            first_seen_at: new Date(r.first_seen_at).toISOString(),
            digest_date: r.digest_date,
            excerpt: r.excerpt,
            score: r.score,
            tags: r.tags,
            why_it_matters: r.why_it_matters,
            scoring_status: r.scoring_status,
            attempts: r.attempts,
            scored_at: iso(r.scored_at),
            scorer_model: r.scorer_model,
          });
        }
        if (rows.length < 1000) break;
      }

      // Runs whose Manila date of started_at equals digest_date: [date 00:00+08:00, next day 00:00+08:00).
      const start = new Date(`${digestDate}T00:00:00+08:00`);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      const { data: runRows, error: runErr } = await client
        .from("ingest_runs")
        .select("*")
        .gte("started_at", start.toISOString())
        .lt("started_at", end.toISOString())
        .not("finished_at", "is", null)
        .order("started_at", { ascending: true });
      fail("read ingest_runs", runErr);
      const runs: SnapshotRun[] = (runRows ?? []).map((r) => ({
        id: r.id,
        started_at: new Date(r.started_at).toISOString(),
        finished_at: iso(r.finished_at),
        trigger: r.trigger,
        status: r.status,
        fetched: r.fetched,
        new: r.new,
        scored: r.scored,
        pending: r.pending,
        failed: r.failed,
        skipped: r.skipped,
        error_summary: r.error_summary === null ? null : sanitize(r.error_summary),
      }));
      return { runs, items };
    },

    async importSnapshot(items, runs): Promise<ImportResult> {
      await loadSources();
      let itemsInserted = 0;
      let itemsUpdated = 0;

      const warnings: string[] = [];
      for (const part of chunk(items, 100)) {
        type Local = { id: string; canonical_url: string; scoring_status: NewsItemRow["scoring_status"] };
        const byId = new Map<string, Local>();
        const byUrl = new Map<string, Local>();
        for (const ids of chunkByChars(part.map((i) => i.id))) {
          const { data, error } = await client.from("news_items").select("id, canonical_url, scoring_status").in("id", ids);
          fail("read news_items", error);
          for (const r of data ?? []) byId.set(r.id, r);
        }
        for (const urls of chunkByChars(part.map((i) => i.canonical_url))) {
          const { data, error } = await client.from("news_items").select("id, canonical_url, scoring_status").in("canonical_url", urls);
          fail("read news_items", error);
          for (const r of data ?? []) byUrl.set(r.canonical_url, r);
        }

        const scoring = (item: SnapshotItem) => ({
          score: item.score,
          tags: item.tags,
          why_it_matters: item.why_it_matters,
          scoring_status: "scored" as const,
          attempts: item.attempts,
          scored_at: item.scored_at,
          scorer_model: item.scorer_model,
        });
        const takesScore = (item: SnapshotItem, local: Local) =>
          item.scoring_status === "scored" && (local.scoring_status === "pending" || local.scoring_status === "failed");

        const toInsert: Array<Partial<NewsItemRow>> = [];
        const seenIds = new Set<string>();
        for (const item of part) {
          const sourceId = idBySlug.get(item.source_slug);
          if (!sourceId) throw new StoreError(`unknown source "${item.source_slug}" (not in news_sources)`);
          const local = byId.get(item.id);
          const clash = byUrl.get(item.canonical_url);
          if (local) {
            // Same id: never overwrite a scored local row; a pending/failed one takes the snapshot's score.
            if (takesScore(item, local)) {
              const { error } = await client.from("news_items").update(scoring(item)).eq("id", local.id);
              fail("update news_items", error);
              itemsUpdated++;
            }
          } else if (clash) {
            // Same canonical_url, different id: update in place to the snapshot id so ids match across machines.
            warnings.push(`canonical_url conflict: local id ${clash.id} replaced by snapshot id ${item.id} (${item.canonical_url})`);
            const patch = takesScore(item, clash) ? { id: item.id, ...scoring(item) } : { id: item.id };
            const { error } = await client.from("news_items").update(patch).eq("id", clash.id);
            fail("update news_items", error);
            itemsUpdated++;
          } else if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            toInsert.push({
              id: item.id,
              source_id: sourceId,
              guid: item.guid,
              canonical_url: item.canonical_url,
              url: item.url,
              title: item.title,
              author: item.author,
              published_at: item.published_at,
              first_seen_at: item.first_seen_at,
              digest_date: item.digest_date,
              excerpt: item.excerpt,
              score: item.score,
              tags: item.tags,
              why_it_matters: item.why_it_matters,
              scoring_status: item.scoring_status,
              attempts: item.attempts,
              scored_at: item.scored_at,
              scorer_model: item.scorer_model,
            });
          }
        }
        if (toInsert.length > 0) {
          const { data: ins, error: insErr } = await client.from("news_items").upsert(toInsert, { onConflict: "id", ignoreDuplicates: true }).select("id");
          fail("insert news_items", insErr);
          itemsInserted += ins?.length ?? 0;
        }
      }

      let runsUpserted = 0;
      for (const part of chunk(runs, 50)) {
        const { data: found, error } = await client.from("ingest_runs").select("id").in("id", part.map((r) => r.id));
        fail("read ingest_runs", error);
        const have = new Set((found ?? []).map((r) => r.id));
        const fresh = part.filter((r) => !have.has(r.id));
        if (fresh.length > 0) {
          const { error: runErr } = await client.from("ingest_runs").insert(fresh);
          fail("insert ingest_runs", runErr);
          runsUpserted += fresh.length;
        }
      }
      return { itemsInserted, itemsUpdated, runsUpserted, warnings };
    },
  };
}
