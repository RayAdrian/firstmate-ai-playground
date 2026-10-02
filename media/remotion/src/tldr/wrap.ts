// Pure text wrapping and the render-time fit check for the TL;DR video (PRD §19.5, DESIGN §6.3.4 "Fit check").
// The measurer is injected: the composition passes a @remotion/layout-utils measureText wrapper, tests pass a fake.
// The composition draws exactly the lines computed here, so what is checked is what is rendered.

export type Seg = { text: string; code: boolean };
/** Width in px of `text` at `size` px. `code` selects the mono face (Satoshi Medium otherwise). */
export type Measure = (text: string, code: boolean, size: number) => number;

/** Splits a point into plain and `code` segments. An unmatched backtick stays literal. */
export function parseInline(text: string): Seg[] {
  const out: Seg[] = [];
  const re = /`([^`]+)`/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), code: false });
    out.push({ text: m[1], code: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), code: false });
  return out;
}

/** Inline code pill: mono at 0.9em, padding 0 10px (DESIGN §6.3.4). */
export const PILL = { scale: 0.9, padX: 10 } as const;

type Opts = {
  size: number;
  width: number;
  measure: Measure;
  /** Treat the whole text as one mono block (Try-this code): no backtick parsing, no pill. */
  block?: boolean;
};

/** Greedy wrap at spaces. A token wider than the line is split by character; a code pill is never split. */
export function wrapRich(text: string, { size, width, measure, block = false }: Opts): Seg[][] {
  const segs: Seg[] = block ? [{ text, code: true }] : parseInline(text);
  const segW = (s: Seg) =>
    block ? measure(s.text, true, size) : s.code ? measure(s.text, true, size * PILL.scale) + PILL.padX * 2 : measure(s.text, false, size);
  const spaceW = measure("n n", block, size) - measure("nn", block, size);

  // A chunk is a run without whitespace: consecutive pieces glued together (a code pill followed by a comma).
  const chunks: Seg[][] = [];
  let cur: Seg[] = [];
  const flush = () => {
    if (cur.length) chunks.push(cur);
    cur = [];
  };
  for (const s of segs) {
    if (s.code && !block) {
      cur.push(s);
      continue;
    }
    for (const part of s.text.split(/(\s+)/)) {
      if (part === "") continue;
      if (/^\s+$/.test(part)) flush();
      else cur.push({ text: part, code: s.code });
    }
  }
  flush();

  const lines: Seg[][] = [];
  let line: Seg[] = [];
  let lineW = 0;
  const commit = () => {
    if (line.length) lines.push(line);
    line = [];
    lineW = 0;
  };
  /** Puts a chunk on an empty line, splitting by character when one plain token is wider than the box. */
  const place = (c: Seg[]) => {
    const w = c.reduce((a, s) => a + segW(s), 0);
    if (w <= width || c.length > 1 || (c[0].code && !block)) {
      line = [...c];
      lineW = w;
      return;
    }
    const code = c[0].code;
    let piece = "";
    for (const ch of c[0].text) {
      if (piece && segW({ text: piece + ch, code }) > width) {
        lines.push([{ text: piece, code }]);
        piece = ch;
      } else piece += ch;
    }
    line = [{ text: piece, code }];
    lineW = segW(line[0]);
  };
  for (const c of chunks) {
    const w = c.reduce((a, s) => a + segW(s), 0);
    if (line.length === 0) place(c);
    else if (lineW + spaceW + w <= width) {
      line.push({ text: " ", code: false }, ...c);
      lineW += spaceW + w;
    } else {
      commit();
      place(c);
    }
  }
  commit();
  return lines;
}

export type Fitted = { size: number; lineHeight: number; lines: Seg[][] };

/** Text-box widths from DESIGN §6.3.4. */
export const BOX = {
  /** x 136 to 1216: the 1152px text-safe area less the 56px badge and its 16px gap. */
  point: 1080,
  /** Try-this code: 1152 less 2 x 24 padding. */
  code: 1104,
  title: 1152,
  /** End card, left column: 672 less the 32px badge and its 16px gap. */
  recapPoint: 624,
  /** End card, right column: 432 less 2 x 16 padding. */
  recapCode: 400,
} as const;

const fail = (slug: string, what: string, lines: number, size: number, max: number): never => {
  throw new Error(
    `TL;DR fit check failed for lesson "${slug}": ${what} needs ${lines} lines at ${size} px, the maximum is ${max}. Shorten it in the lesson's tldr frontmatter (the 100-character cap is not lowered).`,
  );
};

/** The current point: 56/68 if it fits 3 lines at 56, else 48/60 if it fits 3 lines at 48, else the render fails. */
export function fitPoint(slug: string, index: number, text: string, measure: Measure): Fitted {
  for (const [size, lineHeight] of [[56, 68], [48, 60]] as const) {
    const lines = wrapRich(text, { size, width: BOX.point, measure });
    if (lines.length <= 3) return { size, lineHeight, lines };
  }
  const n = wrapRich(text, { size: 48, width: BOX.point, measure }).length;
  return fail(slug, `bullet index ${index} (point ${index + 1} of 3)`, n, 48, 3);
}

/** Lesson title on the title frame, 80/92 bold, at most 2 lines. `measure` must measure bold. */
export function fitTitle(slug: string, text: string, measure: Measure): Fitted {
  const lines = wrapRich(text, { size: 80, width: BOX.title, measure });
  if (lines.length > 2) fail(slug, "the lesson title", lines.length, 80, 2);
  return { size: 80, lineHeight: 92, lines };
}

/** Try-this code, 48/64 mono, at most 4 lines. */
export function fitCode(slug: string, what: string, text: string, measure: Measure): Fitted {
  const lines = wrapRich(text, { size: 48, width: BOX.code, measure, block: true });
  if (lines.length > 4) fail(slug, what, lines.length, 48, 4);
  return { size: 48, lineHeight: 64, lines };
}

/** End-card point, 30/40, at most 3 lines. */
export function fitRecapPoint(slug: string, index: number, text: string, measure: Measure): Fitted {
  const lines = wrapRich(text, { size: 30, width: BOX.recapPoint, measure });
  if (lines.length > 3) fail(slug, `bullet index ${index} on the end card`, lines.length, 30, 3);
  return { size: 30, lineHeight: 40, lines };
}

/** End-card code, 26/34 mono, at most 5 lines. */
export function fitRecapCode(slug: string, what: string, text: string, measure: Measure): Fitted {
  const lines = wrapRich(text, { size: 26, width: BOX.recapCode, measure, block: true });
  if (lines.length > 5) fail(slug, `${what} on the end card`, lines.length, 26, 5);
  return { size: 26, lineHeight: 34, lines };
}
