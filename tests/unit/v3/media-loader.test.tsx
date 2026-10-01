import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { MediaBlock } from "@/components/lesson/media-block";
import { readLessonMedia } from "@/components/lesson/server/media";

const manifest = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  lesson_slug: "l9-demo",
  kind: "recording",
  title: `Title ${id}`,
  duration_s: 10,
  width: 1280,
  height: 720,
  tool_versions: { claude_code: "2.1.0" },
  made_on: "2026-10-01",
  model_calls: false,
  source_hash: "h",
  ...over,
});

let root: string;
const dir = () => path.join(root, "l9-demo");

function item(id: string, over: Record<string, unknown> = {}, files = ["mp4", "webp", "vtt", "txt"]) {
  mkdirSync(dir(), { recursive: true });
  writeFileSync(path.join(dir(), `${id}.media.json`), JSON.stringify(manifest(id, over)));
  for (const ext of files) writeFileSync(path.join(dir(), `${id}.${ext}`), ext === "txt" ? "Transcript <b>x</b>" : "x");
}

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "fm-media-"));
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  errorSpy.mockRestore();
});

describe("readLessonMedia (MD-1, MD-3)", () => {
  it("returns [] for a lesson with no folder", async () => {
    expect(await readLessonMedia("l9-demo", root)).toEqual([]);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("returns items in id order with public URLs and the transcript", async () => {
    item("b-second");
    item("a-first");
    const items = await readLessonMedia("l9-demo", root);
    expect(items.map((i) => i.manifest.id)).toEqual(["a-first", "b-second"]);
    expect(items[0]).toMatchObject({
      videoUrl: "/media/lessons/l9-demo/a-first.mp4",
      posterUrl: "/media/lessons/l9-demo/a-first.webp",
      captionsUrl: "/media/lessons/l9-demo/a-first.vtt",
      transcript: "Transcript <b>x</b>",
    });
  });

  it("skips an invalid manifest, logging the path and reason, and keeps the good one", async () => {
    item("good");
    item("bad", { duration_s: -1 });
    const items = await readLessonMedia("l9-demo", root);
    expect(items.map((i) => i.manifest.id)).toEqual(["good"]);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0]![0])).toContain(path.join("l9-demo", "bad.media.json"));
  });

  it("skips unparseable JSON without throwing", async () => {
    mkdirSync(dir(), { recursive: true });
    writeFileSync(path.join(dir(), "junk.media.json"), "{nope");
    expect(await readLessonMedia("l9-demo", root)).toEqual([]);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("skips a manifest that points at a missing file", async () => {
    item("nopost", {}, ["mp4", "vtt", "txt"]);
    expect(await readLessonMedia("l9-demo", root)).toEqual([]);
    expect(String(errorSpy.mock.calls[0]![0])).toContain("nopost.webp");
  });

  it("skips a lesson_slug that does not match its folder", async () => {
    item("moved", { lesson_slug: "l1-other" });
    expect(await readLessonMedia("l9-demo", root)).toEqual([]);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("rejects path-traversal slugs", async () => {
    expect(await readLessonMedia("../x", root)).toEqual([]);
  });
});

describe("MediaBlock (MD-1, MD-2)", () => {
  it("renders nothing for no items", () => {
    const { container } = render(<MediaBlock items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the player attributes, caption track and plain-text transcript", async () => {
    item("a-first");
    const items = await readLessonMedia("l9-demo", root);
    const { container } = render(<MediaBlock items={items} />);
    expect(screen.getByRole("heading", { level: 3, name: "Watch: Title a-first" })).toBeInTheDocument();
    const video = container.querySelector("video")!;
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("preload", "none");
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveAttribute("width", "1280");
    expect(video).toHaveAttribute("height", "720");
    expect(video).not.toHaveAttribute("autoplay");
    expect(video.style.aspectRatio).toBe("1280 / 720");
    const track = video.querySelector("track")!;
    expect(track).toHaveAttribute("kind", "captions");
    expect(track).toHaveAttribute("srclang", "en");
    expect(track).toHaveAttribute("default");
    expect(screen.getByText("Transcript")).toBeInTheDocument();
    expect(container.querySelector("details b")).toBeNull();
    expect(container.querySelector("details")).toHaveTextContent("Transcript <b>x</b>");
  });
});
