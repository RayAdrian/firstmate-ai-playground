// @vitest-environment node
import { describe, expect, it } from "vitest";
import { findStaleWorkflows, formatWorkflowStale, type StaleWorkflowInput } from "../../../scripts/seed/lib/workflows-stale";

const NOW = new Date("2026-09-30T13:00:00+08:00");
const daysAgo = (n: number) => new Date(Date.UTC(2026, 8, 30) - n * 86_400_000).toISOString().slice(0, 10);
const wf = (slug: string, age: number, extra: Partial<StaleWorkflowInput> = {}): StaleWorkflowInput => ({
  slug,
  verified_on: daysAgo(age),
  tools: ["claude-code"],
  tool_versions: { claude_code: "2.1.0" },
  ...extra,
});

describe("findStaleWorkflows (WF-41, WF-40 thresholds)", () => {
  it("lists nothing at 60 days and May be outdated at 61 and 180", () => {
    const r = findStaleWorkflows({ workflows: [wf("a", 0), wf("b", 60), wf("c", 61), wf("d", 180)], now: NOW, latest: {} });
    expect(r.map((x) => [x.slug, x.freshness, x.ageDays])).toEqual([
      ["c", "outdated", 61],
      ["d", "outdated", 180],
    ]);
  });

  it("lists Archived at 181 days and beyond", () => {
    const r = findStaleWorkflows({ workflows: [wf("e", 181), wf("f", 400)], now: NOW, latest: {} });
    expect(r.map((x) => [x.slug, x.freshness])).toEqual([
      ["e", "archived"],
      ["f", "archived"],
    ]);
  });

  it("uses today in Manila, not UTC", () => {
    const lateUtc = new Date("2026-09-29T20:00:00Z"); // 04:00 on the 30th in Manila
    expect(findStaleWorkflows({ workflows: [wf("g", 61)], now: lateUtc, latest: {} })).toHaveLength(1);
  });

  it("lists a fresh workflow whose tool_versions are behind the latest release, per tool listed", () => {
    const r = findStaleWorkflows({
      workflows: [wf("h", 5, { tools: ["claude-code", "codex"], tool_versions: { claude_code: "2.1.0", codex_cli: "0.150.0" } })],
      now: NOW,
      latest: { claude_code: "2.3.0", codex_cli: "0.154.0" },
    });
    expect(r).toHaveLength(1);
    expect(r[0]?.freshness).toBe("fresh");
    expect(r[0]?.behind).toEqual([
      { tool: "claude_code", workflow: "2.1.0", latest: "2.3.0" },
      { tool: "codex_cli", workflow: "0.150.0", latest: "0.154.0" },
    ]);
  });

  it("ignores a version for a tool the workflow does not list, and prereleases", () => {
    const r = findStaleWorkflows({
      workflows: [wf("i", 5, { tools: ["claude-code"], tool_versions: { claude_code: "2.3.0", codex_cli: "0.1.0" } })],
      now: NOW,
      latest: { claude_code: "2.3.1-beta.1", codex_cli: "0.154.0" },
    });
    expect(r).toEqual([]);
  });

  it("sorts by slug", () => {
    const r = findStaleWorkflows({ workflows: [wf("z", 100), wf("m", 100)], now: NOW, latest: {} });
    expect(r.map((x) => x.slug)).toEqual(["m", "z"]);
  });
});

describe("formatWorkflowStale", () => {
  it("prints a separate Workflows group with age and freshness", () => {
    const findings = findStaleWorkflows({ workflows: [wf("c", 61), wf("e", 181)], now: NOW, latest: {} });
    expect(formatWorkflowStale(findings, 5)).toEqual([
      "content:stale: Workflows: 2 of 5 need attention (--strict counts lessons only):",
      "  c: May be outdated (61 days since verified)",
      "  e: Archived (181 days since verified)",
    ]);
  });

  it("includes the version gap", () => {
    const findings = findStaleWorkflows({ workflows: [wf("h", 5, { tool_versions: { claude_code: "2.1.0" } })], now: NOW, latest: { claude_code: "2.3.0" } });
    expect(formatWorkflowStale(findings, 1)[1]).toBe("  h: Claude Code 2.1.0 is behind 2.3.0");
  });

  it("says so when everything is fresh", () => {
    expect(formatWorkflowStale([], 3)).toEqual(["content:stale: Workflows: none need attention (3 checked)."]);
  });
});
