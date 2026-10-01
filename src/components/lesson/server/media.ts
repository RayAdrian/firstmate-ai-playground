import "server-only";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { mediaManifestSchema, type MediaManifest } from "@/lib/contracts/media";

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
const FIXTURE_ROOT = path.join("tests", "fixtures", "media", "lessons");

export const TEST_MEDIA_COOKIE = "fm_test_media";

function skip(file: string, reason: string): void {
  console.error(`[media] skipped ${file}: ${reason}`);
}

/**
 * Reads and validates every `<id>.media.json` in `<root>/<slug>/` (MD-3). Invalid manifests, a
 * `lesson_slug` that differs from the folder, and missing referenced files are logged and skipped.
 * Never throws. Sorted by id.
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
    const file = path.join(dir, name);
    try {
      const manifest = mediaManifestSchema.parse(JSON.parse(await readFile(file, "utf8")));
      if (manifest.lesson_slug !== slug) {
        skip(file, `lesson_slug "${manifest.lesson_slug}" does not match folder "${slug}"`);
        continue;
      }
      if (name !== `${manifest.id}.media.json`) {
        skip(file, `id "${manifest.id}" does not match file name`);
        continue;
      }
      const missing = ["mp4", "webp", "vtt", "txt"].filter(
        (ext) => !existsSync(path.join(dir, `${manifest.id}.${ext}`)),
      );
      if (missing.length > 0) {
        skip(file, `missing file(s): ${missing.map((e) => `${manifest.id}.${e}`).join(", ")}`);
        continue;
      }
      const base = `${URL_BASE}/${slug}/${manifest.id}`;
      items.push({
        manifest,
        videoUrl: `${base}.mp4`,
        posterUrl: `${base}.webp`,
        captionsUrl: `${base}.vtt`,
        transcript: await readFile(path.join(dir, `${manifest.id}.txt`), "utf8"),
      });
    } catch (e) {
      skip(file, e instanceof Error ? e.message.slice(0, 300) : "unreadable");
    }
  }
  return items.sort((a, b) => (a.manifest.id < b.manifest.id ? -1 : a.manifest.id > b.manifest.id ? 1 : 0));
}

/**
 * Media for a lesson. Reads public/media/lessons at request time. Under FM_TEST_MODE=1 (e2e only),
 * the `fm_test_media=fixtures` cookie reads tests/fixtures/media instead, so e2e never needs files in public/.
 */
export async function getLessonMedia(slug: string): Promise<LessonMediaItem[]> {
  let root = PUBLIC_ROOT;
  if (process.env.FM_TEST_MODE === "1") {
    try {
      if ((await cookies()).get(TEST_MEDIA_COOKIE)?.value === "fixtures") root = FIXTURE_ROOT;
    } catch {
      // no request scope: use the real root
    }
  }
  return readLessonMedia(slug, path.resolve(process.cwd(), root));
}
