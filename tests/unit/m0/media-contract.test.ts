import { describe, expect, it } from "vitest";
import { mediaManifestSchema } from "@/lib/contracts";

const valid = {
  id: "worktrees",
  lesson_slug: "l4-parallel-worktrees",
  kind: "animation",
  title: "Three agents, three worktrees",
  duration_s: 72.5,
  width: 1280,
  height: 720,
  tool_versions: { claude_code: "2.1.0" },
  made_on: "2026-10-01",
  model_calls: false,
  source_hash: "abc123",
};

describe("mediaManifestSchema", () => {
  it("accepts a valid manifest, including a single-tool tool_versions", () => {
    expect(mediaManifestSchema.safeParse(valid).success).toBe(true);
    expect(
      mediaManifestSchema.safeParse({ ...valid, tool_versions: { claude_code: "1", codex_cli: "2" } }).success,
    ).toBe(true);
  });

  it.each([
    ["bad kind", { kind: "gif" }],
    ["bad slug", { lesson_slug: "L4 Parallel" }],
    ["zero duration", { duration_s: 0 }],
    ["fractional width", { width: 1280.5 }],
    ["empty tool_versions", { tool_versions: {} }],
    ["unknown tool key only", { tool_versions: { other: "1" } }],
    ["bad date", { made_on: "10/01/2026" }],
    ["missing model_calls", { model_calls: undefined }],
    ["empty source_hash", { source_hash: "" }],
  ])("rejects %s", (_n, patch) => {
    expect(mediaManifestSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
});
