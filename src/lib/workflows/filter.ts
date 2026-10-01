// Pure list logic for /workflows and the lesson row: freshness, filtering, sorting (PRD WF-30, WF-31, WF-40).
import { workflowFreshness, type WorkflowFreshness, type WorkflowRow } from "@/lib/contracts";
import { daysBetween } from "@/components/lesson/format";
import { TOOL_PARAM_TO_WORKFLOW_TOOL, type WorkflowParams } from "./params";

/** The columns the index and the lesson row need (no setup code, prompts or body). */
export type WorkflowCardData = Pick<
  WorkflowRow,
  | "slug"
  | "title"
  | "problem"
  | "tools"
  | "setup_kinds"
  | "use_cases"
  | "stacks"
  | "related_lesson_slug"
  | "level"
  | "verified_on"
  | "author_name"
  | "reviewed_on"
>;

/** Age in whole days between verified_on and today (Manila). A malformed date reads as fresh rather than hiding the row. */
export function workflowAgeDays(verifiedOn: string, today: string): number {
  return daysBetween(verifiedOn, today) ?? 0;
}

export function freshnessOf(verifiedOn: string, today: string): WorkflowFreshness {
  return workflowFreshness(workflowAgeDays(verifiedOn, today));
}

/** verified_on descending, then title ascending (WF-30). */
export function sortWorkflows<T extends Pick<WorkflowCardData, "verified_on" | "title">>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.verified_on !== b.verified_on) return a.verified_on < b.verified_on ? 1 : -1;
    return a.title.localeCompare(b.title);
  });
}

/** Case-insensitive literal match on title or problem. `%` and `_` are ordinary characters. */
export function matchesQuery(row: Pick<WorkflowCardData, "title" | "problem">, q: string): boolean {
  if (q.length === 0) return true;
  const needle = q.toLowerCase();
  return row.title.toLowerCase().includes(needle) || row.problem.toLowerCase().includes(needle);
}

/** Different params AND together; repeated values of one param OR (WF-31). Archived handling is separate. */
export function matchesParams(row: WorkflowCardData, p: WorkflowParams): boolean {
  if (p.tool && !row.tools.includes(TOOL_PARAM_TO_WORKFLOW_TOOL[p.tool])) return false;
  if (p.use.length > 0 && !p.use.some((u) => row.use_cases.includes(u))) return false;
  if (p.level !== null && row.level !== p.level) return false;
  if (p.stack.length > 0 && !p.stack.some((s) => row.stacks.includes(s))) return false;
  if (p.lesson && row.related_lesson_slug !== p.lesson) return false;
  return matchesQuery(row, p.q);
}

export type WorkflowListing = {
  /** Rows to render, sorted. Archived rows are included only when `params.archived`. */
  items: (WorkflowCardData & { freshness: WorkflowFreshness })[];
  /** Archived rows that match the other filters (the N in "Show archived (N)"). */
  archivedCount: number;
};

export function listWorkflows(rows: readonly WorkflowCardData[], p: WorkflowParams, today: string): WorkflowListing {
  const matched = rows
    .filter((r) => matchesParams(r, p))
    .map((r) => ({ ...r, freshness: freshnessOf(r.verified_on, today) }));
  const archivedCount = matched.filter((r) => r.freshness === "archived").length;
  const items = sortWorkflows(p.archived ? matched : matched.filter((r) => r.freshness !== "archived"));
  return { items, archivedCount };
}

/** Distinct values of a facet across the rows, used to extend the static taxonomy lists. */
export function distinct(values: readonly (readonly string[])[]): string[] {
  return [...new Set(values.flat())];
}
