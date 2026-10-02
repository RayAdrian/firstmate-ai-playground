// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { tldrSourceHash, type LessonTldr } from "@/lib/contracts";
import { checkTldrMedia } from "../m0/tldr-walker";

const tldr: LessonTldr = {
  points: ["Point number one is here.", "Point number two is here.", "Point number three is here."],
  try_this: { all: { kind: "command", text: "ls" } },
};

let tmp: string;
const opts = () => ({
  mediaRoot: path.join(tmp, "media"),
  lessonsDir: path.join(tmp, "lessons"),
  templatePath: path.join(tmp, "template.json"),
});

function lessonFile(title: string, t: LessonTldr) {
  fs.mkdirSync(path.join(tmp, "lessons", "l1"), { recursive: true });
  const pts = t.points.map((p) => `    - "${p}"`).join("\n");
  const only = "all" in t.try_this ? t.try_this.all : t.try_this.claude;
  fs.writeFileSync(
    path.join(tmp, "lessons", "l1", "01-demo.md"),
    `---\nslug: l1-demo\ntitle: ${title}\ntldr:\n  points:\n${pts}\n  try_this:\n    all: { kind: ${only.kind}, text: "${only.text}" }\n---\n\nbody\n`,
  );
}

function video(opts2: { title: string; t: LessonTldr; version: number; mp4Bytes?: number }) {
  const dir = path.join(tmp, "media", "l1-demo");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "tldr.media.json"),
    JSON.stringify({
      id: "tldr",
      lesson_slug: "l1-demo",
      kind: "tldr",
      title: `TL;DR: ${opts2.title}`,
      duration_s: 36,
      width: 1280,
      height: 720,
      tool_versions: { claude_code: "2.1.0", codex_cli: "0.40.0" },
      made_on: "2026-10-02",
      model_calls: false,
      source_hash: tldrSourceHash({ templateVersion: opts2.version, title: opts2.title, tldr: opts2.t }),
      template_version: opts2.version,
    }),
  );
  fs.writeFileSync(path.join(dir, "tldr.mp4"), Buffer.alloc(opts2.mp4Bytes ?? 1000));
  fs.writeFileSync(path.join(dir, "tldr.webp"), Buffer.alloc(100));
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tl0-"));
  fs.writeFileSync(path.join(tmp, "template.json"), JSON.stringify({ version: 1 }));
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe("MD-6 TL;DR walker (TL-11 to TL-13)", () => {
  it("passes on a match, and on no TL;DR videos at all", () => {
    expect(checkTldrMedia(opts())).toEqual([]);
    lessonFile("Demo", tldr);
    video({ title: "Demo", t: tldr, version: 1 });
    expect(checkTldrMedia(opts())).toEqual([]);
  });

  it("fails on a text edit, naming the lesson and the command", () => {
    lessonFile("Demo", { ...tldr, points: ["Point number uno is here.", tldr.points[1]!, tldr.points[2]!] });
    video({ title: "Demo", t: tldr, version: 1 });
    const p = checkTldrMedia(opts());
    expect(p.join("\n")).toContain("l1-demo");
    expect(p.join("\n")).toContain("npm run media:render -- --tldr l1-demo");
  });

  it("fails on a title edit", () => {
    lessonFile("Demo renamed", tldr);
    video({ title: "Demo", t: tldr, version: 1 });
    expect(checkTldrMedia(opts()).join("\n")).toContain("stale");
  });

  it("fails on a template version bump", () => {
    lessonFile("Demo", tldr);
    video({ title: "Demo", t: tldr, version: 1 });
    fs.writeFileSync(path.join(tmp, "template.json"), JSON.stringify({ version: 2 }));
    expect(checkTldrMedia(opts()).join("\n")).toContain("template_version");
  });

  it("fails when the lesson has no tldr, and when the mp4 is over the TL;DR cap", () => {
    fs.mkdirSync(path.join(tmp, "lessons", "l1"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "lessons", "l1", "01-demo.md"), "---\nslug: l1-demo\ntitle: Demo\n---\n\nbody\n");
    video({ title: "Demo", t: tldr, version: 1, mp4Bytes: 409_601 });
    const p = checkTldrMedia(opts()).join("\n");
    expect(p).toContain("no valid tldr");
    expect(p).toContain("tldr.mp4 over");
  });
});
