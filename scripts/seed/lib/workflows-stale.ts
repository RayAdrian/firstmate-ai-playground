// Workflow staleness for `npm run content:stale` (PRD §16.7 WF-41). Kept in its own module so scripts/seed/stale.ts, which the
// media workstream owns, only needs one import and one call: `await reportWorkflowStale(db, now, latest)`.
// `--strict` still counts lessons only: workflows decay by design, so this group never changes the exit code.
import type { SupabaseClient } from "@supabase/supabase-js";
import { workflowFreshness, type WorkflowFreshness, type WorkflowTool } from "../../../src/lib/contracts";
import type { Database } from "../../../src/lib/db/types";
import { isBehind, manilaDate, type ToolKey } from "./stale";
import { workflowsClient } from "./workflows-db";

export interface StaleWorkflowInput {
  slug: string;
  verified_on: string;
  tools: readonly WorkflowTool[];
  tool_versions: Partial<Record<ToolKey, string>>;
}

export interface StaleWorkflowFinding {
  slug: string;
  ageDays: number;
  freshness: WorkflowFreshness;
  behind: { tool: ToolKey; workflow: string; latest: string }[];
}

const TOOL_KEY: Record<WorkflowTool, ToolKey> = { "claude-code": "claude_code", codex: "codex_cli" };
const TOOL_NAME: Record<ToolKey, string> = { claude_code: "Claude Code", codex_cli: "Codex CLI" };

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Workflows that are "May be outdated" or Archived, or whose tool_versions are behind the latest release seen (WF-40, WF-41). */
export function findStaleWorkflows(args: {
  workflows: readonly StaleWorkflowInput[];
  now: Date;
  latest: Partial<Record<ToolKey, string>>;
}): StaleWorkflowFinding[] {
  const today = manilaDate(args.now);
  const out: StaleWorkflowFinding[] = [];
  for (const w of args.workflows) {
    const ageDays = daysBetween(w.verified_on, today);
    const freshness = workflowFreshness(ageDays);
    const behind: StaleWorkflowFinding["behind"] = [];
    for (const tool of w.tools) {
      const key = TOOL_KEY[tool];
      const have = w.tool_versions[key];
      const latest = args.latest[key];
      if (have && latest && isBehind(have, latest)) behind.push({ tool: key, workflow: have, latest });
    }
    if (freshness !== "fresh" || behind.length > 0) out.push({ slug: w.slug, ageDays, freshness, behind });
  }
  return out.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

const FRESHNESS_LABEL: Record<WorkflowFreshness, string> = { fresh: "", outdated: "May be outdated", archived: "Archived" };

export function formatWorkflowStale(findings: readonly StaleWorkflowFinding[], checked: number): string[] {
  if (findings.length === 0) return [`content:stale: Workflows: none need attention (${checked} checked).`];
  const lines = [`content:stale: Workflows: ${findings.length} of ${checked} need attention (--strict counts lessons only):`];
  for (const f of findings) {
    const parts: string[] = [];
    if (f.freshness !== "fresh") parts.push(`${FRESHNESS_LABEL[f.freshness]} (${f.ageDays} days since verified)`);
    for (const b of f.behind) parts.push(`${TOOL_NAME[b.tool]} ${b.workflow} is behind ${b.latest}`);
    lines.push(`  ${f.slug}: ${parts.join("; ")}`);
  }
  return lines;
}

/** Read the live (not removed) workflows and print the "Workflows" group. Reports only; returns the findings. */
export async function reportWorkflowStale(
  db: SupabaseClient<Database>,
  now: Date,
  latest: Partial<Record<ToolKey, string>>,
  log: (line: string) => void = console.log,
): Promise<StaleWorkflowFinding[]> {
  const { data, error } = await workflowsClient(db)
    .from("workflows")
    .select("slug, verified_on, tools, tool_versions")
    .is("removed_at", null)
    .order("slug");
  if (error) throw new Error(`cannot read workflows: ${error.message}`);
  const findings = findStaleWorkflows({
    workflows: data.map((w) => ({ slug: w.slug, verified_on: w.verified_on, tools: w.tools, tool_versions: w.tool_versions })),
    now,
    latest,
  });
  for (const line of formatWorkflowStale(findings, data.length)) log(line);
  return findings;
}
