// @vitest-environment node
// PRD §19.5 / TL-10: the TL;DR template's beat, cue, duration and fit logic (pure modules; the render itself is checked on the pilot).
import { describe, expect, it } from "vitest";
import { buildBeats, buildTranscript, buildVtt, panelDwell, pointDwell } from "../../../media/remotion/src/tldr/beats";
import type { TldrInput } from "../../../media/remotion/src/tldr/beats";
import { fitCode, fitPoint, fitRecapCode, fitRecapPoint, fitTitle, parseInline, wrapRich } from "../../../media/remotion/src/tldr/wrap";
import type { Measure } from "../../../media/remotion/src/tldr/wrap";
import template from "../../../media/remotion/src/tldr/template.json";

// Fake measurer: 0.5 em per Satoshi glyph, 0.6 em per mono glyph. Deterministic, no browser.
const fake: Measure = (text, code, size) => text.length * size * (code ? 0.6 : 0.5);

const chars = (n: number) => "word ".repeat(Math.ceil(n / 5)).slice(0, n).trim();
const minAll: TldrInput = {
  points: [chars(10), chars(11), chars(12)],
  try_this: { all: { kind: "command", text: "ls" } },
};
const maxAll: TldrInput = {
  points: [chars(100), chars(99), chars(98)],
  try_this: { all: { kind: "prompt", text: chars(120) } },
};
const minTool: TldrInput = {
  points: [chars(10), chars(11), chars(12)],
  try_this: { claude: { kind: "command", text: "ls" }, codex: { kind: "command", text: "ls" } },
};
const maxTool: TldrInput = {
  points: [chars(100), chars(99), chars(98)],
  try_this: { claude: { kind: "prompt", text: chars(120) }, codex: { kind: "prompt", text: chars(120) } },
};
const example: TldrInput = {
  points: [
    "An agent is a model in a loop: ask, edit, approve, verify.",
    "Approval prompts are your brake. Learn what triggers them before you speed up.",
    "Commit before you start, so `git` can undo anything the agent did.",
  ],
  try_this: { all: { kind: "command", text: "claude --version && codex --version" } },
};

describe("template version", () => {
  it("is a positive integer", () => {
    expect(Number.isInteger(template.version)).toBe(true);
    expect(template.version).toBeGreaterThan(0);
  });
});

describe("beats and durations (TL-10)", () => {
  it.each([
    ["min all", minAll],
    ["max all", maxAll],
    ["min per-tool", minTool],
    ["max per-tool", maxTool],
    ["PRD example", example],
  ])("%s lands in 30-45 s", (_n, t) => {
    const { duration_s, beats, frames } = buildBeats("A lesson title", t);
    expect(duration_s).toBeGreaterThanOrEqual(30);
    expect(duration_s).toBeLessThanOrEqual(45);
    expect(frames).toBe(Math.round(duration_s * 30));
    expect(beats[0].start_s).toBe(0);
    for (let i = 1; i < beats.length; i++) expect(beats[i].start_s).toBeCloseTo(beats[i - 1].end_s, 9);
  });

  it("matches the DESIGN storyboard for 1.1: 30.6 s, 918 frames, beats at 3.0 / 9.0 / 16.2 / 22.6 / 28.6", () => {
    const { beats, duration_s, frames } = buildBeats("Your first agent session", example);
    expect(frames).toBe(918);
    expect(duration_s).toBeCloseTo(30.6, 6);
    expect(beats.map((b) => +b.start_s.toFixed(1))).toEqual([0, 3, 9, 16.2, 22.6, 28.6]);
  });

  it("the maxima are 45.0 s per tool and 41 s shared, as in PRD §19.5", () => {
    expect(buildBeats("t", maxTool).duration_s).toBeCloseTo(3 + 3 * pointDwell(100) + 2 * panelDwell(120) + 2, 0);
    expect(buildBeats("t", maxTool).duration_s).toBeLessThanOrEqual(45);
    expect(buildBeats("t", maxAll).duration_s).toBeLessThanOrEqual(41.1);
  });

  it("a per-tool try_this makes two Try-this beats, a shared one makes one", () => {
    expect(buildBeats("t", minTool).beats.filter((b) => b.kind === "try")).toHaveLength(2);
    expect(buildBeats("t", minAll).beats.filter((b) => b.kind === "try")).toHaveLength(1);
  });

  it("pads the recap so the video is at least 30 s", () => {
    const { beats } = buildBeats("t", minAll);
    const recap = beats[beats.length - 1];
    expect(recap.end_s).toBe(30);
    expect(recap.end_s - recap.start_s).toBeGreaterThan(2);
  });

  it("rejects a malformed tldr", () => {
    expect(() => buildBeats("t", { points: ["a"], try_this: { all: { kind: "command", text: "x" } } })).toThrow(/exactly 3/);
  });
});

describe("captions and transcript (TL-10)", () => {
  it("VTT cues are the fixed signposts, each at most 32 characters", () => {
    const cues = buildBeats("t", maxTool).beats.map((b) => b.cue);
    expect(cues).toEqual([
      "TL;DR: 3 points, 1 thing to try",
      "Point 1 of 3",
      "Point 2 of 3",
      "Point 3 of 3",
      "Try this in Claude Code",
      "Try this in Codex CLI",
      "Recap",
    ]);
    expect(Math.max(...cues.map((c) => c.length))).toBeLessThanOrEqual(32);
    expect(buildBeats("t", minAll).beats.map((b) => b.cue)).toContain("Try this");
  });

  it("builds a WEBVTT file with one cue per beat", () => {
    const { beats } = buildBeats("t", example);
    const vtt = buildVtt(beats);
    expect(vtt.startsWith("WEBVTT\n\n1\n00:00:00.000 --> 00:00:03.000\nTL;DR: 3 points, 1 thing to try")).toBe(true);
    expect(vtt.match(/-->/g)).toHaveLength(beats.length);
  });

  it("the transcript carries each beat's full text", () => {
    const { beats } = buildBeats("Your first agent session", example);
    const txt = buildTranscript(beats);
    expect(txt).toContain("Title card: Your first agent session");
    for (const p of example.points) expect(txt).toContain(p);
    expect(txt).toContain("Try this (command): claude --version && codex --version");
  });
});

describe("fit check (§19.5)", () => {
  it("parses inline code spans", () => {
    expect(parseInline("so `git` can")).toEqual([
      { text: "so ", code: false },
      { text: "git", code: true },
      { text: " can", code: false },
    ]);
  });

  it("uses 56/68 when a bullet fits 3 lines at 56 px", () => {
    const f = fitPoint("l1-first-session", 0, example.points[0], fake);
    expect(f.size).toBe(56);
    expect(f.lineHeight).toBe(68);
    expect(f.lines.length).toBeLessThanOrEqual(3);
  });

  it("steps down to 48/60 when 3 lines won't hold it at 56 px", () => {
    // 1080 px box: 38 chars/line at 56 px (28 px per glyph) and 45 at 48 px (24 px per glyph) with the fake measurer.
    const text = chars(125);
    expect(wrapRich(text, { size: 56, width: 1080, measure: fake }).length).toBeGreaterThan(3);
    const f = fitPoint("slug", 1, text, fake);
    expect(f.size).toBe(48);
    expect(f.lineHeight).toBe(60);
    expect(f.lines.length).toBeLessThanOrEqual(3);
  });

  it("FAILS on an over-long bullet, naming the lesson slug and the bullet index", () => {
    const text = chars(180);
    expect(() => fitPoint("l9-too-wordy", 2, text, fake)).toThrowError(/"l9-too-wordy".*bullet index 2.*maximum is 3/);
  });

  it("splits one over-wide token by character instead of overflowing", () => {
    const lines = wrapRich("W".repeat(100), { size: 48, width: 1080, measure: (t, _c, s) => t.length * s });
    expect(lines.length).toBe(5);
  });

  it("never splits an inline code pill", () => {
    const lines = wrapRich("run `npm run build now` please", { size: 48, width: 400, measure: fake });
    expect(lines.flat().some((s) => s.code && s.text === "npm run build now")).toBe(true);
  });

  it("limits Try-this code to 4 lines, the end-card code to 5, end-card points to 3 and the title to 2", () => {
    expect(fitCode("s", "code", chars(120), fake).lines.length).toBeLessThanOrEqual(4);
    expect(() => fitCode("s-long", "code", chars(400), fake)).toThrow(/"s-long"/);
    expect(() => fitRecapCode("s", "code", chars(400), fake)).toThrow(/maximum is 5/);
    expect(() => fitRecapPoint("s", 1, chars(400), fake)).toThrow(/bullet index 1/);
    expect(() => fitTitle("s", chars(400), fake)).toThrow(/lesson title/);
  });
});
