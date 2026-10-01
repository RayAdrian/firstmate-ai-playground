// Media staleness (PRD §15 MD-7). Pure checks plus a small filesystem loader; the DB read lives in ../stale.ts.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { mediaManifestSchema, type MediaManifest } from "../../../src/lib/contracts/media";
import { isBehind, type ToolKey } from "./stale";

export type MediaStaleReason =
  | { kind: "version"; tool: ToolKey; media: string; lesson: string }
  | { kind: "source_changed" }
  | { kind: "source_missing"; file: string }
  | { kind: "lesson_missing" }
  | { kind: "lesson_archived" };

export interface MediaStaleFinding {
  label: string; // "<lesson-slug>/<id>"
  reasons: MediaStaleReason[];
}

export interface LessonInfo {
  archived: boolean;
  tool_versions: Partial<Record<ToolKey, string>>;
}

export function sourceFile(m: MediaManifest): string {
  return m.kind === "animation" ? `media/remotion/src/${m.id}/steps.json` : `media/tapes/${m.id}.tape`;
}

export function hashSource(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function findStaleMedia(input: {
  manifests: MediaManifest[];
  lessons: Map<string, LessonInfo>;
  /** sha256 hex of the item's source file, or null when the file does not exist. */
  sourceHash: (m: MediaManifest) => string | null;
}): MediaStaleFinding[] {
  const findings: MediaStaleFinding[] = [];
  for (const m of input.manifests) {
    const reasons: MediaStaleReason[] = [];
    const lesson = input.lessons.get(m.lesson_slug);
    if (!lesson) reasons.push({ kind: "lesson_missing" });
    else {
      if (lesson.archived) reasons.push({ kind: "lesson_archived" });
      for (const tool of ["claude_code", "codex_cli"] as const) {
        const mine = m.tool_versions[tool];
        const theirs = lesson.tool_versions[tool];
        if (mine && theirs && isBehind(mine, theirs)) reasons.push({ kind: "version", tool, media: mine, lesson: theirs });
      }
    }
    const actual = input.sourceHash(m);
    if (actual === null) reasons.push({ kind: "source_missing", file: sourceFile(m) });
    else if (actual !== m.source_hash.replace(/^sha256:/, "")) reasons.push({ kind: "source_changed" });
    if (reasons.length > 0) findings.push({ label: `${m.lesson_slug}/${m.id}`, reasons });
  }
  return findings;
}

export function describeMediaReason(r: MediaStaleReason): string {
  switch (r.kind) {
    case "version":
      return `${r.tool === "claude_code" ? "Claude Code" : "Codex CLI"} ${r.media} in the media, lesson is on ${r.lesson}`;
    case "source_changed":
      return "source changed since it was rendered (re-run media:render / media:record)";
    case "source_missing":
      return `source file ${r.file} is missing`;
    case "lesson_missing":
      return "its lesson does not exist";
    case "lesson_archived":
      return "its lesson is archived";
  }
}

/** Reads every public/media/lessons/<slug>/*.media.json under repoRoot. Invalid manifests throw (the MD-6 test guards them in CI). */
export function loadManifests(repoRoot: string): MediaManifest[] {
  const base = path.join(repoRoot, "public/media/lessons");
  if (!fs.existsSync(base)) return [];
  const out: MediaManifest[] = [];
  for (const dir of fs.readdirSync(base, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    for (const f of fs.readdirSync(path.join(base, dir.name)).filter((n) => n.endsWith(".media.json")).sort()) {
      out.push(mediaManifestSchema.parse(JSON.parse(fs.readFileSync(path.join(base, dir.name, f), "utf8"))));
    }
  }
  return out;
}

export function hashSourceFromDisk(repoRoot: string): (m: MediaManifest) => string | null {
  return (m) => {
    const p = path.join(repoRoot, sourceFile(m));
    return fs.existsSync(p) ? hashSource(fs.readFileSync(p)) : null;
  };
}
