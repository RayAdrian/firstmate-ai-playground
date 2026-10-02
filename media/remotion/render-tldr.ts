// Renders lesson TL;DR videos (PRD §19.5), loaded by render.ts when `--tldr` is passed.
//   npm run media:render -- --tldr                 every lesson that has a `tldr`, only the stale ones
//   npm run media:render -- --tldr <slug> ...      the named lessons (only if stale)
//   --force                                        re-render even if up to date
//   --props <file.json>                            DRAFT tldr props per slug, overriding the lesson files:
//                                                  { "<slug>": { "tldr": {...}, "title"?: "..." } }  (pilot, not committed)
//   --out <dir>                                    output root (default public/media/lessons); files go to <dir>/<slug>/
// Writes tldr.mp4 .webp .vtt .txt .media.json. Fails (exit 1) if a bullet does not fit (naming the lesson slug and bullet
// index), a video is over 400 KiB or a poster over 30 KiB. It never lowers the resolution.
// Run by Node directly (type stripping): relative .ts imports only, no enums.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { spawnSync } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { tldrSourceHash } from "../../src/lib/contracts/tldr-hash.ts";
import { buildBeats, buildTranscript, buildVtt, FPS, HEIGHT, MAX_TOTAL_S, MIN_TOTAL_S, WIDTH } from "./src/tldr/beats.ts";
import type { TldrInput } from "./src/tldr/beats.ts";
import { finalEncode } from "./src/lib/encode.ts";

const here = import.meta.dirname;
const repoRoot = path.resolve(here, "../..");
// Caps from TLDR_MEDIA_CAPS in src/lib/contracts/media.ts (TL-13). Duplicated because Node cannot import that extensionless TS.
const CAPS = { mp4: 400 * 1024, poster: 30 * 1024 };
// Headroom: the ladder aims for this size, so a later tweak does not tip a video over the hard cap. The hard cap still decides pass/fail.
const MP4_TARGET = 380 * 1024;
const CRF_LADDER = [24, 28, 32, 36];
// Mostly static text with short fades: B-frames and more references make the fades cheap (about 20% smaller).
const X264_EXTRA = ["-bf", "8", "-b_strategy", "2", "-refs", "5"];
const POSTER_QUALITY_LADDER = [80, 70, 60, 50];

// ---- args
const argv = process.argv.slice(2).filter((a) => a !== "--" && a !== "--tldr");
let propsFile: string | undefined;
let outRoot = path.join(repoRoot, "public/media/lessons");
let force = false;
const slugs: string[] = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--props") propsFile = path.resolve(argv[++i]);
  else if (argv[i] === "--out") outRoot = path.resolve(argv[++i]);
  else if (argv[i] === "--force") force = true;
  else if (argv[i].startsWith("--")) throw new Error(`Unknown option ${argv[i]}`);
  else slugs.push(argv[i]);
}

// ---- lessons
// Parsed and normalised by the seed's own parser (lessons-normalized.ts, run through the root tsx), so the hash input
// (NFC title, trimmed points) is exactly what the seed and the CI walker hash. Nothing is re-implemented here.
type Lesson = {
  slug: string;
  title: string;
  tool_versions: Record<string, string>;
  tldr: TldrInput | null;
};
const tsx = path.join(repoRoot, "node_modules/.bin/tsx");
if (!fs.existsSync(tsx)) throw new Error("Run `npm ci` at the repo root first: the TL;DR render reads lessons through the seed's parser (tsx)");
const read = spawnSync(tsx, [path.join(here, "../lessons-normalized.ts"), ...(propsFile ? ["--props", propsFile] : [])], {
  cwd: repoRoot, // tsx reads the root tsconfig (the "@/" paths the seed parser uses)
  encoding: "utf8",
  maxBuffer: 1 << 26,
});
if (read.status !== 0) throw new Error(`Could not read the lessons:\n${read.stderr}`);
const parsed = JSON.parse(read.stdout) as { lessons: Record<string, Lesson>; drafts: Record<string, { tldr: TldrInput; title?: string }> };
const lessons = new Map(Object.entries(parsed.lessons));
const overrides = parsed.drafts;
const templateVersion: number = JSON.parse(fs.readFileSync(path.join(here, "src/tldr/template.json"), "utf8")).version;
if (!Number.isInteger(templateVersion) || templateVersion < 1) throw new Error("template.json: version must be a positive integer");

const wanted = slugs.length ? slugs : [...new Set([...lessons.keys(), ...Object.keys(overrides)])];
type Job = { lesson: Lesson; tldr: TldrInput; title: string; hash: string };
const jobs: Job[] = [];
for (const slug of wanted) {
  const lesson = lessons.get(slug);
  if (!lesson) throw new Error(`No lesson with slug ${slug}`);
  const tldr = overrides[slug]?.tldr ?? lesson.tldr;
  if (!tldr) {
    if (slugs.length) throw new Error(`Lesson ${slug} has no tldr (frontmatter or --props)`);
    continue; // skip lessons without tldr
  }
  const title = overrides[slug]?.title ?? lesson.title;
  // The renderer and the hash both take the title exactly as the lesson row carries it (trimmed).
  jobs.push({ lesson, tldr, title, hash: tldrSourceHash({ templateVersion, title, tldr: tldr as never }) });
}

function isFresh(job: Job): boolean {
  const base = path.join(outRoot, job.lesson.slug, "tldr");
  if (!["mp4", "webp", "vtt", "txt", "media.json"].every((ext) => fs.existsSync(`${base}.${ext}`))) return false;
  try {
    const m = JSON.parse(fs.readFileSync(`${base}.media.json`, "utf8"));
    return m.source_hash === job.hash && m.template_version === templateVersion;
  } catch {
    return false;
  }
}

const todo = jobs.filter((j) => {
  const fresh = !force && isFresh(j);
  if (fresh) console.log(`${j.lesson.slug}: up to date, skipped`);
  return !fresh;
});
if (todo.length === 0) {
  console.log(`Nothing to render (${jobs.length} lesson(s) with a tldr, all up to date).`);
} else {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fm-tldr-"));
  const failures: string[] = [];
  console.log(`tldr template v${templateVersion} -> ${outRoot}\nBundling...`);
  const serveUrl = await bundle({
    entryPoint: path.join(here, "src/index.ts"),
    // Satoshi lives in the app's public/fonts; nothing is copied.
    publicDir: path.join(repoRoot, "public/fonts"),
  });
  try {
    for (const job of todo) {
      const { slug } = job.lesson;
      const t0 = Date.now();
      try {
        console.log(`\n== ${slug} ==`);
        const built = buildBeats(job.title, job.tldr); // validates the shape, then the beats
        if (built.duration_s < MIN_TOTAL_S || built.duration_s > MAX_TOTAL_S) {
          throw new Error(`${slug}: duration ${built.duration_s.toFixed(1)} s is outside ${MIN_TOTAL_S}-${MAX_TOTAL_S} s`);
        }
        const inputProps = { slug, title: job.title, tldr: job.tldr };
        // selectComposition runs calculateMetadata, which is where the fit check throws.
        const composition = await selectComposition({ serveUrl, id: "tldr", inputProps });
        const beats = buildBeats(job.title, job.tldr).beats;

        const outDir = path.join(outRoot, slug);
        fs.mkdirSync(outDir, { recursive: true });
        const base = path.join(outDir, "tldr");

        const rawMp4 = path.join(tmp, `${slug}.mp4`);
        await renderMedia({
          composition,
          serveUrl,
          inputProps,
          codec: "h264",
          outputLocation: rawMp4,
          muted: true,
          crf: 8, // near-lossless intermediate; the size-capped encode is the ffmpeg step below
          imageFormat: "jpeg",
          jpegQuality: 100, // jpeg frames give a full-range intermediate, which finalEncode expects
          x264Preset: "slow",
          pixelFormat: "yuv420p",
        });

        // Lowest CRF that meets the target (<= 380 KiB), else the highest CRF tried must still meet the cap. If none does, fail: never silently lower the resolution.
        let mp4Size = Infinity;
        let crfUsed = 0;
        for (const crf of CRF_LADDER) {
          finalEncode(rawMp4, `${base}.mp4`, crf, X264_EXTRA);
          mp4Size = fs.statSync(`${base}.mp4`).size;
          crfUsed = crf;
          if (mp4Size <= MP4_TARGET) break;
        }
        if (mp4Size > CAPS.mp4) throw new Error(`${slug}: tldr.mp4 is ${mp4Size} bytes at CRF ${crfUsed}, over the ${CAPS.mp4} cap`);

        // Poster: the title frame (frame 0).
        const posterPng = path.join(tmp, `${slug}.png`);
        await renderStill({ composition, serveUrl, inputProps, output: posterPng, frame: 0, imageFormat: "png" });
        let posterSize = Infinity;
        for (const quality of POSTER_QUALITY_LADDER) {
          await sharp(posterPng).webp({ quality, effort: 6 }).toFile(`${base}.webp`);
          posterSize = fs.statSync(`${base}.webp`).size;
          if (posterSize <= CAPS.poster) break;
        }
        if (posterSize > CAPS.poster) throw new Error(`${slug}: tldr.webp is ${posterSize} bytes, over the ${CAPS.poster} cap`);

        fs.writeFileSync(`${base}.vtt`, buildVtt(beats));
        fs.writeFileSync(`${base}.txt`, buildTranscript(beats));

        const manifest = {
          id: "tldr",
          lesson_slug: slug,
          kind: "tldr",
          title: `TL;DR: ${job.title}`,
          duration_s: Math.round((composition.durationInFrames / FPS) * 100) / 100,
          width: WIDTH,
          height: HEIGHT,
          tool_versions: job.lesson.tool_versions,
          made_on: new Date().toISOString().slice(0, 10),
          model_calls: false,
          source_hash: job.hash,
          template_version: templateVersion,
        };
        fs.writeFileSync(`${base}.media.json`, `${JSON.stringify(manifest, null, 2)}\n`);
        const secs = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(
          `  ${slug}: mp4 ${mp4Size} B (${(mp4Size / 1024).toFixed(1)} KiB, CRF ${crfUsed}, cap ${CAPS.mp4}), poster ${posterSize} B (${(posterSize / 1024).toFixed(1)} KiB, cap ${CAPS.poster}), ${manifest.duration_s} s long, rendered in ${secs} s`,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  FAILED ${slug}: ${msg}`);
        failures.push(slug);
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  if (failures.length) {
    console.error(`\n${failures.length} lesson(s) failed: ${failures.join(", ")}`);
    process.exitCode = 1;
  }
}
