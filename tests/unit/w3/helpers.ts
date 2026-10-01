import type { WorkflowDraft } from "../../../scripts/workflows/share-lib";

export const sampleDraft = (over: Partial<WorkflowDraft> = {}): WorkflowDraft => ({
  title: "Serialise the shared test database",
  problem: "Parallel worktrees sharing one local database corrupt each other's test runs",
  tools: ["claude-code", "codex"],
  use_cases: ["parallel-work", "testing"],
  stacks: ["supabase"],
  tool_versions: { claude_code: "2.1.286", codex_cli: "0.154.0" },
  verified_on: "2026-10-01",
  before: "Two agents ran database resets at once and tests failed at random.",
  after: "Resets run one at a time and the failures stopped.",
  setup: [{ lang: "markdown", path: "AGENTS.md", kind: "context-file", tool: null, code: "Run `npm run db:reset:test` one at a time." }],
  prompt: { shared: "Run the e2e suite, waiting for the lock first." },
  steps: ["Add the rule to AGENTS.md", "Tell each agent to read it"],
  why: "A written rule that every agent reads at session start keeps the shared resource serial without extra tooling.",
  ...over,
});
