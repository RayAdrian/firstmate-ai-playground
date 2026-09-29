import { describe, expect, it } from "vitest";
import {
  PROGRESS_STORAGE_KEY,
  createEmptyProgress,
  exerciseJsonSchema,
  lessonFrontmatterSchema,
  newsSnapshotSchema,
  progressStateSchema,
  scoredItemSchema,
} from "@/lib/contracts";

const validFrontmatter = {
  slug: "l1-first-session",
  level: 1,
  sort: 1,
  title: "Your first agent session",
  objective: "Run an interactive session.",
  est_minutes: 20,
  tool_versions: { claude_code: "2.0.0", codex_cli: "0.40.0" },
  last_verified_on: "2026-09-30",
  differences: ["Approval modes are named differently."],
  exercise: "ex-1-1-failing-test",
};

describe("contracts", () => {
  it("accepts valid lesson frontmatter and defaults the no-equivalent flags", () => {
    const parsed = lessonFrontmatterSchema.parse(validFrontmatter);
    expect(parsed.claude_no_equivalent).toBe(false);
    expect(parsed.codex_no_equivalent).toBe(false);
  });

  it("rejects lessons with more than 5 differences or a bad date", () => {
    expect(
      lessonFrontmatterSchema.safeParse({
        ...validFrontmatter,
        differences: ["a", "b", "c", "d", "e", "f"],
      }).success,
    ).toBe(false);
    expect(
      lessonFrontmatterSchema.safeParse({ ...validFrontmatter, last_verified_on: "30/09/2026" })
        .success,
    ).toBe(false);
  });

  it("accepts manual and command verify values in exercise.json", () => {
    const base = { slug: "ex-1-1-failing-test", required_tool_features: [] };
    expect(exerciseJsonSchema.safeParse({ ...base, verify: "manual" }).success).toBe(true);
    expect(exerciseJsonSchema.safeParse({ ...base, verify: "npm test" }).success).toBe(true);
    expect(exerciseJsonSchema.safeParse({ ...base, verify: "" }).success).toBe(false);
  });

  it("uses the versioned localStorage key and a valid empty state", () => {
    expect(PROGRESS_STORAGE_KEY).toBe("fm-playground:v1");
    expect(progressStateSchema.safeParse(createEmptyProgress()).success).toBe(true);
    expect(progressStateSchema.safeParse({ version: 2 }).success).toBe(false);
  });

  it("validates scoring output: integer 0-100, known tags, <=280 char why", () => {
    const ok = { id: "abc", score: 80, tags: ["tooling"], why: "Relevant." };
    expect(scoredItemSchema.safeParse(ok).success).toBe(true);
    expect(scoredItemSchema.safeParse({ ...ok, score: 101 }).success).toBe(false);
    expect(scoredItemSchema.safeParse({ ...ok, score: 50.5 }).success).toBe(false);
    expect(scoredItemSchema.safeParse({ ...ok, tags: ["gossip"] }).success).toBe(false);
    expect(scoredItemSchema.safeParse({ ...ok, why: "x".repeat(281) }).success).toBe(false);
  });

  it("validates the news snapshot file format", () => {
    const snapshot = {
      version: 1,
      digest_date: "2026-09-30",
      exported_at: "2026-09-30T00:05:00.000Z",
      run: null,
      items: [],
    };
    expect(newsSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(newsSnapshotSchema.safeParse({ ...snapshot, version: 2 }).success).toBe(false);
  });
});
