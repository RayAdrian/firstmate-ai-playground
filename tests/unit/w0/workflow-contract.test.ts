// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  WORKFLOW_ARCHIVED_MIN_DAYS,
  WORKFLOW_FRESH_MAX_DAYS,
  WORKFLOW_SECTIONS,
  WORKFLOW_SETUP_KINDS,
  buildWorkflowFrontmatterSchema,
  setupPathSchema,
  workflowFreshness,
  workflowFrontmatterSchema,
  workflowRowSchema,
  REPO_URL,
  WORKFLOW_OUTDATED_ISSUE_TEMPLATE,
} from "@/lib/contracts";

const ctx = {
  useCases: ["planning", "review", "testing"],
  stacks: ["any", "nextjs", "react"],
  lessonSlugs: ["l4-parallel-worktrees"],
  today: "2026-10-01",
};
const schema = buildWorkflowFrontmatterSchema(ctx);

const valid = {
  title: "Per-SHA gate statuses",
  problem: "An approval given on one commit silently covers a later push",
  tools: ["claude-code", "codex"],
  use_cases: ["review"],
  stacks: ["any"],
  related_lesson: "l4-parallel-worktrees",
  tool_versions: { claude_code: "2.1.0", codex_cli: "0.154.0" },
  verified_on: "2026-09-30",
  client_safe: "confirmed",
};

const issuesFor = (v: unknown) => {
  const r = schema.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

describe("workflow frontmatter contract (PRD §16.6)", () => {
  it("accepts a valid file, with and without related_lesson", () => {
    expect(issuesFor(valid)).toEqual([]);
    const rest: Record<string, unknown> = { ...valid };
    delete rest.related_lesson;
    expect(issuesFor(rest)).toEqual([]);
    expect(workflowFrontmatterSchema.safeParse(valid).success).toBe(true);
  });

  const noClientSafe: Record<string, unknown> = { ...valid };
  delete noClientSafe.client_safe;
  it.each<[string, unknown, string]>([
    ["missing client_safe", noClientSafe, "client_safe"],
    ["client_safe: yes", { ...valid, client_safe: "yes" }, "client_safe"],
    ["client_safe: true", { ...valid, client_safe: true }, "client_safe"],
    ["a two-sentence problem", { ...valid, problem: "First sentence here. And a second one follows." }, "problem"],
    ["a too-short problem", { ...valid, problem: "Too short." }, "problem"],
    ["a too-long title", { ...valid, title: "x".repeat(81) }, "title"],
    ["a too-short title", { ...valid, title: "short" }, "title"],
    ["empty tools", { ...valid, tools: [], tool_versions: {} }, "tools"],
    ["duplicate tools", { ...valid, tools: ["codex", "codex"] }, "tools"],
    ["an unknown tool", { ...valid, tools: ["cursor"] }, "tools"],
    ["an unknown use_case", { ...valid, use_cases: ["vibes"] }, "use_cases"],
    ["no use_cases", { ...valid, use_cases: [] }, "use_cases"],
    ["4 use_cases", { ...valid, use_cases: ["planning", "review", "testing", "security"] }, "use_cases"],
    ["an unknown stack", { ...valid, stacks: ["cobol"] }, "stacks"],
    ["any mixed with another stack", { ...valid, stacks: ["any", "react"] }, "stacks"],
    ["5 stacks", { ...valid, stacks: ["a", "b", "c", "d", "e"] }, "stacks"],
    ["a nonexistent related_lesson", { ...valid, related_lesson: "l9-nope" }, "related_lesson"],
    [
      "a tool_versions key for a tool not in tools",
      { ...valid, tools: ["claude-code"], tool_versions: { claude_code: "2.1.0", codex_cli: "0.154.0" } },
      "tool_versions.codex_cli",
    ],
    ["a missing tool_versions key for a listed tool", { ...valid, tool_versions: { claude_code: "2.1.0" } }, "tool_versions.codex_cli"],
    ["a non-semver version", { ...valid, tool_versions: { claude_code: "latest", codex_cli: "0.154.0" } }, "tool_versions.claude_code"],
    ["a future verified_on", { ...valid, verified_on: "2026-10-02" }, "verified_on"],
    ["a malformed verified_on", { ...valid, verified_on: "Oct 1" }, "verified_on"],
    ["an author field", { ...valid, author: "someone" }, "author"],
  ])("rejects %s and names %s", (_name, input, field) => {
    const found = issuesFor(input);
    expect(found.some((i) => i.startsWith(`${field}:`) || i.startsWith(`${field}.`))).toBe(true);
  });

  it("explains the author rule", () => {
    expect(issuesFor({ ...valid, author: "x" })).toContain("author: author comes from git; remove this field");
  });

  it("allows today's date for verified_on", () => {
    expect(issuesFor({ ...valid, verified_on: "2026-10-01" })).toEqual([]);
  });

  it("skips context checks that have no context (static schema)", () => {
    const loose = workflowFrontmatterSchema.safeParse({
      ...valid,
      use_cases: ["anything"],
      related_lesson: "l9-nope",
      verified_on: "2999-01-01",
    });
    expect(loose.success).toBe(true);
  });
});

describe("workflow contract constants", () => {
  it("has the §16.6 sections in order and the setup kinds", () => {
    expect(WORKFLOW_SECTIONS).toEqual(["Result", "Setup", "Prompt", "Steps", "Why it works"]);
    expect([...WORKFLOW_SETUP_KINDS]).toEqual(["context-file", "hook", "skill", "subagent", "config", "script"]);
  });

  it.each([
    [0, "fresh"],
    [60, "fresh"],
    [61, "outdated"],
    [180, "outdated"],
    [181, "archived"],
  ])("derives freshness for age %i as %s (WF-40 boundaries)", (age, expected) => {
    expect(workflowFreshness(age)).toBe(expected);
    expect(WORKFLOW_FRESH_MAX_DAYS).toBe(60);
    expect(WORKFLOW_ARCHIVED_MIN_DAYS).toBe(181);
  });

  it("exposes the repo URL and issue template name", () => {
    expect(REPO_URL).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+$/);
    expect(WORKFLOW_OUTDATED_ISSUE_TEMPLATE).toBe("workflow-outdated.yml");
  });

  it.each(["../x", "a/../b", "/Users/me/x", "/home/me/x", "C:\\Users\\me", "/etc/passwd"])(
    "rejects setup path %s",
    (p) => expect(setupPathSchema.safeParse(p).success).toBe(false),
  );
  it.each([".claude/settings.json", "~/.claude/agents/x.md", "scripts/run.sh"])("accepts setup path %s", (p) =>
    expect(setupPathSchema.safeParse(p).success).toBe(true),
  );
});

describe("workflows row + migration", () => {
  const row = {
    id: "00000000-0000-0000-0000-000000000001",
    slug: "per-sha-gate-statuses",
    title: "Per-SHA gate statuses",
    problem: "An approval given on one commit silently covers a later push",
    tools: ["claude-code"],
    setup: [{ lang: "bash", path: "scripts/x.sh", kind: "script", tool: null, code: "echo hi" }],
    setup_kinds: ["script"],
    prompt: { shared: "Do the thing" },
    result_before: "before",
    result_after: "after",
    steps: ["one"],
    why_md: "because",
    use_cases: ["review"],
    stacks: ["any"],
    related_lesson_slug: null,
    level: null,
    tool_versions: { claude_code: "2.1.0" },
    verified_on: "2026-09-30",
    author_name: "First Mate",
    reviewed_on: null,
    content_hash: "abc",
    removed_at: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  };

  it("parses a valid row and rejects bad ones", () => {
    expect(workflowRowSchema.safeParse(row).success).toBe(true);
    expect(workflowRowSchema.safeParse({ ...row, tools: [] }).success).toBe(false);
    expect(workflowRowSchema.safeParse({ ...row, steps: [] }).success).toBe(false);
    expect(workflowRowSchema.safeParse({ ...row, steps: ["1", "2", "3", "4", "5", "6"] }).success).toBe(false);
    expect(workflowRowSchema.safeParse({ ...row, level: 6 }).success).toBe(false);
  });

  it("migration creates workflows with anon read-only RLS and every §16.8 index", () => {
    const sql = readFileSync(
      path.resolve(__dirname, "../../../supabase/migrations/20261001000000_workflows.sql"),
      "utf8",
    );
    expect(sql).toMatch(/create table public\.workflows/);
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/revoke all on public\.workflows from anon, authenticated/);
    expect(sql).toMatch(/grant select on public\.workflows to anon, authenticated/);
    expect(sql).not.toMatch(/grant (insert|update|delete|all) on public\.workflows to (anon|authenticated)/);
    expect(sql).toMatch(/for select to anon, authenticated using \(true\)/);
    for (const idx of ["tools", "use_cases", "stacks"]) expect(sql).toContain(`using gin (${idx})`);
    expect(sql).toContain("(related_lesson_slug)");
    expect(sql).toContain("(verified_on desc)");
    expect(sql).not.toMatch(/^\s+(client_safe|freshness)\w*\s/m);
  });
});
