import type { WorkflowRow } from "../../../src/lib/contracts";
import type { WorkflowCardData } from "../../../src/lib/workflows/filter";
import { EMPTY_PARAMS, type WorkflowParams } from "../../../src/lib/workflows/params";

export const TODAY = "2026-09-30";

/** `verified_on` for a workflow that is `days` old on TODAY. */
export function verifiedDaysAgo(days: number, today: string = TODAY): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function card(over: Partial<WorkflowCardData> = {}): WorkflowCardData {
  return {
    slug: "plan-before-code",
    title: "Plan before code",
    problem: "The agent starts editing before it understands the change.",
    tools: ["claude-code", "codex"],
    setup_kinds: ["context-file"],
    use_cases: ["planning"],
    stacks: ["nextjs"],
    related_lesson_slug: null,
    level: null,
    verified_on: verifiedDaysAgo(5),
    author_name: "Test Author",
    reviewed_on: verifiedDaysAgo(4),
    ...over,
  };
}

export function params(over: Partial<WorkflowParams> = {}): WorkflowParams {
  return { ...EMPTY_PARAMS, ...over };
}

export function row(over: Partial<WorkflowRow> = {}): WorkflowRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    slug: "plan-before-code",
    title: "Plan before code",
    problem: "The agent starts editing before it understands the change.",
    tools: ["claude-code", "codex"],
    setup: [
      { path: "AGENTS.md", kind: "context-file", lang: "markdown", tool: null, code: "Plan first." },
      { path: ".claude/settings.json", kind: "config", lang: "json", tool: "claude-code", code: "{}" },
      { path: ".codex/config.toml", kind: "config", lang: "toml", tool: "codex", code: "model = 'x'" },
    ],
    setup_kinds: ["context-file", "config"],
    prompt: { shared: "```text\nPlan this change first.\n```" },
    result_before: "The agent edits files straight away.",
    result_after: "The agent writes a plan and waits for approval.",
    steps: ["Add the file.", "Run the prompt.", "Review the plan."],
    why_md: "A written plan makes the agent's assumptions visible before any file changes.",
    use_cases: ["planning"],
    stacks: ["nextjs"],
    related_lesson_slug: null,
    level: null,
    tool_versions: { claude_code: "2.1.0", codex_cli: "0.40.0" },
    verified_on: verifiedDaysAgo(5),
    author_name: "Test Author",
    reviewed_on: verifiedDaysAgo(4),
    content_hash: "h",
    removed_at: null,
    created_at: "2026-09-25T00:00:00Z",
    updated_at: "2026-09-25T00:00:00Z",
    ...over,
  };
}
