import { describe, expect, it } from "vitest";
import { REPO_URL } from "../../../src/lib/contracts";
import { freshnessOf, listWorkflows, matchesQuery, sortWorkflows } from "../../../src/lib/workflows/filter";
import { facetLabel, KNOWN_STACKS, KNOWN_USE_CASES } from "../../../src/lib/workflows/labels";
import {
  activeFilterCount,
  parseWorkflowParams,
  workflowsHref,
} from "../../../src/lib/workflows/params";
import { reportOutdatedUrl } from "../../../src/lib/workflows/report";
import { card, params, TODAY, verifiedDaysAgo } from "./helpers";

const known = { useCases: KNOWN_USE_CASES, stacks: KNOWN_STACKS };

describe("WF-40 freshness boundaries (ages 60, 61, 180, 181)", () => {
  it.each([
    [0, "fresh"],
    [60, "fresh"],
    [61, "outdated"],
    [180, "outdated"],
    [181, "archived"],
  ] as const)("age %i days is %s", (age, expected) => {
    expect(freshnessOf(verifiedDaysAgo(age), TODAY)).toBe(expected);
  });
});

describe("WF-31 URL params", () => {
  it("parses every param and keeps repeated values in taxonomy order", () => {
    const p = parseWorkflowParams(
      { tool: "codex", use: ["review", "planning"], level: "2", stack: ["nextjs"], q: " hook ", lesson: "l2-memory" },
      known,
    );
    expect(p).toEqual({
      tool: "codex",
      use: ["planning", "review"],
      level: 2,
      stack: ["nextjs"],
      q: "hook",
      lesson: "l2-memory",
      archived: false,
    });
  });

  it("ignores unknown values instead of failing", () => {
    const p = parseWorkflowParams(
      { tool: "gemini", use: ["bogus", "review"], level: "9", stack: ["BAD VALUE"], lesson: "Not A Slug!", archived: "yes" },
      known,
    );
    expect(p.tool).toBeNull();
    expect(p.use).toEqual(["review"]);
    expect(p.level).toBeNull();
    expect(p.stack).toEqual([]);
    expect(p.lesson).toBe("");
    expect(p.archived).toBe(false);
  });

  it("caps q at 100 characters and takes the first value of a repeated single param", () => {
    expect(parseWorkflowParams({ q: "x".repeat(150) }, known).q).toHaveLength(100);
    expect(parseWorkflowParams({ tool: ["codex", "claude"] }, known).tool).toBe("codex");
  });

  it("round-trips through workflowsHref and omits defaults", () => {
    expect(workflowsHref({})).toBe("/workflows");
    const p = params({ tool: "claude", use: ["review", "testing"], level: 3, q: "a b", archived: true });
    const href = workflowsHref(p);
    expect(href).toBe("/workflows?tool=claude&use=review&use=testing&level=3&q=a+b&archived=1");
    const url = new URL(href, "http://x");
    const raw = Object.fromEntries([...new Set(url.searchParams.keys())].map((k) => [k, url.searchParams.getAll(k)]));
    expect(parseWorkflowParams(raw, known)).toEqual(p);
  });

  it("counts facet filters but not the always-visible search box", () => {
    expect(activeFilterCount(params({ q: "x" }))).toBe(0);
    expect(activeFilterCount(params({ tool: "codex", use: ["review"], stack: ["react", "node"], level: 1 }))).toBe(5);
  });
});

describe("WF-31 filtering", () => {
  const rows = [
    card({ slug: "a", title: "Alpha", tools: ["claude-code"], use_cases: ["review"], stacks: ["nextjs"], level: 1 }),
    card({ slug: "b", title: "Beta", tools: ["codex"], use_cases: ["review", "testing"], stacks: ["react"], level: 2 }),
    card({ slug: "c", title: "Gamma", tools: ["claude-code", "codex"], use_cases: ["testing"], stacks: ["any"], level: null }),
  ];
  const slugs = (p: Parameters<typeof listWorkflows>[1]) => listWorkflows(rows, p, TODAY).items.map((i) => i.slug).sort();

  it("different params AND, repeated values OR", () => {
    expect(slugs(params({ tool: "codex", use: ["review"] }))).toEqual(["b"]);
    expect(slugs(params({ tool: "codex" }))).toEqual(["b", "c"]);
    expect(slugs(params({ use: ["review", "testing"] }))).toEqual(["a", "b", "c"]);
    expect(slugs(params({ stack: ["nextjs", "react"], level: 2 }))).toEqual(["b"]);
  });

  it("removing a filter restores the wider result", () => {
    expect(slugs(params({ tool: "codex", use: ["review"] }))).toEqual(["b"]);
    expect(slugs(params({ tool: "codex" }))).toEqual(["b", "c"]);
  });

  it("the lesson param matches related_lesson_slug", () => {
    const withLesson = [card({ slug: "x", related_lesson_slug: "l1-a" }), card({ slug: "y", related_lesson_slug: null })];
    expect(listWorkflows(withLesson, params({ lesson: "l1-a" }), TODAY).items.map((i) => i.slug)).toEqual(["x"]);
  });

  it("q matches title or problem, case-insensitively, with % and _ as literals", () => {
    expect(matchesQuery(card({ title: "Hook GUARD" }), "guard")).toBe(true);
    expect(matchesQuery(card({ problem: "Edits land without review." }), "WITHOUT")).toBe(true);
    expect(matchesQuery(card({ title: "Gate", problem: "A 50% rule" }), "50%")).toBe(true);
    expect(matchesQuery(card({ title: "Gate", problem: "plain words" }), "%")).toBe(false);
    expect(matchesQuery(card({ title: "Gate", problem: "plain words" }), "_")).toBe(false);
    expect(matchesQuery(card({ title: "my_hook" }), "my_hook")).toBe(true);
  });
});

describe("WF-30 ordering and WF-32 archived", () => {
  it("sorts by verified_on descending, then title ascending", () => {
    const sorted = sortWorkflows([
      card({ slug: "old", title: "Zed", verified_on: "2026-08-01" }),
      card({ slug: "b2", title: "Bravo", verified_on: "2026-09-20" }),
      card({ slug: "a2", title: "Alpha", verified_on: "2026-09-20" }),
    ]);
    expect(sorted.map((r) => r.slug)).toEqual(["a2", "b2", "old"]);
  });

  it("hides archived rows by default, counts them, and includes them with archived=1", () => {
    const rows = [
      card({ slug: "fresh", verified_on: verifiedDaysAgo(60) }),
      card({ slug: "stale", verified_on: verifiedDaysAgo(61) }),
      card({ slug: "gone", verified_on: verifiedDaysAgo(181) }),
    ];
    const def = listWorkflows(rows, params(), TODAY);
    expect(def.items.map((i) => i.slug)).toEqual(["fresh", "stale"]);
    expect(def.archivedCount).toBe(1);
    const all = listWorkflows(rows, params({ archived: true }), TODAY);
    expect(all.items.map((i) => i.slug)).toEqual(["fresh", "stale", "gone"]);
    expect(all.items.find((i) => i.slug === "gone")?.freshness).toBe("archived");
  });
});

describe("WF-37 report link", () => {
  it("is the prefilled issue-form URL built from the contract constant", () => {
    expect(reportOutdatedUrl("plan-before-code")).toBe(
      `${REPO_URL}/issues/new?template=workflow-outdated.yml&labels=workflow-outdated&title=Outdated%3A+plan-before-code&workflow=plan-before-code`,
    );
  });
});

describe("labels", () => {
  it("humanises known and unknown facets", () => {
    expect(facetLabel("ci-and-gates")).toBe("CI and gates");
    expect(facetLabel("nextjs")).toBe("Next.js");
    expect(facetLabel("my-new-thing")).toBe("My new thing");
  });
});
