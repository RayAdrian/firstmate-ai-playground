// Pure beat, cue, duration, VTT and transcript logic for the TL;DR video (PRD §19.5, DESIGN §6.3.4).
// No React or Remotion imports: Node strips types and runs this file directly, and the root vitest imports it
// (tests/unit/v1/tldr-template.test.ts), the same pattern as ../lib/vtt.ts.

// No imports: the root tsconfig (tests) cannot resolve a ".ts" specifier, and Node cannot resolve an extensionless one.
/** Same output as formatTimestamp in ../lib/vtt.ts (HH:MM:SS.mmm). */
function formatTimestamp(seconds: number): string {
  const totalMs = Math.round(seconds * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(Math.floor(totalMs / 3600000))}:${pad(Math.floor(totalMs / 60000) % 60)}:${pad(Math.floor(totalMs / 1000) % 60)}.${pad(totalMs % 1000, 3)}`;
}

export const FPS = 30;
export const WIDTH = 1280;
export const HEIGHT = 720;

export type TryEntry = { kind: "command" | "prompt"; text: string };
export type TldrTry = { all: TryEntry } | { claude: TryEntry; codex: TryEntry };
/** The lesson's `tldr` frontmatter (src/lib/contracts/lesson.ts lessonTldrSchema). */
export type TldrInput = { points: string[]; try_this: TldrTry };

export type Beat = {
  id: string;
  kind: "title" | "point" | "try" | "recap";
  /** 1-based point number, for kind "point". */
  point?: number;
  tool?: "all" | "claude" | "codex";
  start_s: number;
  end_s: number;
  /** The caption (VTT) cue: a signpost, at most 32 characters. */
  cue: string;
  /** The transcript line: the full text of what the beat shows. */
  text: string;
};

export const TOOL_LABEL = { claude: "Claude Code", codex: "Codex CLI" } as const;
const clamp = (min: number, v: number, max: number) => Math.min(max, Math.max(min, v));

/** Dwell for a point, or a shared Try-this entry: clamp(6, 2 + chars / 15, 10) seconds. */
export const pointDwell = (chars: number) => clamp(6, 2 + chars / 15, 10);
/** Dwell for one per-tool Try-this panel: clamp(4, 2 + chars / 15, 7) seconds. */
export const panelDwell = (chars: number) => clamp(4, 2 + chars / 15, 7);
export const TITLE_DWELL = 3;
export const RECAP_DWELL = 2;
export const MIN_TOTAL_S = 30;
export const MAX_TOTAL_S = 45;

export function validateTldr(t: TldrInput): string[] {
  const errs: string[] = [];
  if (!Array.isArray(t.points) || t.points.length !== 3 || t.points.some((p) => typeof p !== "string" || !p.trim())) {
    errs.push("tldr.points must be exactly 3 non-empty strings");
  }
  const entry = (e: unknown, where: string) => {
    const x = e as TryEntry | undefined;
    if (!x || (x.kind !== "command" && x.kind !== "prompt") || typeof x.text !== "string" || !x.text.trim()) {
      errs.push(`${where} must be { kind: "command" | "prompt", text }`);
    }
  };
  const tt = t.try_this as Record<string, unknown> | undefined;
  if (!tt) errs.push("tldr.try_this is missing");
  else if ("all" in tt) entry(tt.all, "try_this.all");
  else if ("claude" in tt && "codex" in tt) {
    entry(tt.claude, "try_this.claude");
    entry(tt.codex, "try_this.codex");
  } else errs.push("tldr.try_this must have `all`, or both `claude` and `codex`");
  return errs;
}

export function buildBeats(title: string, tldr: TldrInput): { beats: Beat[]; duration_s: number; frames: number } {
  const problems = validateTldr(tldr);
  if (problems.length) throw new Error(problems.join("; "));
  const beats: Beat[] = [];
  let t = 0;
  const push = (b: Omit<Beat, "start_s" | "end_s">, dwell: number) => {
    beats.push({ ...b, start_s: t, end_s: t + dwell });
    t += dwell;
  };
  push(
    { id: "title", kind: "title", cue: "TL;DR: 3 points, 1 thing to try", text: `Title card: ${title}. Three takeaways and one thing to try.` },
    TITLE_DWELL,
  );
  tldr.points.forEach((p, i) => {
    push(
      { id: `point-${i + 1}`, kind: "point", point: i + 1, cue: `Point ${i + 1} of 3`, text: `Point ${i + 1} of 3: ${p}` },
      pointDwell(p.length),
    );
  });
  const tt = tldr.try_this;
  if ("all" in tt) {
    push(
      { id: "try-all", kind: "try", tool: "all", cue: "Try this", text: `Try this (${tt.all.kind}): ${tt.all.text}` },
      pointDwell(tt.all.text.length),
    );
  } else {
    for (const tool of ["claude", "codex"] as const) {
      const label = TOOL_LABEL[tool];
      push(
        { id: `try-${tool}`, kind: "try", tool, cue: `Try this in ${label}`, text: `Try this in ${label} (${tt[tool].kind}): ${tt[tool].text}` },
        panelDwell(tt[tool].text.length),
      );
    }
  }
  // The recap is 2 s, padded so that the whole video is at least 30 s.
  const recapDwell = Math.max(RECAP_DWELL, MIN_TOTAL_S - t);
  push({ id: "recap", kind: "recap", cue: "Recap", text: `Recap card: ${title}. The 3 points and Try this, all on screen again.` }, recapDwell);
  return { beats, duration_s: t, frames: Math.round(t * FPS) };
}

export const beatFrame = (s: number) => Math.round(s * FPS);

/** One cue per beat, text = the beat's signpost cue. */
export function buildVtt(beats: Beat[]): string {
  const cues = beats.map((b, i) => `${i + 1}\n${formatTimestamp(b.start_s)} --> ${formatTimestamp(b.end_s)}\n${b.cue}`);
  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}

/** One line per beat, the beat's full text. */
export function buildTranscript(beats: Beat[]): string {
  return `${beats.map((b) => b.text).join("\n")}\n`;
}
