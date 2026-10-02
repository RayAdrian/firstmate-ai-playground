// Renders every composition in src/<id>/steps.json (or only the ids given as arguments).
//   npm run media:render              all items
//   npm run media:render -- <id> ...  selected items
//   npm run media:render -- --tldr [slug ...] [--force] [--props file.json] [--out dir]   TL;DR videos (render-tldr.ts)
// Output per item, in public/media/lessons/<lesson_slug>/: <id>.mp4 .webp .vtt .txt .media.json (PRD 15.2, MD-4).
// Run by Node directly (type stripping); keep imports as relative .ts files and avoid enums.
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { buildVtt, validateSteps } from "./src/lib/vtt.ts";
import type { StepsFile } from "./src/lib/vtt.ts";
import { finalEncode } from "./src/lib/encode.ts";

const here = import.meta.dirname;
const repoRoot = path.resolve(here, "../..");
const srcDir = path.join(here, "src");
const outRoot = path.join(repoRoot, "public/media/lessons");

// Caps from src/lib/contracts/media.ts (MD-6); tests/unit/v1 enforces the real MEDIA_CAPS, so drift is caught there.
// Caps from src/lib/contracts/media.ts (MD-6). Duplicated here because Node cannot import that extensionless TS.
const CAPS = { mp4: 4 * 1024 * 1024, poster: 60 * 1024 };

const CRF = 24;

// TL;DR videos (PRD §19.5) have their own script: npm run media:render -- --tldr [slug ...]
if (process.argv.includes("--tldr")) {
  await import("./render-tldr.ts");
  process.exit(process.exitCode ?? 0);
}

const wanted = process.argv.slice(2).filter((a) => a !== "--");
const items = fs
  .readdirSync(srcDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && fs.existsSync(path.join(srcDir, e.name, "steps.json")))
  .map((e) => e.name)
  .filter((id) => wanted.length === 0 || wanted.includes(id));

if (items.length === 0) {
  console.error(`No matching items. Known: ${fs.readdirSync(srcDir).join(", ")}`);
  process.exit(1);
}

function lessonToolVersions(slug: string): { claude_code: string; codex_cli: string } {
  const lessonsDir = path.join(repoRoot, "content/lessons");
  for (const level of fs.readdirSync(lessonsDir)) {
    const dir = path.join(lessonsDir, level);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".md"))) {
      const text = fs.readFileSync(path.join(dir, f), "utf8");
      const front = text.split(/^---\s*$/m)[1] ?? "";
      if (!new RegExp(`^slug:\\s*${slug}\\s*$`, "m").test(front)) continue;
      const claude = front.match(/^\s+claude_code:\s*"?([^"\n]+)"?\s*$/m)?.[1];
      const codex = front.match(/^\s+codex_cli:\s*"?([^"\n]+)"?\s*$/m)?.[1];
      if (!claude || !codex) throw new Error(`${f}: tool_versions not found in frontmatter`);
      return { claude_code: claude, codex_cli: codex };
    }
  }
  throw new Error(`No lesson with slug ${slug}`);
}

function sha256(file: string) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fm-remotion-"));
console.log("Bundling...");
const serveUrl = await bundle({
  entryPoint: path.join(srcDir, "index.ts"),
  // Satoshi lives in the app's public/fonts; nothing is copied.
  publicDir: path.join(repoRoot, "public/fonts"),
});

try {
  for (const id of items) {
    const stepsPath = path.join(srcDir, id, "steps.json");
    const transcriptPath = path.join(srcDir, id, "transcript.txt");
    const steps: StepsFile = JSON.parse(fs.readFileSync(stepsPath, "utf8"));
    if (steps.id !== id) throw new Error(`${stepsPath}: id "${steps.id}" must equal its folder name`);
    const problems = validateSteps(steps);
    if (problems.length) throw new Error(`${stepsPath}:\n  ${problems.join("\n  ")}`);
    if (!fs.existsSync(transcriptPath)) throw new Error(`Missing ${transcriptPath} (hand-written, MD-4)`);

    const outDir = path.join(outRoot, steps.lesson_slug);
    fs.mkdirSync(outDir, { recursive: true });
    const base = path.join(outDir, id);

    console.log(`\n== ${id} (${steps.duration_s}s) ==`);
    const composition = await selectComposition({ serveUrl, id });

    // MP4: H.264, yuv420p, no audio track.
    const rawMp4 = path.join(tmp, `${id}.mp4`);
    let lastPct = -1;
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: rawMp4,
      muted: true,
      crf: 8, // near-lossless intermediate; the size-capped encode is the ffmpeg step below
      imageFormat: "jpeg",
      jpegQuality: 100, // frames are jpeg, so the intermediate is full-range yuvj420p (the ffmpeg step relies on that)
      x264Preset: "slow",
      pixelFormat: "yuv420p",
      onProgress: ({ progress }) => {
        const pct = Math.floor(progress * 10) * 10;
        if (pct !== lastPct) {
          lastPct = pct;
          process.stdout.write(`  render ${pct}%\r`);
        }
      },
    });
    // Final encode: limited-range yuv420p (Remotion's own output is full-range "yuvj420p", which some players render with
    // washed-out colours), faststart so playback can begin before the file arrives, and no audio track (MD-2).
    finalEncode(rawMp4, `${base}.mp4`, CRF);

    // Poster: one still. Remotion cannot set WebP quality, so render a PNG and encode it with sharp (bundled libwebp).
    const posterPng = path.join(tmp, `${id}.png`);
    await renderStill({ composition, serveUrl, output: posterPng, frame: Math.round(steps.poster_s * steps.fps), imageFormat: "png" });
    await sharp(posterPng).webp({ quality: 80, effort: 6 }).toFile(`${base}.webp`);

    fs.writeFileSync(`${base}.vtt`, buildVtt(steps.steps));
    fs.copyFileSync(transcriptPath, `${base}.txt`);

    const mp4Size = fs.statSync(`${base}.mp4`).size;
    const posterSize = fs.statSync(`${base}.webp`).size;
    if (mp4Size > CAPS.mp4) throw new Error(`${id}.mp4 is ${mp4Size} bytes, over the ${CAPS.mp4} cap. Raise crf or simplify.`);
    if (posterSize > CAPS.poster) throw new Error(`${id}.webp is ${posterSize} bytes, over the ${CAPS.poster} cap.`);

    const manifest = {
      id,
      lesson_slug: steps.lesson_slug,
      kind: "animation",
      title: steps.title,
      duration_s: steps.duration_s,
      width: steps.width,
      height: steps.height,
      tool_versions: lessonToolVersions(steps.lesson_slug),
      made_on: new Date().toISOString().slice(0, 10),
      model_calls: false,
      // sha256 hex of the raw bytes of steps.json (MD-7).
      source_hash: sha256(stepsPath),
    };
    fs.writeFileSync(`${base}.media.json`, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`  mp4 ${(mp4Size / 1024).toFixed(0)} KB, poster ${(posterSize / 1024).toFixed(1)} KB -> ${path.relative(repoRoot, outDir)}`);
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
