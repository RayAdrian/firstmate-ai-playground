// @vitest-environment node
import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseWorkflowFile } from "../../../scripts/workflows/parse";
import { workflowFreshness } from "../../../src/lib/contracts";
import { CTX, WF_FIXTURES, readFixture } from "./helpers";

// PRD §16.8: db:reset:test adds 6 fixture workflows. Ages are relative to the fixed test clock, 2026-09-30 Asia/Manila.
const files = readdirSync(path.join(WF_FIXTURES, "e2e")).filter((f) => f.endsWith(".md")).sort();
const parsed = files.map((f) => ({ f, r: parseWorkflowFile(readFixture("e2e", f), `tests/fixtures/workflows/e2e/${f}`, CTX) }));
const ageOn = (verified: string) => Math.round((Date.UTC(2026, 8, 30) - Date.parse(`${verified}T00:00:00Z`)) / 86_400_000);

describe("E2E fixture workflows", () => {
  it("are exactly six and all valid", () => {
    expect(files).toHaveLength(6);
    for (const { f, r } of parsed) expect({ f, issues: r.issues }).toEqual({ f, issues: [] });
  });

  it("cover both tools, Claude Code only, Codex only with a prompt-only setup, 61 days, 181 days, and a script tag", () => {
    const v = parsed.map((p) => p.r.value!);
    expect(v.some((w) => w.tools.length === 2)).toBe(true);
    expect(v.some((w) => w.tools.join() === "claude-code")).toBe(true);
    expect(v.some((w) => w.tools.join() === "codex" && w.setup.length === 0)).toBe(true);
    const ages = v.map((w) => ageOn(w.verified_on));
    expect(ages).toContain(61);
    expect(ages).toContain(181);
    expect(workflowFreshness(61)).toBe("outdated");
    expect(workflowFreshness(181)).toBe("archived");
    expect(v.some((w) => w.why_md.includes("<script>"))).toBe(true);
  });

  it("at least two link to a fixture lesson", () => {
    expect(parsed.filter((p) => p.r.value?.related_lesson_slug).length).toBeGreaterThanOrEqual(2);
  });

  it("have distinct, E2E-friendly titles", () => {
    const titles = parsed.map((p) => p.r.value!.title);
    expect(new Set(titles).size).toBe(6);
  });
});
