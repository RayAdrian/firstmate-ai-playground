import "server-only";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import type { LessonTldr } from "@/lib/contracts";
import { mediaManifestSchema, type MediaManifest } from "@/lib/contracts/media";
import { tldrSourceHash } from "@/lib/contracts/tldr-hash";

/** One playable item on a lesson page (PRD §15). URLs are public-root relative. */
export type LessonMediaItem = {
  manifest: MediaManifest;
  videoUrl: string;
  posterUrl: string;
  captionsUrl: string;
  transcript: string;
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const URL_BASE = "/media/lessons";
const PUBLIC_ROOT = path.join("public", "media", "lessons");
const FIXTURE_ROOT = path.join("tests", "e2e", "v3", "fixtures", "media", "lessons");
const TL2_FIXTURE_ROOT = path.join("tests", "e2e", "tl2", "fixtures", "media", "lessons");
const TL2_STALE_FIXTURE_ROOT = path.join("tests", "e2e", "tl2", "fixtures", "stale", "lessons");

export const TEST_MEDIA_COOKIE = "fm_test_media";

function skip(file: string, reason: string): void {
  console.error(`[media] skipped ${file}: ${reason}`);
}

/** Checks the four referenced files exist (MD-3) and builds the item. null, with a log line, when one is missing. */
async function finishItem(
  dir: string,
  slug: string,
  manifest: MediaManifest,
  file: string,
): Promise<LessonMediaItem | null> {
  const missing = ["mp4", "webp", "vtt", "txt"].filter((ext) => !existsSync(path.join(dir, `${manifest.id}.${ext}`)));
  if (missing.length > 0) {
    skip(file, `missing file(s): ${missing.map((e) => `${manifest.id}.${e}`).join(", ")}`);
    return null;
  }
  const base = `${URL_BASE}/${slug}/${manifest.id}`;
  return {
    manifest,
    videoUrl: `${base}.mp4`,
    posterUrl: `${base}.webp`,
    captionsUrl: `${base}.vtt`,
    transcript: await readFile(path.join(dir, `${manifest.id}.txt`), "utf8"),
  };
}

/** Parses one manifest and checks it belongs here (folder = lesson_slug, file name = id). Throws on invalid JSON or schema. */
async function readManifest(dir: string, slug: string, name: string): Promise<{ manifest: MediaManifest; file: string } | null> {
  const file = path.join(dir, name);
  const manifest = mediaManifestSchema.parse(JSON.parse(await readFile(file, "utf8")));
  if (manifest.lesson_slug !== slug) {
    skip(file, `lesson_slug "${manifest.lesson_slug}" does not match folder "${slug}"`);
    return null;
  }
  if (name !== `${manifest.id}.media.json`) {
    skip(file, `id "${manifest.id}" does not match file name`);
    return null;
  }
  return { manifest, file };
}

/**
 * Reads and validates every `<id>.media.json` in `<root>/<slug>/` (MD-3). Invalid manifests, a
 * `lesson_slug` that differs from the folder, and missing referenced files are logged and skipped.
 * Never throws. Sorted by id.
 *
 * Manifests of kind "tldr" are never returned (PRD §19, TL-16): they belong to the TL;DR card, so the
 * Watch block cannot list them. `readTldrMedia` reads them.
 */
export async function readLessonMedia(slug: string, root: string): Promise<LessonMediaItem[]> {
  if (!SLUG.test(slug)) return [];
  const dir = path.join(root, slug);
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const items: LessonMediaItem[] = [];
  for (const name of names.filter((n) => n.endsWith(".media.json")).sort()) {
    try {
      const read = await readManifest(dir, slug, name);
      if (!read || read.manifest.kind === "tldr") continue;
      const item = await finishItem(dir, slug, read.manifest, read.file);
      if (item) items.push(item);
    } catch (e) {
      skip(path.join(dir, name), e instanceof Error ? e.message.slice(0, 300) : "unreadable");
    }
  }
  return items.sort((a, b) => (a.manifest.id < b.manifest.id ? -1 : a.manifest.id > b.manifest.id ? 1 : 0));
}

/**
 * The lesson's TL;DR video (PRD §19.5, TL-8), or null. It reads only `tldr.media.json` and its four files.
 * null (the card then renders text only) when there is no manifest, it is invalid or not of kind "tldr", a file
 * is missing, or the video is stale: `tldrSourceHash` of the lesson's current title and `tldr`, with the manifest's
 * own `template_version`, differs from its `source_hash`. A stale video logs `tldr video stale: <slug>`. Never throws.
 */
export async function readTldrMedia(
  slug: string,
  root: string,
  source: { title: string; tldr: LessonTldr },
): Promise<LessonMediaItem | null> {
  if (!SLUG.test(slug)) return null;
  const dir = path.join(root, slug);
  const name = "tldr.media.json";
  if (!existsSync(path.join(dir, name))) return null;
  try {
    const read = await readManifest(dir, slug, name);
    if (!read) return null;
    const { manifest, file } = read;
    if (manifest.kind !== "tldr" || manifest.template_version === undefined) return null;
    const expected = tldrSourceHash({ templateVersion: manifest.template_version, title: source.title, tldr: source.tldr });
    if (expected !== manifest.source_hash) {
      console.error(`tldr video stale: ${slug}`);
      return null;
    }
    return await finishItem(dir, slug, manifest, file);
  } catch (e) {
    skip(path.join(dir, name), e instanceof Error ? e.message.slice(0, 300) : "unreadable");
    return null;
  }
}

async function mediaRoot(): Promise<string> {
  let root = PUBLIC_ROOT;
  if (process.env.FM_TEST_MODE === "1") {
    try {
      const mode = (await cookies()).get(TEST_MEDIA_COOKIE)?.value;
      if (mode === "fixtures") root = FIXTURE_ROOT;
      else if (mode === "tl2") root = TL2_FIXTURE_ROOT;
      else if (mode === "tl2-stale") root = TL2_STALE_FIXTURE_ROOT;
    } catch {
      // no request scope: use the real root
    }
  }
  return path.resolve(process.cwd(), root);
}

/**
 * Media for a lesson. Reads public/media/lessons at request time. Under FM_TEST_MODE=1 (e2e only),
 * the `fm_test_media=fixtures` cookie reads tests/e2e/v3/fixtures/media instead (`tl2`: tests/e2e/tl2/fixtures/media, `tl2-stale`: .../stale),
 * so e2e never needs files in public/.
 */
export async function getLessonMedia(slug: string): Promise<LessonMediaItem[]> {
  return readLessonMedia(slug, await mediaRoot());
}

/** The lesson's fresh TL;DR video, or null (see `readTldrMedia`). Same root rules as `getLessonMedia`. */
export async function getTldrMedia(
  slug: string,
  source: { title: string; tldr: LessonTldr },
): Promise<LessonMediaItem | null> {
  return readTldrMedia(slug, await mediaRoot(), source);
}
