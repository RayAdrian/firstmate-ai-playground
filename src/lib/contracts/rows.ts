import { z } from "zod";
import { newsTagSchema, scoringStatusSchema } from "./news";
import { toolVersionsSchema } from "./lesson";

// guid (not uuid): zod v4 uuid() enforces RFC variant bits and rejects hand-written fixture ids.
const uuid = z.guid();
const ts = z.string();
const date = z.string();

export const levelRowSchema = z.object({
  id: uuid,
  number: z.number().int(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  sort: z.number().int(),
  archived_at: ts.nullable(),
});
export type LevelRow = z.infer<typeof levelRowSchema>;

export const lessonRowSchema = z
  .object({
  id: uuid,
  level_id: uuid,
  slug: z.string(),
  sort: z.number().int(),
  title: z.string(),
  objective: z.string(),
  est_minutes: z.number().int(),
  concept_md: z.string(),
  claude_md: z.string().nullable(),
  codex_md: z.string().nullable(),
  claude_no_equivalent: z.boolean(),
  codex_no_equivalent: z.boolean(),
  claude_workaround_md: z.string().min(1).nullable(),
  codex_workaround_md: z.string().min(1).nullable(),
  differences: z.array(z.string()),
  tool_versions: toolVersionsSchema.partial(),
  last_verified_on: date.nullable(),
  content_hash: z.string(),
  archived_at: ts.nullable(),
  updated_at: ts,
})
  .refine((l) => !l.claude_no_equivalent || l.claude_workaround_md !== null, {
    path: ["claude_workaround_md"],
    message: "claude_workaround_md is required when claude_no_equivalent is true",
  })
  .refine((l) => !l.codex_no_equivalent || l.codex_workaround_md !== null, {
    path: ["codex_workaround_md"],
    message: "codex_workaround_md is required when codex_no_equivalent is true",
  });
export type LessonRow = z.infer<typeof lessonRowSchema>;

export const exerciseRowSchema = z.object({
  id: uuid,
  lesson_id: uuid,
  slug: z.string(),
  title: z.string(),
  goal: z.string(),
  repo_path: z.string(),
  setup_cmd: z.string(),
  verify_cmd: z.string().nullable(),
  starter_prompts: z.object({ claude: z.string(), codex: z.string() }).partial(),
  checklist: z.array(z.object({ id: z.string(), text: z.string() })),
  solution_notes: z.array(z.string()),
  archived_at: ts.nullable(),
});
export type ExerciseRow = z.infer<typeof exerciseRowSchema>;

export const newsSourceRowSchema = z.object({
  id: uuid,
  slug: z.string(),
  name: z.string(),
  url: z.string(),
  type: z.enum(["rss", "atom", "html"]),
  enabled: z.boolean(),
  filters: z.record(z.string(), z.unknown()),
});
export type NewsSourceRow = z.infer<typeof newsSourceRowSchema>;

export const newsItemRowSchema = z.object({
  id: uuid,
  source_id: uuid,
  guid: z.string().nullable(),
  canonical_url: z.string(),
  url: z.string(),
  title: z.string(),
  author: z.string().nullable(),
  published_at: ts.nullable(),
  first_seen_at: ts,
  digest_date: date,
  excerpt: z.string().nullable(),
  score: z.number().int().nullable(),
  tags: z.array(newsTagSchema),
  why_it_matters: z.string().nullable(),
  scoring_status: scoringStatusSchema,
  attempts: z.number().int(),
  scored_at: ts.nullable(),
  scorer_model: z.string().nullable(),
});
export type NewsItemRow = z.infer<typeof newsItemRowSchema>;

export const ingestRunRowSchema = z.object({
  id: uuid,
  started_at: ts,
  finished_at: ts.nullable(),
  trigger: z.enum(["schedule", "manual"]),
  status: z.enum(["success", "partial", "failed"]),
  fetched: z.number().int(),
  new: z.number().int(),
  scored: z.number().int(),
  pending: z.number().int(),
  failed: z.number().int(),
  skipped: z.number().int(),
  error_summary: z.string().nullable(),
});
export type IngestRunRow = z.infer<typeof ingestRunRowSchema>;
