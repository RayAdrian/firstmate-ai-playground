import { z } from "zod";

export const NEWS_TAGS = ["new-model", "tooling", "framework", "security", "business"] as const;
export const newsTagSchema = z.enum(NEWS_TAGS);
export type NewsTag = z.infer<typeof newsTagSchema>;

export const SCORING_STATUSES = ["pending", "scored", "failed", "skipped"] as const;
export const scoringStatusSchema = z.enum(SCORING_STATUSES);
export type ScoringStatus = z.infer<typeof scoringStatusSchema>;

/** One scored item returned by `claude -p` (PRD I-3). */
export const scoredItemSchema = z.object({
  id: z.string().min(1),
  score: z.number().int().min(0).max(100),
  tags: z.array(newsTagSchema),
  why: z.string().min(1).max(280),
});
export type ScoredItem = z.infer<typeof scoredItemSchema>;

/** The whole batch output: an array of scored items. Validate per item so valid ones can be kept (I-4). */
export const scoringOutputSchema = z.array(scoredItemSchema);
export type ScoringOutput = z.infer<typeof scoringOutputSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoTimestamp = z.string().datetime({ offset: true });

/** Item in a snapshot file, content/news/snapshots/<digest_date>.json (PRD section 14, Q1). Upsert key: canonical_url. */
export const snapshotItemSchema = z.object({
  source_slug: z.string().min(1),
  guid: z.string().nullable(),
  canonical_url: z.string().url(),
  url: z.string().url(),
  title: z.string().min(1),
  author: z.string().nullable(),
  published_at: isoTimestamp.nullable(),
  first_seen_at: isoTimestamp,
  digest_date: isoDate,
  excerpt: z.string().nullable(),
  score: z.number().int().min(0).max(100).nullable(),
  tags: z.array(newsTagSchema),
  why_it_matters: z.string().nullable(),
  scoring_status: scoringStatusSchema,
  attempts: z.number().int().nonnegative(),
  scored_at: isoTimestamp.nullable(),
  scorer_model: z.string().nullable(),
});
export type SnapshotItem = z.infer<typeof snapshotItemSchema>;

export const snapshotRunSchema = z.object({
  started_at: isoTimestamp,
  finished_at: isoTimestamp.nullable(),
  trigger: z.enum(["schedule", "manual"]),
  status: z.enum(["success", "partial", "failed"]),
  fetched: z.number().int().nonnegative(),
  new: z.number().int().nonnegative(),
  scored: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  error_summary: z.string().nullable(),
});
export type SnapshotRun = z.infer<typeof snapshotRunSchema>;

export const SNAPSHOT_VERSION = 1;

export const newsSnapshotSchema = z.object({
  version: z.literal(SNAPSHOT_VERSION),
  digest_date: isoDate,
  exported_at: isoTimestamp,
  run: snapshotRunSchema.nullable(),
  items: z.array(snapshotItemSchema),
});
export type NewsSnapshot = z.infer<typeof newsSnapshotSchema>;
