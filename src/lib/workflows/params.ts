// Pure parsing and serialising of the /workflows URL state (PRD WF-31). Bad input degrades to "no filter".
import type { WorkflowTool } from "@/lib/contracts";

export type RawSearchParams = Record<string, string | string[] | undefined>;

export type WorkflowParams = {
  /** `claude` or `codex` (the lesson tool param); null = any. */
  tool: "claude" | "codex" | null;
  use: string[];
  /** Level of the related lesson, 1-5. */
  level: number | null;
  stack: string[];
  q: string;
  /** Lesson slug, set only by the lesson row's "See all" link. */
  lesson: string;
  archived: boolean;
};

export const EMPTY_PARAMS: WorkflowParams = {
  tool: null,
  use: [],
  level: null,
  stack: [],
  q: "",
  lesson: "",
  archived: false,
};

export const MAX_QUERY_LENGTH = 100;
const FACET = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LESSON_SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;

export const TOOL_PARAM_TO_WORKFLOW_TOOL: Record<"claude" | "codex", WorkflowTool> = {
  claude: "claude-code",
  codex: "codex",
};

function all(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function first(value: string | string[] | undefined): string {
  return all(value)[0] ?? "";
}

/** Keep values that are in `known`, deduplicated, in the order of `known`. Unknown values are ignored. */
function pickKnown(values: string[], known: readonly string[]): string[] {
  const wanted = new Set(values.filter((v) => FACET.test(v)));
  return known.filter((k) => wanted.has(k));
}

export function parseWorkflowParams(
  raw: RawSearchParams,
  known: { useCases: readonly string[]; stacks: readonly string[] },
): WorkflowParams {
  const toolRaw = first(raw.tool);
  const tool = toolRaw === "claude" || toolRaw === "codex" ? toolRaw : null;

  const levelRaw = first(raw.level);
  const level = /^[1-5]$/.test(levelRaw) ? Number(levelRaw) : null;

  const lessonRaw = first(raw.lesson);

  return {
    tool,
    use: pickKnown(all(raw.use), known.useCases),
    level,
    stack: pickKnown(all(raw.stack), known.stacks),
    q: first(raw.q).trim().slice(0, MAX_QUERY_LENGTH),
    lesson: LESSON_SLUG.test(lessonRaw) ? lessonRaw : "",
    archived: first(raw.archived) === "1",
  };
}

/** Facet filters that narrow the result set (the count in "Filters (3)"). The search box is always visible, so q is not counted. */
export function activeFilterCount(p: WorkflowParams): number {
  return p.use.length + p.stack.length + (p.tool ? 1 : 0) + (p.level !== null ? 1 : 0) + (p.lesson ? 1 : 0);
}

export function hasAnyFilter(p: WorkflowParams): boolean {
  return activeFilterCount(p) > 0 || p.q.length > 0;
}

/** URL for the given params, omitting defaults. */
export function workflowsHref(p: Partial<WorkflowParams>): string {
  const q = new URLSearchParams();
  if (p.tool) q.set("tool", p.tool);
  for (const u of p.use ?? []) q.append("use", u);
  if (p.level) q.set("level", String(p.level));
  for (const s of p.stack ?? []) q.append("stack", s);
  if (p.q) q.set("q", p.q);
  if (p.lesson) q.set("lesson", p.lesson);
  if (p.archived) q.set("archived", "1");
  const s = q.toString();
  return s ? `/workflows?${s}` : "/workflows";
}
