// @vitest-environment node
// MD-4: captions come from the same steps.json as the on-screen text; committed output matches its sources.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MEDIA_CAPS, mediaManifestSchema } from "@/lib/contracts";
import { buildVtt, formatTimestamp, validateSteps } from "../../../media/remotion/src/lib/vtt";
import type { StepsFile } from "../../../media/remotion/src/lib/vtt";

const repo = path.resolve(__dirname, "../../..");
const srcDir = path.join(repo, "media/remotion/src");
const ids = fs
  .readdirSync(srcDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && fs.existsSync(path.join(srcDir, e.name, "steps.json")))
  .map((e) => e.name);

const stepsOf = (id: string): StepsFile => JSON.parse(fs.readFileSync(path.join(srcDir, id, "steps.json"), "utf8"));
const outDir = (s: StepsFile) => path.join(repo, "public/media/lessons", s.lesson_slug);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

describe("formatTimestamp", () => {
  it("formats WebVTT timestamps", () => {
    expect(formatTimestamp(0)).toBe("00:00:00.000");
    expect(formatTimestamp(61.5)).toBe("00:01:01.500");
    expect(formatTimestamp(3725.25)).toBe("01:02:05.250");
  });
});

describe("pilot animations (PRD 15.1)", () => {
  it("has the two Remotion items", () => {
    expect(ids.sort()).toEqual(["gated-merge-pipelines", "parallel-worktrees"]);
    expect(stepsOf("parallel-worktrees").lesson_slug).toBe("l4-parallel-worktrees");
    expect(stepsOf("gated-merge-pipelines").lesson_slug).toBe("l5-gated-merge-pipelines");
  });
});

describe.each(ids)("%s", (id) => {
  const steps = stepsOf(id);
  const dir = outDir(steps);

  it("steps.json is valid, 1280x720 and 60-90 seconds", () => {
    expect(steps.id).toBe(id);
    expect(validateSteps(steps)).toEqual([]);
    expect(steps.duration_s).toBeGreaterThanOrEqual(60);
    expect(steps.duration_s).toBeLessThanOrEqual(90);
  });

  it("the lesson exists", () => {
    const found = fs
      .readdirSync(path.join(repo, "content/lessons"))
      .flatMap((l) => fs.readdirSync(path.join(repo, "content/lessons", l)).map((f) => path.join(repo, "content/lessons", l, f)))
      .some((f) => f.endsWith(".md") && new RegExp(`^slug: ${steps.lesson_slug}$`, "m").test(fs.readFileSync(f, "utf8")));
    expect(found).toBe(true);
  });

  it("every cue in the committed .vtt is exactly a step's on-screen text, at the step's times", () => {
    const vtt = fs.readFileSync(path.join(dir, `${id}.vtt`), "utf8");
    expect(vtt).toBe(buildVtt(steps.steps));
    const cues = vtt.split("\n\n").slice(1);
    expect(cues).toHaveLength(steps.steps.length);
    steps.steps.forEach((s, i) => {
      const lines = cues[i].trim().split("\n");
      expect(lines[1]).toBe(`${formatTimestamp(s.start_s)} --> ${formatTimestamp(s.end_s)}`);
      expect(lines.slice(2).join("\n")).toBe(s.text);
    });
  });

  it("the transcript is a copy of transcript.txt and describes every step", () => {
    const source = fs.readFileSync(path.join(srcDir, id, "transcript.txt"), "utf8");
    expect(fs.readFileSync(path.join(dir, `${id}.txt`), "utf8")).toBe(source);
    for (const s of steps.steps) {
      expect(source, `${s.id} timestamp and text`).toContain(`${mmss(s.start_s)} ${s.text}`);
    }
    // Plain text, not markup (L-7).
    expect(source).not.toMatch(/<[a-z]/i);
  });

  it("the manifest matches the contract, the sources and the files on disk", () => {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, `${id}.media.json`), "utf8"));
    const m = mediaManifestSchema.parse(raw);
    expect(m).toMatchObject({
      id,
      lesson_slug: steps.lesson_slug,
      kind: "animation",
      title: steps.title,
      duration_s: steps.duration_s,
      width: 1280,
      height: 720,
      model_calls: false,
    });
    const hash = createHash("sha256").update(fs.readFileSync(path.join(srcDir, id, "steps.json"))).digest("hex");
    expect(m.source_hash, "re-run npm run media:render after editing steps.json").toBe(hash);
  });

  it("the mp4 is H.264 with no audio track, and the files respect the caps", () => {
    const mp4 = fs.readFileSync(path.join(dir, `${id}.mp4`));
    expect(mp4.length).toBeLessThanOrEqual(MEDIA_CAPS.mp4);
    expect(mp4.includes("avc1")).toBe(true);
    expect(mp4.includes("soun"), "audio track present").toBe(false);
    expect(fs.statSync(path.join(dir, `${id}.webp`)).size).toBeLessThanOrEqual(MEDIA_CAPS.poster);
    const head = fs.readFileSync(path.join(dir, `${id}.webp`)).subarray(0, 12).toString("latin1");
    expect(head.startsWith("RIFF") && head.endsWith("WEBP")).toBe(true);
  });
});
