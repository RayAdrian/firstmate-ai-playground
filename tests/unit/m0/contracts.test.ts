import { describe, expect, it } from "vitest";
import {
  PROGRESS_STORAGE_KEY,
  createEmptyProgress,
  exerciseJsonSchema,
  lessonFrontmatterSchema,
  lessonRowSchema,
  snapshotItemSchema,
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
      runs: [],
      items: [],
    };
    expect(newsSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(newsSnapshotSchema.safeParse({ ...snapshot, version: 2 }).success).toBe(false);
  });

  it("snapshots carry runs and reject non-http(s) item URLs", () => {
    const base = { version: 1, digest_date: "2026-09-30", exported_at: "2026-09-30T00:05:00.000Z", items: [] };
    expect(newsSnapshotSchema.safeParse(base).success).toBe(false); // runs is required
    const item = {
      id: "00000000-0000-0000-0000-0000000000b1", source_slug: "s", guid: null, canonical_url: "https://a.test/x", url: "https://a.test/x",
      title: "t", author: null, published_at: null, first_seen_at: "2026-09-30T00:00:00.000Z",
      digest_date: "2026-09-30", excerpt: null, score: null, tags: [], why_it_matters: null,
      scoring_status: "pending", attempts: 0, scored_at: null, scorer_model: null,
    };
    expect(snapshotItemSchema.safeParse(item).success).toBe(true);
    expect(snapshotItemSchema.safeParse({ ...item, url: "javascript:alert(1)" }).success).toBe(false);
    const noId: Partial<typeof item> = { ...item };
    delete noId.id;
    expect(snapshotItemSchema.safeParse(noId).success).toBe(false); // id is the upsert key
    expect(snapshotItemSchema.safeParse({ ...item, id: "not-a-uuid" }).success).toBe(false);
  });

  it("snapshot runs need a stable id", () => {
    const run = {
      id: "00000000-0000-0000-0000-0000000000a1", started_at: "2026-09-30T00:00:00.000Z", finished_at: null,
      trigger: "manual", status: "success", fetched: 0, new: 0, scored: 0, pending: 0, failed: 0,
      skipped: 0, error_summary: null,
    };
    const snap = { version: 1, digest_date: "2026-09-30", exported_at: "2026-09-30T00:05:00.000Z", items: [] };
    expect(newsSnapshotSchema.safeParse({ ...snap, runs: [run] }).success).toBe(true);
    const noId: Partial<typeof run> = { ...run };
    delete noId.id;
    expect(newsSnapshotSchema.safeParse({ ...snap, runs: [noId] }).success).toBe(false);
  });

  it("requires a workaround when a tool has no native equivalent", () => {
    const lesson = {
      id: "00000000-0000-0000-0000-000000000001", level_id: "00000000-0000-0000-0000-000000000002",
      slug: "l3-plan", sort: 1, title: "t", objective: "o", est_minutes: 10, concept_md: "c",
      claude_md: "x", codex_md: null, claude_no_equivalent: false, codex_no_equivalent: true,
      claude_workaround_md: null, codex_workaround_md: null, differences: ["d"],
      tool_versions: {}, tldr: null, last_verified_on: null, content_hash: "h", archived_at: null,
      updated_at: "2026-09-30T00:00:00Z",
    };
    expect(lessonRowSchema.safeParse(lesson).success).toBe(false);
    expect(lessonRowSchema.safeParse({ ...lesson, codex_workaround_md: "Use a manual plan file." }).success).toBe(true);
  });
});
