import { z } from "zod";
import { newsTagSchema, scoringStatusSchema } from "./news";
import { toolVersionsSchema } from "./lesson";
import {
  WORKFLOW_TOOLS,
  workflowPromptSchema,
  workflowSetupBlockSchema,
  workflowSetupKindSchema,
} from "./workflow";

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

/** public.workflows (PRD §16.8). No freshness or client_safe column: freshness is derived, client_safe is a merge-time property. */
export const workflowRowSchema = z.object({
  id: uuid,
  slug: z.string(),
  title: z.string(),
  problem: z.string(),
  tools: z.array(z.enum(WORKFLOW_TOOLS)).min(1),
  setup: z.array(workflowSetupBlockSchema),
  setup_kinds: z.array(workflowSetupKindSchema),
  prompt: workflowPromptSchema,
  result_before: z.string(),
  result_after: z.string(),
  steps: z.array(z.string()).min(1).max(5),
  why_md: z.string(),
  use_cases: z.array(z.string()),
  stacks: z.array(z.string()),
  related_lesson_slug: z.string().nullable(),
  level: z.number().int().min(1).max(5).nullable(),
  tool_versions: z.object({ claude_code: z.string(), codex_cli: z.string() }).partial(),
  verified_on: date,
  author_name: z.string(),
  reviewed_on: date.nullable(),
  content_hash: z.string(),
  removed_at: ts.nullable(),
  created_at: ts,
  updated_at: ts,
});
export type WorkflowRow = z.infer<typeof workflowRowSchema>;
