// Pure helpers shared by the compositions, the render script and tests/unit/v1.
// No imports on purpose: Node strips types and runs this file directly, and the root vitest imports it too.

export type Step = {
  id: string;
  start_s: number;
  end_s: number;
  /** The one line shown on screen as the step headline. Also the caption cue, verbatim (MD-4). */
  text: string;
};

export type StepsFile = {
  id: string;
  lesson_slug: string;
  title: string;
  fps: number;
  width: number;
  height: number;
  duration_s: number;
  poster_s: number;
  steps: Step[];
  // Composition-specific labels live next to the steps in the same file.
  [key: string]: unknown;
};

export function formatTimestamp(seconds: number): string {
  const totalMs = Math.round(seconds * 1000);
  const ms = totalMs % 1000;
  const s = Math.floor(totalMs / 1000) % 60;
  const m = Math.floor(totalMs / 60000) % 60;
  const h = Math.floor(totalMs / 3600000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

/** One cue per step. Cue text is exactly `step.text`, the same string the composition renders. */
export function buildVtt(steps: Step[]): string {
  const cues = steps.map(
    (s, i) => `${i + 1}\n${formatTimestamp(s.start_s)} --> ${formatTimestamp(s.end_s)}\n${s.text}`,
  );
  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}

/** Returns a list of problems; empty means valid. */
export function validateSteps(f: StepsFile): string[] {
  const errs: string[] = [];
  if (!f.steps?.length) return ["no steps"];
  let prevEnd = 0;
  const ids = new Set<string>();
  for (const s of f.steps) {
    if (ids.has(s.id)) errs.push(`duplicate step id ${s.id}`);
    ids.add(s.id);
    if (s.start_s < prevEnd) errs.push(`${s.id}: starts before the previous step ends`);
    if (s.end_s <= s.start_s) errs.push(`${s.id}: end must be after start`);
    if (!s.text.trim()) errs.push(`${s.id}: empty text`);
    prevEnd = s.end_s;
  }
  if (f.duration_s < prevEnd) errs.push("duration_s is shorter than the last step");
  if (f.poster_s < 0 || f.poster_s > f.duration_s) errs.push("poster_s outside the video");
  if (f.width !== 1280 || f.height !== 720) errs.push("must be 1280x720");
  return errs;
}
