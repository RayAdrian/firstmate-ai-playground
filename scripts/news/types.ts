import type { NewsTag, SnapshotItem, SnapshotRun } from "@/lib/contracts";
import type { Candidate } from "./normalize";
import type { SourceConfig } from "./sources";

export const MAX_ATTEMPTS = 3;
export const MAX_SCORED_PER_RUN = 80;
export const BATCH_SIZE = 10;

/** A news_items row as the pipeline needs it. */
export interface StoredItem {
  id: string;
  source_slug: string;
  canonical_url: string;
  url: string;
  title: string;
  excerpt: string | null;
  published_at: string | null;
  first_seen_at: string;
  digest_date: string;
  attempts: number;
}

export type InsertStatus = "pending" | "skipped";
export type NewItemRecord = Candidate & { scoring_status: InsertStatus };

export interface ScoredUpdate {
  score: number;
  tags: NewsTag[];
  why: string;
  model: string;
  at: string;
}

export interface RunFinish {
  finished_at: string;
  status: "success" | "partial" | "failed";
  fetched: number;
  new: number;
  scored: number;
  pending: number;
  failed: number;
  skipped: number;
  error_summary: string | null;
}

export interface ImportResult {
  itemsInserted: number;
  itemsUpdated: number;
  runsUpserted: number;
}

/** Everything the pipeline needs from the database. Implemented over Supabase and in memory (tests). */
export interface NewsStore {
  upsertSources(sources: readonly SourceConfig[]): Promise<void>;
  /** Canonical urls that already exist (used by --dry-run). */
  existingCanonicals(urls: readonly string[]): Promise<Set<string>>;
  /** Insert-only: rows whose canonical_url or (source, guid) already exist are ignored. Returns only the rows inserted. */
  insertCandidates(rows: readonly NewItemRecord[]): Promise<StoredItem[]>;
  /** Pending items with attempts < MAX_ATTEMPTS, oldest first_seen_at first. */
  listScorable(limit: number): Promise<StoredItem[]>;
  markScored(id: string, update: ScoredUpdate): Promise<void>;
  markUnscored(id: string, attempts: number, status: "pending" | "failed"): Promise<void>;
  /** Close runs left open by a crashed process. Returns how many. */
  closeOpenRuns(at: string): Promise<number>;
  startRun(run: { started_at: string; trigger: "schedule" | "manual" }): Promise<string>;
  finishRun(id: string, patch: RunFinish): Promise<void>;
  /** Statuses of the most recent finished runs, newest first. */
  recentRunStatuses(limit: number, excludeId: string): Promise<Array<"success" | "partial" | "failed">>;
  snapshotFor(digestDate: string): Promise<{ runs: SnapshotRun[]; items: SnapshotItem[] }>;
  importSnapshot(items: readonly SnapshotItem[], runs: readonly SnapshotRun[]): Promise<ImportResult>;
}

export interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}
