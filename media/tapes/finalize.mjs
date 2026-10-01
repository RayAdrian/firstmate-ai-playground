// Turns one VHS render into the committed media files (PRD 15.2, MD-5, MD-6).
// Usage (from the repo root, called by record.sh): node media/tapes/finalize.mjs <id>
// Reads media/tapes/out/<id>.{mp4,golden.txt}, <id>.captions.json, <id>.transcript.txt, items.json.
// Writes public/media/lessons/<lesson-slug>/<id>.{mp4,webp,vtt,txt,media.json}, but only after
// every check passes. On any failure it exits non-zero and writes nothing to public/.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildVtt, parseVersion, scanForLeaks, sha256File, validateCues } from "./lib.mjs";

const MP4_CAP = 4 * 1024 * 1024;
const POSTER_CAP = 60 * 1024;

const id = process.argv[2];
const items = JSON.parse(readFileSync("media/tapes/items.json", "utf8"));
const item = items[id];
if (!item) fail(`unknown item "${id}". Known: ${Object.keys(items).join(", ")}`);

const dir = "media/tapes";
const out = `${dir}/out`;
const tape = `${dir}/${id}.tape`;
const rendered = `${out}/${id}.mp4`;
const golden = `${out}/${id}.golden.txt`;
for (const f of [tape, rendered, golden, `${dir}/${id}.captions.json`, `${dir}/${id}.transcript.txt`]) {
  if (!existsSync(f)) fail(`missing ${f}`);
}

function fail(msg) {
  // The goldens and the render are untracked (out/ is gitignored), but a rejected output must
  // not linger on disk either.
  if (id) for (const ext of ["mp4", "golden.txt"]) rmSync(`media/tapes/out/${id}.${ext}`, { force: true });
  console.error(`media:record ${id ?? ""}: ${msg}`);
  process.exit(1);
}

const stage = mkdtempSync(join(tmpdir(), "fm-stage-"));
try {
  // 1. Duration cap.
  const duration = Number(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", rendered], { encoding: "utf8" }),
  );
  if (!(duration > 0) || duration > item.max_duration_s) fail(`duration ${duration}s exceeds the ${item.max_duration_s}s cap`);
  const durationS = Math.round(duration * 10) / 10;

  // 2. Captions.
  const cues = JSON.parse(readFileSync(`${dir}/${id}.captions.json`, "utf8"));
  const cueProblems = validateCues(cues, duration);
  if (cueProblems.length) fail(`captions invalid:\n  ${cueProblems.join("\n  ")}`);

  // 3. Model tape: both replies must be the expected word, or nothing is written.
  const goldenText = readFileSync(golden, "utf8");
  // VHS writes a text snapshot of every captured frame, and frames caught mid-print differ from
  // run to run. Only the final screen is deterministic (PRD 15: "the terminal's final screen"),
  // so that is what the golden becomes. The checks below still scan every frame.
  const frames = goldenText.split(/^─+$/m).map((f) => f.split("\n").map((l) => l.trimEnd()).join("\n").trim());
  const finalFrame = [...frames].reverse().find((f) => f !== "") ?? "";
  writeFileSync(golden, `${finalFrame}\n`);
  if (item.expect_word) {
    const w = item.expect_word;
    if (!goldenText.includes(`"result": "${w}"`) || !goldenText.includes(`"text":"${w}"`)) {
      fail(`a reply was not the expected word "${w}". Nothing written.`);
    }
  }

  // 4. Leak check on every text output (golden, transcript, VTT). Key values come from the env.
  const vtt = buildVtt(cues);
  const transcript = readFileSync(`${dir}/${id}.transcript.txt`, "utf8");
  const secrets = [process.env.ANTHROPIC_API_KEY, process.env.OPENAI_API_KEY, process.env.CODEX_API_KEY];
  const opts = { user: process.env.USER, home: process.env.HOME, secrets };
  for (const [name, text] of [["golden", goldenText], ["vtt", vtt], ["transcript", transcript]]) {
    const findings = scanForLeaks(text, opts);
    if (findings.length) fail(`${name} contains ${findings.join(", ")}. Nothing written.`);
  }

  // 5. Encode (no audio, H.264, web-friendly) and cut the poster.
  const mp4 = join(stage, `${id}.mp4`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", rendered, "-an", "-c:v", "libx264", "-crf", "24", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4]);
  if (statSync(mp4).size > MP4_CAP) fail(`mp4 is ${statSync(mp4).size} bytes, over the 4MB cap`);
  const poster = join(stage, `${id}.webp`);
  let ok = false;
  for (const q of [80, 70, 60, 50, 40, 30]) {
    // Homebrew's ffmpeg has no libwebp encoder, so cut a PNG and encode it with cwebp.
    const png = join(stage, "poster.png");
    execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(Math.max(0, item.poster_at_s ?? duration - 1)), "-i", mp4, "-frames:v", "1", png]);
    execFileSync("cwebp", ["-quiet", "-q", String(q), png, "-o", poster]);
    if (statSync(poster).size <= POSTER_CAP) { ok = true; break; }
  }
  if (!ok) fail("could not get the poster under 60KB");

  // 6. Manifest.
  const versionOf = { claude_code: ["claude", "--version"], codex_cli: ["codex", "--version"] };
  const tool_versions = {};
  const verHome = mkdtempSync(join(tmpdir(), "fm-ver-"));
  mkdirSync(join(verHome, ".codex"), { recursive: true });
  for (const t of item.tools) {
    const [cmd, ...args] = versionOf[t];
    const v = parseVersion(execFileSync(cmd, args, { encoding: "utf8", env: { ...process.env, HOME: verHome, CODEX_HOME: join(verHome, ".codex") } }));
    if (!v) fail(`could not read ${cmd} --version`);
    tool_versions[t] = v;
  }
  rmSync(verHome, { recursive: true, force: true });
  const manifest = {
    id,
    lesson_slug: item.lesson_slug,
    kind: "recording",
    title: item.title,
    duration_s: durationS,
    width: 1280,
    height: 720,
    tool_versions,
    made_on: new Date().toISOString().slice(0, 10),
    model_calls: item.model_calls,
    source_hash: sha256File(tape),
  };

  // 7. Publish: every check passed.
  const dest = `public/media/lessons/${item.lesson_slug}`;
  mkdirSync(dest, { recursive: true });
  copyFileSync(mp4, `${dest}/${id}.mp4`);
  copyFileSync(poster, `${dest}/${id}.webp`);
  writeFileSync(`${dest}/${id}.vtt`, vtt);
  writeFileSync(`${dest}/${id}.txt`, transcript);
  writeFileSync(`${dest}/${id}.media.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`${id}: ${durationS}s, mp4 ${statSync(mp4).size} B, poster ${statSync(poster).size} B -> ${dest}/`);
} finally {
  rmSync(stage, { recursive: true, force: true });
}
