import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { MediaManifest } from "@/lib/contracts/media";
import { describeMediaReason, findStaleMedia, hashSource, hashSourceFromDisk, loadManifests, type LessonInfo } from "../../../scripts/seed/lib/media-stale";

const base: MediaManifest = {
  id: "l1-first-session",
  lesson_slug: "l1-first-session",
  kind: "recording",
  title: "A working install",
  duration_s: 30,
  width: 1280,
  height: 720,
  tool_versions: { claude_code: "2.1.0", codex_cli: "0.50.0" },
  made_on: "2026-10-01",
  model_calls: false,
  source_hash: "h1",
};
const lessons = (l: Partial<LessonInfo> = {}) =>
  new Map<string, LessonInfo>([["l1-first-session", { archived: false, tool_versions: { claude_code: "2.1.0", codex_cli: "0.50.0" }, ...l }]]);
const run = (m: Partial<MediaManifest>, l: Map<string, LessonInfo> = lessons(), hash: string | null = "h1") =>
  findStaleMedia({ manifests: [{ ...base, ...m }], lessons: l, sourceHash: () => hash });

describe("findStaleMedia (MD-7)", () => {
  it("reports nothing for a fresh item", () => {
    expect(run({})).toEqual([]);
  });

  it("flags a tool version behind the lesson's, per tool", () => {
    const f = run({}, lessons({ tool_versions: { claude_code: "2.2.0", codex_cli: "0.50.0" } }));
    expect(f).toHaveLength(1);
    expect(f[0]?.label).toBe("l1-first-session/l1-first-session");
    expect(f[0]?.reasons).toEqual([{ kind: "version", tool: "claude_code", media: "2.1.0", lesson: "2.2.0" }]);
    expect(describeMediaReason(f[0]!.reasons[0]!)).toContain("Claude Code 2.1.0");
  });

  it("does not flag media that is ahead of the lesson, or on a tool the lesson lacks", () => {
    expect(run({}, lessons({ tool_versions: { claude_code: "2.0.0" } }))).toEqual([]);
  });

  it("flags a changed source hash and a missing source", () => {
    expect(run({}, lessons(), "other")[0]?.reasons).toEqual([{ kind: "source_changed" }]);
    expect(run({}, lessons(), null)[0]?.reasons).toEqual([{ kind: "source_missing", file: "media/tapes/l1-first-session.tape" }]);
  });

  it("flags an archived or missing lesson", () => {
    expect(run({}, lessons({ archived: true }))[0]?.reasons).toEqual([{ kind: "lesson_archived" }]);
    expect(run({}, new Map())[0]?.reasons).toEqual([{ kind: "lesson_missing" }]);
  });
});

describe("loaders", () => {
  it("loads manifests and hashes the right source file per kind", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "v4-"));
    const dir = path.join(root, "public/media/lessons/l4-parallel-worktrees");
    fs.mkdirSync(dir, { recursive: true });
    const anim: MediaManifest = {
      ...base,
      id: "l4-parallel-worktrees",
      lesson_slug: "l4-parallel-worktrees",
      kind: "animation",
      source_hash: hashSource('{"a":1}'),
    };
    fs.writeFileSync(path.join(dir, "l4-parallel-worktrees.media.json"), JSON.stringify(anim));
    fs.mkdirSync(path.join(root, "media/remotion/src/l4-parallel-worktrees"), { recursive: true });
    fs.writeFileSync(path.join(root, "media/remotion/src/l4-parallel-worktrees/steps.json"), '{"a":1}');

    const manifests = loadManifests(root);
    expect(manifests).toHaveLength(1);
    const hashOf = hashSourceFromDisk(root);
    expect(hashOf(manifests[0]!)).toBe(anim.source_hash);
    expect(hashOf({ ...anim, kind: "recording" })).toBeNull();
    expect(loadManifests(path.join(root, "nope"))).toEqual([]);
  });
});
