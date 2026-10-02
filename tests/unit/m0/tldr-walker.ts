// MD-6 walker extension for TL;DR videos (PRD §19, TL-11 to TL-13). Used by media-assets.test.ts on the
// committed tree and by tests/unit/tl0/ on temporary fixtures.
import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { TLDR_MEDIA_CAPS, lessonTldrSchema, mediaManifestSchema, tldrSourceHash } from "@/lib/contracts";

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

/** slug -> { title, tldr } for every lesson file that parses. */
export function readLessonTldrs(lessonsDir: string): Map<string, { title: string; tldr: unknown }> {
  const out = new Map<string, { title: string; tldr: unknown }>();
  for (const f of walk(lessonsDir).filter((f) => f.endsWith(".md"))) {
    const text = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
    if (!text.startsWith("---\n")) continue;
    const end = text.indexOf("\n---", 4);
    if (end === -1) continue;
    const fm = parse(text.slice(4, end)) as { slug?: string; title?: string; tldr?: unknown } | null;
    if (fm?.slug && fm.title) out.set(fm.slug, { title: fm.title.normalize("NFC"), tldr: fm.tldr });
  }
  return out;
}

/** Returns one message per problem; an empty array means the TL;DR media under `mediaRoot` is fresh and within caps. */
export function checkTldrMedia(opts: { mediaRoot: string; lessonsDir: string; templatePath: string }): string[] {
  const problems: string[] = [];
  const manifests = walk(opts.mediaRoot).filter((f) => path.basename(f) === "tldr.media.json");
  if (manifests.length === 0) return problems;

  let templateVersion: number | null = null;
  try {
    const t = JSON.parse(fs.readFileSync(opts.templatePath, "utf8")) as { version?: unknown };
    if (Number.isInteger(t.version)) templateVersion = t.version as number;
  } catch {
    /* reported below */
  }
  if (templateVersion === null) problems.push(`${opts.templatePath}: missing or has no integer "version"`);

  const lessons = readLessonTldrs(opts.lessonsDir);
  for (const f of manifests) {
    const dir = path.dirname(f);
    const slug = path.basename(dir);
    const cmd = `npm run media:render -- --tldr ${slug}`;
    const parsed = mediaManifestSchema.safeParse(JSON.parse(fs.readFileSync(f, "utf8")));
    if (!parsed.success) {
      problems.push(`${slug}: tldr.media.json invalid: ${parsed.error.message}`);
      continue;
    }
    const m = parsed.data;
    if (m.kind !== "tldr" || m.id !== "tldr") problems.push(`${slug}: tldr.media.json must have id and kind "tldr"`);
    if (m.model_calls !== false) problems.push(`${slug}: model_calls must be false`);
    if (m.width !== 1280 || m.height !== 720) problems.push(`${slug}: must be 1280x720`);
    if (m.duration_s < 30 || m.duration_s > 45) problems.push(`${slug}: duration_s ${m.duration_s} outside 30-45`);

    const mp4 = path.join(dir, "tldr.mp4");
    const webp = path.join(dir, "tldr.webp");
    if (fs.existsSync(mp4) && fs.statSync(mp4).size > TLDR_MEDIA_CAPS.mp4) problems.push(`${slug}: tldr.mp4 over ${TLDR_MEDIA_CAPS.mp4} B`);
    if (fs.existsSync(webp) && fs.statSync(webp).size > TLDR_MEDIA_CAPS.poster) problems.push(`${slug}: tldr.webp over ${TLDR_MEDIA_CAPS.poster} B`);

    const lesson = lessons.get(slug);
    const tldr = lessonTldrSchema.safeParse(lesson?.tldr);
    if (!lesson || !tldr.success) {
      problems.push(`${slug}: tldr.media.json exists but the lesson has no valid tldr (${cmd} after fixing, or delete the video)`);
      continue;
    }
    if (templateVersion !== null && m.template_version !== templateVersion) {
      problems.push(`${slug}: template_version ${m.template_version} differs from template.json ${templateVersion}; run ${cmd}`);
    }
    const expected = tldrSourceHash({ templateVersion: m.template_version ?? -1, title: lesson.title, tldr: tldr.data });
    if (expected !== m.source_hash) problems.push(`${slug}: TL;DR video is stale; run ${cmd}`);
  }
  return problems;
}
