import { randomUUID } from "node:crypto";
import type { NewsTag, SnapshotItem, SnapshotRun } from "@/lib/contracts";
import { dedupeSnapshotItems } from "../../../../scripts/news/snapshot-dedupe";
import { digestDate } from "../../../../scripts/news/time";
import type { SourceConfig } from "../../../../scripts/news/sources";
import {
  MAX_ATTEMPTS,
  type ImportResult,
  type NewItemRecord,
  type NewsStore,
  type RunFinish,
  type ScoredUpdate,
  type StoredItem,
} from "../../../../scripts/news/types";

export interface MemItem {
  id: string;
  source_slug: string;
  guid: string | null;
  canonical_url: string;
  url: string;
  title: string;
  author: string | null;
  published_at: string | null;
  first_seen_at: string;
  digest_date: string;
  excerpt: string | null;
  score: number | null;
  tags: NewsTag[];
  why_it_matters: string | null;
  scoring_status: "pending" | "scored" | "failed" | "skipped";
  attempts: number;
  scored_at: string | null;
  scorer_model: string | null;
}

export interface MemRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  trigger: "schedule" | "manual";
  status: "success" | "partial" | "failed";
  fetched: number;
  new: number;
  scored: number;
  pending: number;
  failed: number;
  skipped: number;
  error_summary: string | null;
}

/** In-memory NewsStore with the same semantics as the Supabase one (insert-only by canonical_url and (source, guid)). */
export class MemoryStore implements NewsStore {
  items: MemItem[] = [];
  runs: MemRun[] = [];
  sources = new Set<string>();
  /** Test hook: make insertCandidates throw this on the Nth call (1-based). */
  failInsertOn: { call: number; error: Error } | null = null;
  /** Test hook: every method throws this (simulates Supabase down). */
  down: Error | null = null;
  private insertCalls = 0;

  private check() {
    if (this.down) throw this.down;
  }

  async upsertSources(sources: readonly SourceConfig[]) {
    this.check();
    for (const s of sources) this.sources.add(s.slug);
  }
  async existingCanonicals(urls: readonly string[]) {
    this.check();
    const have = new Set(this.items.map((i) => i.canonical_url));
    return new Set(urls.filter((u) => have.has(u)));
  }
  async insertCandidates(rows: readonly NewItemRecord[]): Promise<StoredItem[]> {
    this.check();
    this.insertCalls++;
    if (this.failInsertOn && this.failInsertOn.call === this.insertCalls) throw this.failInsertOn.error;
    const out: StoredItem[] = [];
    for (const r of rows) {
      if (this.items.some((i) => i.canonical_url === r.canonical_url)) continue;
      if (r.guid !== null && this.items.some((i) => i.source_slug === r.source_slug && i.guid === r.guid)) continue;
      const item: MemItem = {
        id: randomUUID(),
        source_slug: r.source_slug,
        guid: r.guid,
        canonical_url: r.canonical_url,
        url: r.url,
        title: r.title,
        author: r.author,
        published_at: r.published_at,
        first_seen_at: r.first_seen_at,
        digest_date: r.digest_date,
        excerpt: r.excerpt,
        score: null,
        tags: [],
        why_it_matters: null,
        scoring_status: r.scoring_status,
        attempts: 0,
        scored_at: null,
        scorer_model: null,
      };
      this.items.push(item);
      out.push(this.stored(item));
    }
    return out;
  }
  private stored(i: MemItem): StoredItem {
    return {
      id: i.id,
      source_slug: i.source_slug,
      canonical_url: i.canonical_url,
      url: i.url,
      title: i.title,
      excerpt: i.excerpt,
      published_at: i.published_at,
      first_seen_at: i.first_seen_at,
      digest_date: i.digest_date,
      attempts: i.attempts,
    };
  }
  async listScorable(limit: number) {
    this.check();
    return this.items
      .filter((i) => i.scoring_status === "pending" && i.attempts < MAX_ATTEMPTS)
      .sort((a, b) =>
        a.first_seen_at !== b.first_seen_at
          ? a.first_seen_at.localeCompare(b.first_seen_at)
          : a.published_at !== b.published_at
            ? (b.published_at ?? "").localeCompare(a.published_at ?? "")
            : a.id.localeCompare(b.id),
      )
      .slice(0, limit)
      .map((i) => this.stored(i));
  }
  async markScored(id: string, u: ScoredUpdate) {
    this.check();
    const i = this.items.find((x) => x.id === id);
    if (!i) throw new Error("no such item");
    Object.assign(i, { score: u.score, tags: u.tags, why_it_matters: u.why, scoring_status: "scored", scored_at: u.at, scorer_model: u.model });
  }
  async markUnscored(id: string, attempts: number, status: "pending" | "failed") {
    this.check();
    const i = this.items.find((x) => x.id === id);
    if (!i) throw new Error("no such item");
    Object.assign(i, { attempts, scoring_status: status });
  }
  async closeOpenRuns(at: string) {
    this.check();
    let n = 0;
    for (const r of this.runs) {
      if (r.finished_at === null) {
        Object.assign(r, { finished_at: at, status: "failed", error_summary: "interrupted (process ended before the run finished)" });
        n++;
      }
    }
    return n;
  }
  async startRun(run: { started_at: string; trigger: "schedule" | "manual" }) {
    this.check();
    const r: MemRun = {
      id: randomUUID(),
      started_at: run.started_at,
      finished_at: null,
      trigger: run.trigger,
      status: "failed",
      fetched: 0,
      new: 0,
      scored: 0,
      pending: 0,
      failed: 0,
      skipped: 0,
      error_summary: "in progress or interrupted",
    };
    this.runs.push(r);
    return r.id;
  }
  async finishRun(id: string, patch: RunFinish) {
    this.check();
    const r = this.runs.find((x) => x.id === id);
    if (!r) throw new Error("no such run");
    Object.assign(r, patch);
  }
  async recentRunStatuses(limit: number, excludeId: string) {
    this.check();
    return this.runs
      .filter((r) => r.id !== excludeId && r.finished_at !== null)
      .sort((a, b) => b.started_at.localeCompare(a.started_at))
      .slice(0, limit)
      .map((r) => r.status);
  }
  async snapshotFor(date: string) {
    this.check();
    const items: SnapshotItem[] = this.items
      .filter((i) => i.digest_date === date && i.scoring_status !== "skipped")
      .map((i) => ({
        id: i.id,
        source_slug: i.source_slug,
        guid: i.guid,
        canonical_url: i.canonical_url,
        url: i.url,
        title: i.title,
        author: i.author,
        published_at: i.published_at,
        first_seen_at: i.first_seen_at,
        digest_date: i.digest_date,
        excerpt: i.excerpt,
        score: i.score,
        tags: i.tags,
        why_it_matters: i.why_it_matters,
        scoring_status: i.scoring_status,
        attempts: i.attempts,
        scored_at: i.scored_at,
        scorer_model: i.scorer_model,
      }));
    const runs: SnapshotRun[] = this.runs
      .filter((r) => r.finished_at !== null && digestDate(r.started_at) === date)
      .map((r) => ({ ...r, finished_at: r.finished_at }));
    return { runs, items };
  }
  async importSnapshot(items: readonly SnapshotItem[], runs: readonly SnapshotRun[]): Promise<ImportResult> {
    this.check();
    let itemsInserted = 0;
    let itemsUpdated = 0;
    const deduped = dedupeSnapshotItems(items);
    const warnings: string[] = [...deduped.warnings];
    for (const s of deduped.items) {
      const byId = this.items.find((i) => i.id === s.id);
      const byUrl = this.items.find((i) => i.canonical_url === s.canonical_url);
      const takes = (l: MemItem) => s.scoring_status === "scored" && (l.scoring_status === "pending" || l.scoring_status === "failed");
      const score = { score: s.score, tags: s.tags, why_it_matters: s.why_it_matters, scoring_status: s.scoring_status, attempts: s.attempts, scored_at: s.scored_at, scorer_model: s.scorer_model };
      if (byId) {
        if (takes(byId)) {
          Object.assign(byId, score);
          itemsUpdated++;
        }
      } else if (byUrl) {
        warnings.push(`canonical_url conflict: local id ${byUrl.id} replaced by snapshot id ${s.id} (${s.canonical_url})`);
        byUrl.id = s.id;
        if (takes(byUrl)) Object.assign(byUrl, score);
        itemsUpdated++;
      } else {
        if (this.items.some((i) => i.canonical_url === s.canonical_url)) throw new Error("duplicate key value violates unique constraint news_items_canonical_url_key");
        this.items.push({ ...s });
        itemsInserted++;
      }
    }
    let runsUpserted = 0;
    for (const r of runs) {
      if (!this.runs.some((x) => x.id === r.id)) {
        this.runs.push({ ...r });
        runsUpserted++;
      }
    }
    return { itemsInserted, itemsUpdated, runsUpserted, warnings };
  }
}
