// @vitest-environment node
import { describe, expect, it } from "vitest";
import { extractJsonObjects, parseScoringOutput } from "../../../scripts/news/score-parse";

const ok = (id: string, over: Record<string, unknown> = {}) => ({ id, score: 50, tags: ["tooling"], why: "why", ...over });

describe("extractJsonObjects", () => {
  it("reads a full array, fenced or not", () => {
    expect(extractJsonObjects('```json\n[{"a":1},{"b":"x}y"}]\n```')).toEqual([{ a: 1 }, { b: "x}y" }]);
  });
  it("recovers complete objects from a truncated array", () => {
    expect(extractJsonObjects('[{"a":1},{"b":2},{"c":')).toEqual([{ a: 1 }, { b: 2 }]);
  });
  it("returns nothing for prose", () => {
    expect(extractJsonObjects("Sorry, no.")).toEqual([]);
  });
});

describe("parseScoringOutput (I-3.2, TC-E-25/28)", () => {
  const ids = ["a", "b"];
  it("accepts boundary values", () => {
    for (const score of [0, 100]) {
      const r = parseScoringOutput(JSON.stringify([ok("a", { score }), ok("b")]), ids);
      expect(r.scored.map((s) => s.id)).toEqual(["a", "b"]);
    }
  });
  it.each([
    ["score 101", { score: 101 }],
    ["score -1", { score: -1 }],
    ["score 85.5", { score: 85.5 }],
    ["score string", { score: "85" }],
    ["score null", { score: null }],
    ["unknown tag", { tags: ["tooling", "ai"] }],
    ["empty why", { why: "" }],
    ["why 281 chars", { why: "x".repeat(281) }],
  ])("rejects %s", (_n, over) => {
    const r = parseScoringOutput(JSON.stringify([ok("a", over), ok("b")]), ids);
    expect(r.scored.map((s) => s.id)).toEqual(["b"]);
    expect(r.unscored).toEqual(["a"]);
  });
  it("accepts a 280-char why", () => {
    const r = parseScoringOutput(JSON.stringify([ok("a", { why: "x".repeat(280) }), ok("b")]), ids);
    expect(r.scored).toHaveLength(2);
  });
  it("counts 280 in code points, not UTF-16 units", () => {
    const r = parseScoringOutput(JSON.stringify([ok("a", { why: "😀".repeat(280) }), ok("b")]), ids);
    expect(r.scored).toHaveLength(2);
  });
  it("dedupes tags", () => {
    const r = parseScoringOutput(JSON.stringify([ok("a", { tags: ["security", "security"] }), ok("b")]), ids);
    expect(r.scored[0].tags).toEqual(["security"]);
  });
  it("ignores ids outside the batch and invalidates duplicated ids", () => {
    const r = parseScoringOutput(JSON.stringify([ok("a"), ok("zzz", { score: 100 }), ok("b"), ok("b", { score: 99 })]), ids);
    expect(r.scored.map((s) => s.id)).toEqual(["a"]);
    expect(r.unscored).toEqual(["b"]);
  });
  it("reports no json when there is none", () => {
    const r = parseScoringOutput("nope", ids);
    expect(r.scored).toEqual([]);
    expect(r.unscored).toEqual(ids);
    expect(r.parseError).toBe(true);
  });
  it("keeps the complete prefix of a truncated batch", () => {
    const full = JSON.stringify([ok("a"), ok("b")]);
    const r = parseScoringOutput(full.slice(0, full.length - 12), ids);
    expect(r.scored.map((s) => s.id)).toEqual(["a"]);
    expect(r.unscored).toEqual(["b"]);
  });
});
