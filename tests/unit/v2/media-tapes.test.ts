import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { mediaManifestSchema } from "@/lib/contracts";
import { buildVtt, scanForLeaks, sha256File, validateCues, vttTime, parseVersion } from "../../../media/tapes/lib.mjs";

const repo = path.resolve(__dirname, "../../..");
const tapes = path.join(repo, "media/tapes");
const items = JSON.parse(fs.readFileSync(path.join(tapes, "items.json"), "utf8")) as Record<
  string,
  { lesson_slug: string; model_calls: boolean; max_duration_s: number }
>;
const ids = Object.keys(items);
const read = (p: string) => fs.readFileSync(p, "utf8");

describe("tape sources (MD-5)", () => {
  it("covers the three pilot recordings", () => {
    expect(ids.sort()).toEqual(["l1-first-session", "l3-headless-agents", "l4-mcp-servers"]);
  });

  it.each(ids)("%s has a tape, captions and transcript, with a fixed look and a golden", (id) => {
    for (const ext of ["tape", "captions.json", "transcript.txt"]) {
      expect(fs.existsSync(path.join(tapes, `${id}.${ext}`)), ext).toBe(true);
    }
    const tape = read(path.join(tapes, `${id}.tape`));
    expect(tape).toContain("Source media/tapes/common.tape");
    expect(tape).toContain(`Output media/tapes/out/${id}.golden.txt`);
    expect(tape).toContain(`Output media/tapes/out/${id}.mp4`);
    const common = read(path.join(tapes, "common.tape"));
    expect(common).toMatch(/Set Width 1280/);
    expect(common).toMatch(/Set Height 720/);
    expect(common).toMatch(/Set FontSize \d+/);
    expect(common).toContain("#0f1729"); // --fm-code-bg
    expect(common).toContain("#e6edf3"); // --fm-code-fg
    // Every tape swaps to a clean shell on the throwaway HOME and CODEX_HOME.
    expect(tape).toContain("HOME=/tmp/fm/home");
    expect(tape).toContain("CODEX_HOME=/tmp/fm/home/.codex");
  });

  it("only the model tape sees API keys, and only by variable name inside Hide", () => {
    for (const id of ids) {
      const tape = read(path.join(tapes, `${id}.tape`));
      const code = tape.split("\n").filter((l) => !l.trim().startsWith("#"));
      const keyLines = code.filter((l) => /API_KEY/.test(l));
      if (id !== "l3-headless-agents") {
        expect(keyLines, id).toEqual([]);
        continue;
      }
      expect(keyLines.length).toBeGreaterThan(0);
      // Walk the tape: every key line must be inside a Hide ... Show span.
      let hidden = false;
      for (const l of code) {
        if (/^Hide\b/.test(l)) hidden = true;
        else if (/^Show\b/.test(l)) hidden = false;
        else if (/API_KEY/.test(l)) expect(hidden, `key reference shown: ${l}`).toBe(true);
      }
      expect(code.join("\n")).not.toMatch(/sk-/);
      expect(code.join("\n")).toContain('--tools ""');
      expect(code.join("\n")).toContain("--sandbox read-only");
      expect(code.join("\n")).toContain("--with-api-key");
    }
  });

  it("no-model tapes make no model call", () => {
    for (const id of ids.filter((i) => !items[i].model_calls)) {
      const tape = read(path.join(tapes, `${id}.tape`));
      expect(tape).not.toMatch(/claude -p|codex exec|--print/);
    }
  });

  it.each(ids)("%s captions are well formed and fit the duration cap", (id) => {
    const cues = JSON.parse(read(path.join(tapes, `${id}.captions.json`)));
    expect(validateCues(cues, items[id].max_duration_s)).toEqual([]);
  });
});

describe("helpers", () => {
  it("formats WebVTT times and builds a valid file", () => {
    expect(vttTime(0)).toBe("00:00:00.000");
    expect(vttTime(61.5)).toBe("00:01:01.500");
    expect(buildVtt([{ start: 0.5, end: 2, text: "Hello" }])).toBe(
      "WEBVTT\n\n1\n00:00:00.500 --> 00:00:02.000\nHello\n",
    );
  });

  it("flags bad cues", () => {
    expect(validateCues([{ start: 2, end: 1, text: "x" }])).not.toEqual([]);
    expect(
      validateCues([
        { start: 0, end: 3, text: "a" },
        { start: 2, end: 4, text: "b" },
      ]),
    ).not.toEqual([]);
    expect(validateCues([{ start: 0, end: 50, text: "a" }], 40)).not.toEqual([]);
  });

  it("scanForLeaks finds emails, user, home, key prefixes and literal keys, but not a bare @", () => {
    const opts = { user: "someone", home: "/Users/someone", secrets: ["abcd1234efgh5678"] };
    expect(scanForLeaks("npm i @modelcontextprotocol/server-filesystem", opts)).toEqual([]);
    expect(scanForLeaks("mail a.b@example.com", opts)).toHaveLength(1);
    expect(scanForLeaks("path /Users/someone/x", opts).length).toBeGreaterThan(0);
    expect(scanForLeaks("by someone", opts)).toHaveLength(1);
    expect(scanForLeaks("key sk-ant-xyz", opts).length).toBeGreaterThan(0);
    expect(scanForLeaks("key sk-proj123", opts)).toHaveLength(1);
    expect(scanForLeaks("v abcd1234efgh5678", opts)).toEqual(["a literal API key value"]);
  });

  it("parses CLI versions", () => {
    expect(parseVersion("2.1.286 (Claude Code)")).toBe("2.1.286");
    expect(parseVersion("codex-cli 0.154.0")).toBe("0.154.0");
  });
});

describe("every media/tapes artifact is clean (MD-5)", () => {
  const sources = fs
    .readdirSync(tapes)
    .filter((f) => /\.(tape|captions\.json|transcript\.txt)$/.test(f) || f === "items.json");
  const outDir = path.join(tapes, "out");
  const leftovers = fs.existsSync(outDir) ? fs.readdirSync(outDir).filter((f) => f.endsWith(".txt")) : [];

  it("scans sources, plus any golden present on disk, for personal data and keys", () => {
    const opts = { user: process.env.USER, home: process.env.HOME };
    expect(sources.length).toBeGreaterThan(8);
    for (const f of sources) expect(scanForLeaks(read(path.join(tapes, f)), opts), f).toEqual([]);
    for (const f of leftovers) expect(scanForLeaks(read(path.join(outDir, f)), opts), `out/${f}`).toEqual([]);
  });

  it("keeps out/ untracked, so a rejected golden can never be committed", () => {
    const ignore = read(path.join(tapes, ".gitignore"));
    expect(ignore).toMatch(/^out\/\*$/m);
    expect(ignore).not.toMatch(/^!out\//m);
  });

  it("no tape waits with a fixed Sleep after a command: every Enter in a visible step is followed by a Wait", () => {
    for (const id of ids) {
      const lines = read(path.join(tapes, `${id}.tape`)).split("\n").filter((l) => !l.startsWith("#"));
      let hidden = false;
      lines.forEach((l, i) => {
        if (/^Hide\b/.test(l)) hidden = true;
        if (/^Show\b/.test(l)) hidden = false;
        if (!hidden && /^Enter\b/.test(l)) expect(lines[i + 1], `${id}: line after Enter`).toMatch(/^Wait/);
      });
    }
  });
});

describe("committed v2 outputs", () => {
  const committed = ids.filter((id) =>
    fs.existsSync(path.join(repo, "public/media/lessons", items[id].lesson_slug, `${id}.media.json`)),
  );

  it("has the two no-model items committed", () => {
    expect(committed).toEqual(expect.arrayContaining(["l1-first-session", "l4-mcp-servers"]));
  });

  it.each(committed)("%s: manifest matches the tape, outputs are clean", (id) => {
    const dir = path.join(repo, "public/media/lessons", items[id].lesson_slug);
    const manifest = mediaManifestSchema.parse(JSON.parse(read(path.join(dir, `${id}.media.json`))));
    expect(manifest.kind).toBe("recording");
    expect(manifest.model_calls).toBe(items[id].model_calls);
    expect(manifest.duration_s).toBeLessThanOrEqual(items[id].max_duration_s);
    expect(manifest.source_hash).toBe(sha256File(path.join(tapes, `${id}.tape`)));
    expect(manifest.width).toBe(1280);
    expect(manifest.height).toBe(720);
    // Captions (VTT) come from the same captions.json.
    const cues = JSON.parse(read(path.join(tapes, `${id}.captions.json`)));
    expect(read(path.join(dir, `${id}.vtt`))).toBe(buildVtt(cues));
    expect(validateCues(cues, manifest.duration_s)).toEqual([]);
    // Transcript is the hand-written file, copied through.
    expect(read(path.join(dir, `${id}.txt`))).toBe(read(path.join(tapes, `${id}.transcript.txt`)));
    // No personal data in any text output. $USER and $HOME come from this process.
    const opts = { user: process.env.USER, home: process.env.HOME };
    for (const f of [
      path.join(dir, `${id}.vtt`),
      path.join(dir, `${id}.txt`),
      path.join(dir, `${id}.media.json`),
    ]) {
      expect(scanForLeaks(read(f), opts), f).toEqual([]);
    }
  });
});
