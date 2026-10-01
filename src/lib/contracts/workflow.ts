import { z } from "zod";
import { diagramSchema } from "./diagram";

/**
 * Shared workflows (PRD §16). One markdown file per workflow at content/workflows/<slug>.md.
 * This module holds the static contract: frontmatter schema, body-section types, freshness
 * thresholds and repo constants. Parsing the markdown body is W1's job (scripts/workflows/).
 */

/** Canonical repo URL. Components and scripts import this; a later org transfer is a one-line change (WF-37). */
export const REPO_URL = "https://github.com/RayAdrian/firstmate-ai-playground";
/** Issue form behind the "Report outdated" link (WF-37). */
export const WORKFLOW_OUTDATED_ISSUE_TEMPLATE = "workflow-outdated.yml";

/** Folder, config files (not workflows) and size cap (§16.6). */
export const WORKFLOWS_DIR = "content/workflows";
export const WORKFLOW_CONFIG_FILES = ["_TEMPLATE.md", "_taxonomy.yaml", "_takedowns.txt"] as const;
export const WORKFLOW_MAX_BYTES = 20 * 1024;

/** Freshness is derived from verified_on, never stored (WF-40). Ages are in days. */
export const WORKFLOW_FRESH_MAX_DAYS = 60;
export const WORKFLOW_ARCHIVED_MIN_DAYS = 181;
export type WorkflowFreshness = "fresh" | "outdated" | "archived";

export function workflowFreshness(ageDays: number): WorkflowFreshness {
  if (ageDays <= WORKFLOW_FRESH_MAX_DAYS) return "fresh";
  if (ageDays < WORKFLOW_ARCHIVED_MIN_DAYS) return "outdated";
  return "archived";
}

export const WORKFLOW_TOOLS = ["claude-code", "codex"] as const;
export type WorkflowTool = (typeof WORKFLOW_TOOLS)[number];

/** Setup block `kind=` values (§16.6). */
export const WORKFLOW_SETUP_KINDS = [
  "context-file",
  "hook",
  "skill",
  "subagent",
  "config",
  "script",
] as const;
export const workflowSetupKindSchema = z.enum(WORKFLOW_SETUP_KINDS);
export type WorkflowSetupKind = (typeof WORKFLOW_SETUP_KINDS)[number];

/** The only `##` body sections, in this order (§16.6). */
export const WORKFLOW_SECTIONS = ["Result", "Setup", "Prompt", "Steps", "Why it works"] as const;
export type WorkflowSection = (typeof WORKFLOW_SECTIONS)[number];

/** Body limits (§16.6). */
export const WORKFLOW_LIMITS = {
  resultChars: { min: 1, max: 600 },
  setupBlocks: { min: 0, max: 6 },
  steps: { min: 1, max: 5 },
  whyChars: { min: 40, max: 800 },
} as const;

/** A setup path: relative or `~/`; no `..`; never an absolute home path (§16.6). */
export const setupPathSchema = z
  .string()
  .min(1)
  .refine((p) => !p.split(/[\\/]/).includes(".."), "path may not contain ..")
  .refine((p) => !/^(\/Users\/|\/home\/|[A-Za-z]:\\)/.test(p), "path may not start with /Users/, /home/ or C:\\")
  .refine((p) => !p.startsWith("/"), "path must be relative or start with ~/");

/** One parsed Setup fence (info string `<lang> path=<path> kind=<kind> [tool=...]`). */
export const workflowSetupBlockSchema = z.object({
  lang: z.string(),
  path: setupPathSchema,
  kind: workflowSetupKindSchema,
  tool: z.enum(WORKFLOW_TOOLS).nullable(),
  code: z.string(),
});
export type WorkflowSetupBlock = z.infer<typeof workflowSetupBlockSchema>;

/** Prompt body: shared, or per-tool when the prompts differ. */
export const workflowPromptSchema = z
  .object({ shared: z.string(), claude: z.string(), codex: z.string() })
  .partial();
export type WorkflowPrompt = z.infer<typeof workflowPromptSchema>;

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const workflowSlugSchema = z
  .string()
  .max(60)
  .regex(slugRe, "expected kebab-case slug");

/** `<lesson-slug>/<media-id>`; both halves are kebab-case slugs. */
export const watchRe = /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const semver = z.string().regex(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/, "expected a semver string");

/** One sentence: no `.`, `!` or `?` followed by whitespace and more text. */
export const hasSentenceBreak = (s: string) => /[.!?]\s+\S/.test(s);

/** Values the frontmatter is checked against that the static schema cannot know. All optional. */
export interface WorkflowValidationContext {
  /** `use_cases` from _taxonomy.yaml. */
  useCases?: readonly string[];
  /** `stacks` from _taxonomy.yaml. */
  stacks?: readonly string[];
  /** Slugs of non-archived lessons in content/lessons/. */
  lessonSlugs?: readonly string[];
  /** `<lesson-slug>/<media-id>` of every valid media manifest on a non-archived lesson (§17.3), for `watch`. */
  mediaIds?: readonly string[];
  /** Today's Manila date (YYYY-MM-DD); verified_on may not be later. */
  today?: string;
}

/**
 * Frontmatter of content/workflows/<slug>.md (§16.6). Build it with the taxonomy, lesson slugs and
 * today's Manila date so `workflows:validate` and `npm run seed` share one parse (WF-2).
 * Checks whose context value is omitted are skipped.
 */
export function buildWorkflowFrontmatterSchema(ctx: WorkflowValidationContext = {}) {
  return z
    .object({
      title: z.string().min(8).max(80),
      problem: z
        .string()
        .min(20)
        .max(200)
        .refine((s) => !hasSentenceBreak(s), "must be one sentence"),
      tools: z.array(z.enum(WORKFLOW_TOOLS)).min(1),
      use_cases: z.array(z.string()).min(1).max(3),
      stacks: z.array(z.string()).min(1).max(4),
      related_lesson: z.string().regex(slugRe, "expected a lesson slug").optional(),
      tool_versions: z
        .object({ claude_code: semver, codex_cli: semver })
        .partial()
        .strict(),
      verified_on: isoDate,
      /** Optional diagram (§17.3). A fenced `diagram` block in the body is invalid (checked by W1/G1 on the body). */
      diagram: diagramSchema.optional(),
      /** Optional `<lesson-slug>/<media-id>` link to existing lesson media (§17.3). Never derived from related_lesson. */
      watch: z.string().regex(watchRe, "expected <lesson-slug>/<media-id>").optional(),
      client_safe: z.literal("confirmed", { error: "must be exactly `confirmed`" }),
      /** Forbidden: attribution comes from git (§16.8). */
      author: z
        .never({ error: "author comes from git; remove this field" })
        .optional(),
    })
    .superRefine((fm, c) => {
      if (new Set(fm.tools).size !== fm.tools.length) {
        c.addIssue({ code: "custom", path: ["tools"], message: "tools must be unique" });
      }
      const dup = (v: string[]) => new Set(v).size !== v.length;
      if (dup(fm.use_cases)) c.addIssue({ code: "custom", path: ["use_cases"], message: "values must be unique" });
      if (dup(fm.stacks)) c.addIssue({ code: "custom", path: ["stacks"], message: "values must be unique" });
      if (ctx.useCases) {
        for (const u of fm.use_cases) {
          if (!ctx.useCases.includes(u)) {
            c.addIssue({ code: "custom", path: ["use_cases"], message: `unknown use case "${u}"` });
          }
        }
      }
      if (ctx.stacks) {
        for (const s of fm.stacks) {
          if (!ctx.stacks.includes(s)) {
            c.addIssue({ code: "custom", path: ["stacks"], message: `unknown stack "${s}"` });
          }
        }
      }
      if (fm.stacks.includes("any") && fm.stacks.length > 1) {
        c.addIssue({ code: "custom", path: ["stacks"], message: "`any` must be the only stack" });
      }
      if (fm.related_lesson !== undefined && ctx.lessonSlugs && !ctx.lessonSlugs.includes(fm.related_lesson)) {
        c.addIssue({
          code: "custom",
          path: ["related_lesson"],
          message: `lesson "${fm.related_lesson}" does not exist or is archived`,
        });
      }
      const needed: Record<WorkflowTool, "claude_code" | "codex_cli"> = {
        "claude-code": "claude_code",
        codex: "codex_cli",
      };
      for (const tool of WORKFLOW_TOOLS) {
        const key = needed[tool];
        const has = fm.tool_versions[key] !== undefined;
        if (fm.tools.includes(tool) && !has) {
          c.addIssue({ code: "custom", path: ["tool_versions", key], message: `required because tools includes ${tool}` });
        }
        if (!fm.tools.includes(tool) && has) {
          c.addIssue({ code: "custom", path: ["tool_versions", key], message: `not allowed because tools does not include ${tool}` });
        }
      }
      if (fm.watch !== undefined && ctx.mediaIds && watchRe.test(fm.watch) && !ctx.mediaIds.includes(fm.watch)) {
        c.addIssue({
          code: "custom",
          path: ["watch"],
          message: `"${fm.watch}" matches no valid media manifest on an existing lesson`,
        });
      }
      if (ctx.today && fm.verified_on > ctx.today) {
        c.addIssue({ code: "custom", path: ["verified_on"], message: `is in the future (today is ${ctx.today})` });
      }
    });
}

/** Static rules only (no taxonomy, lesson or date context). */
export const workflowFrontmatterSchema = buildWorkflowFrontmatterSchema();
export type WorkflowFrontmatter = z.infer<typeof workflowFrontmatterSchema>;
