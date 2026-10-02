import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LessonTldr } from "@/lib/contracts";
import { tldrSourceHash } from "@/lib/contracts/tldr-hash";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { readLessonMedia, readTldrMedia } from "@/components/lesson/server/media";

const SLUG = "l9-demo";
const TITLE = "Demo lesson";
const TEMPLATE = 3;
const tldr: LessonTldr = {
  points: ["Point number one is here.", "Point number two is here.", "Point number three is here."],
  try_this: { all: { kind: "command", text: "claude --version" } },
};

const manifest = (id: string, kind: string, over: Record<string, unknown> = {}) => ({
  id,
  lesson_slug: SLUG,
  kind,
  title: kind === "tldr" ? `TL;DR: ${TITLE}` : `Title ${id}`,
  duration_s: 31,
  width: 1280,
  height: 720,
  tool_versions: { claude_code: "2.1.0" },
  made_on: "2026-10-01",
  model_calls: false,
  source_hash: "h",
  ...(kind === "tldr" ? { template_version: TEMPLATE } : {}),
  ...over,
});

let root: string;
const dir = () => path.join(root, SLUG);

function item(id: string, kind: string, over: Record<string, unknown> = {}, files = ["mp4", "webp", "vtt", "txt"]) {
  mkdirSync(dir(), { recursive: true });
  writeFileSync(path.join(dir(), `${id}.media.json`), JSON.stringify(manifest(id, kind, over)));
  for (const ext of files) writeFileSync(path.join(dir(), `${id}.${ext}`), ext === "txt" ? "Title card: Demo" : "x");
}
const freshHash = () => tldrSourceHash({ templateVersion: TEMPLATE, title: TITLE, tldr });

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "fm-tldr-"));
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  errorSpy.mockRestore();
});

describe("readLessonMedia excludes kind tldr (TL-16)", () => {
  it("returns only the section 15 item when a folder holds both", async () => {
    item("walkthrough", "animation");
    item("tldr", "tldr", { source_hash: freshHash() });
    const items = await readLessonMedia(SLUG, root);
    expect(items.map((i) => i.manifest.id)).toEqual(["walkthrough"]);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("returns [] for a folder with only a tldr", async () => {
    item("tldr", "tldr", { source_hash: freshHash() });
    expect(await readLessonMedia(SLUG, root)).toEqual([]);
  });
});

describe("readTldrMedia (TL-8, TL-16)", () => {
  it("returns the item with public URLs and the transcript when the hash is fresh", async () => {
    item("walkthrough", "animation");
    item("tldr", "tldr", { source_hash: freshHash() });
    const v = await readTldrMedia(SLUG, root, { title: TITLE, tldr });
    expect(v).toMatchObject({
      videoUrl: `/media/lessons/${SLUG}/tldr.mp4`,
      posterUrl: `/media/lessons/${SLUG}/tldr.webp`,
      captionsUrl: `/media/lessons/${SLUG}/tldr.vtt`,
      transcript: "Title card: Demo",
    });
    expect(v?.manifest.kind).toBe("tldr");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("returns null without logging when there is no tldr.media.json", async () => {
    item("walkthrough", "animation");
    expect(await readTldrMedia(SLUG, root, { title: TITLE, tldr })).toBeNull();
    expect(await readTldrMedia("l9-none", root, { title: TITLE, tldr })).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("is stale, and logs the slug, when the tldr text changed", async () => {
    item("tldr", "tldr", { source_hash: freshHash() });
    const edited = { ...tldr, points: [tldr.points[0]!, tldr.points[1]!, "A different third point."] } as LessonTldr;
    expect(await readTldrMedia(SLUG, root, { title: TITLE, tldr: edited })).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(`tldr video stale: ${SLUG}`);
  });

  it("is stale when the lesson was retitled, or the manifest hash is wrong", async () => {
    item("tldr", "tldr", { source_hash: freshHash() });
    expect(await readTldrMedia(SLUG, root, { title: "Renamed", tldr })).toBeNull();
    item("tldr", "tldr", { source_hash: "not-the-hash" });
    expect(await readTldrMedia(SLUG, root, { title: TITLE, tldr })).toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });

  it("uses the manifest's own template_version", async () => {
    const other = tldrSourceHash({ templateVersion: 9, title: TITLE, tldr });
    item("tldr", "tldr", { source_hash: other, template_version: 9 });
    expect(await readTldrMedia(SLUG, root, { title: TITLE, tldr })).not.toBeNull();
  });

  it("returns null and logs for an invalid manifest or a missing referenced file", async () => {
    item("tldr", "tldr", { source_hash: freshHash(), duration_s: -1 });
    expect(await readTldrMedia(SLUG, root, { title: TITLE, tldr })).toBeNull();
    item("tldr", "tldr", { source_hash: freshHash() });
    rmSync(path.join(dir(), "tldr.webp"));
    expect(await readTldrMedia(SLUG, root, { title: TITLE, tldr })).toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(String(errorSpy.mock.calls[1]![0])).toContain("tldr.webp");
  });

  it("ignores a manifest named tldr whose kind is not tldr", async () => {
    item("tldr", "animation");
    expect(await readTldrMedia(SLUG, root, { title: TITLE, tldr })).toBeNull();
  });

  it("rejects a bad slug", async () => {
    expect(await readTldrMedia("../etc", root, { title: TITLE, tldr })).toBeNull();
  });
});
