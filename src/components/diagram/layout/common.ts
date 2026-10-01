import { estimateTextWidth } from "@/lib/contracts/diagram";
import { contentWidth, labelBoxWidth, nodeHeight, type LayoutTextBox } from "@/lib/diagram/fit";
import type { CirclePrim, GroupPrim, Prim, TextPrim } from "./model";

/** Shared geometry from DESIGN §6.3.3 (the box rules themselves live in `@/lib/diagram/fit`). */
export const H_W = 576;
export const V_W = 280;
export const BADGE_R = 9;
export const BADGE_STEP = 22;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const lines = (s: string): string[] => s.split("\n");
export const flat = (s: string): string => s.split("\n").join(" ");
export const est = (text: string, px: number): number => estimateTextWidth(text, px);

/** Round to 2 decimals so the markup never carries float noise. */
export const n = (v: number): number => Math.round(v * 100) / 100;

/** Collects the text boxes G0's `checkLabelsFit` measures. */
export class Boxes {
  readonly list: LayoutTextBox[] = [];
  add(path: string, text: string, fontPx: number, boxWidth: number, padX?: number): void {
    this.list.push({ path, text, fontPx, boxWidth, ...(padX === undefined ? {} : { padX }) });
  }
}

/** Every box is wide enough for its text (used by the fit-or-stack rule; the final verdict is `checkLabelsFit`). */
export function boxesFit(boxes: readonly LayoutTextBox[]): boolean {
  return boxes.every((b) =>
    b.text.split("\n").every((l) => estimateTextWidth(l, b.fontPx) <= labelBoxWidth(b.boxWidth, b.padX)),
  );
}

export function text(
  x: number,
  y: number,
  value: string,
  opts: Partial<Pick<TextPrim, "size" | "weight" | "anchor" | "tone" | "halo">> = {},
): TextPrim {
  return {
    k: "text",
    x: n(x),
    y: n(y),
    text: value,
    size: opts.size ?? 12,
    weight: opts.weight ?? 500,
    anchor: opts.anchor ?? "start",
    tone: opts.tone ?? "muted",
    ...(opts.halo ? { halo: true } : {}),
  };
}

export interface NodeSpec {
  x: number;
  y: number;
  w: number;
  label: string;
  sub?: string | undefined;
  key?: boolean | undefined;
  risk?: boolean;
  labelPath: string;
  subPath?: string;
  ref?: string;
  /** A lane eyebrow above the label (timeline form). */
  eyebrow?: { text: string; path: string };
  /** Registered as the node's own label box. Defaults to the node width. */
  noBoxes?: boolean;
}

/** A node: rect, label lines (14/500, 700 when emphasised) and an optional `sub` (12). Returns its group and height. */
export function nodeGroup(boxes: Boxes, s: NodeSpec): { g: GroupPrim; h: number; rect: Rect } {
  const ls = lines(s.label);
  const eyebrow = s.eyebrow ? 18 : 0;
  const h = nodeHeight(ls.length, s.sub !== undefined) + eyebrow;
  const children: Prim[] = [
    {
      k: "rect",
      x: n(s.x),
      y: n(s.y),
      w: n(s.w),
      h,
      variant: s.key && s.risk ? "key-risk" : s.key ? "key" : s.risk ? "risk" : "node",
    },
  ];
  const tx = s.x + 10;
  let top = s.y + 10;
  if (s.eyebrow) {
    children.push(text(tx, top + 12, s.eyebrow.text, { size: 12, weight: 700, tone: "muted" }));
    if (!s.noBoxes) boxes.add(s.eyebrow.path, s.eyebrow.text, 12, s.w);
    top += 18;
  }
  ls.forEach((l, i) => {
    children.push(text(tx, top + i * 20 + 15, l, { size: 14, weight: s.key ? 700 : 500, tone: "fg" }));
  });
  if (!s.noBoxes) boxes.add(s.labelPath, s.label, 14, s.w);
  if (s.sub !== undefined) {
    children.push(text(tx, top + ls.length * 20 + 2 + 12, s.sub, { size: 12, weight: 400, tone: "muted" }));
    if (!s.noBoxes && s.subPath) boxes.add(s.subPath, s.sub, 12, s.w);
  }
  return {
    g: {
      k: "g",
      part: "node",
      ...(s.key || s.risk ? { state: (s.key && s.risk ? "key risk" : s.key ? "key" : "risk") as "key" | "risk" | "key risk" } : {}),
      ...(s.ref ? { ref: s.ref } : {}),
      children,
    },
    h,
    rect: { x: s.x, y: s.y, w: s.w, h },
  };
}

/** Width a node needs for its label lines (14) and sub (12). */
export function nodeContentWidth(label: string, sub?: string): number {
  return Math.max(contentWidth(lines(label), 14), sub === undefined ? 0 : contentWidth([sub], 12));
}

/** A numbered badge: ring plus numeral. */
export function badge(cx: number, cy: number, num: number, risk: boolean): Prim[] {
  const circle: CirclePrim = { k: "circle", cx: n(cx), cy: n(cy), r: BADGE_R, variant: risk ? "badge-risk" : "badge" };
  return [circle, text(cx, cy + 4, String(num), { size: 12, weight: 700, tone: "fg", anchor: "middle" })];
}

/** Hands out badge slots straddling a node's top border, right-aligned at right - 16 and stepping left by 22. */
export class BadgeLedger {
  private readonly counts = new Map<string, number>();
  place(id: string, rect: Rect): { cx: number; cy: number } {
    const used = this.counts.get(id) ?? 0;
    this.counts.set(id, used + 1);
    return { cx: rect.x + rect.w - 16 - BADGE_STEP * used, cy: rect.y };
  }
}

export interface LegendEntry {
  n: number;
  /** The words after the numeral, e.g. "Tool results: Web page → Agent". */
  text: string;
  risk: boolean;
  /** The diagram data path of the label this entry carries, for the fit boxes. */
  path?: string;
  label?: string;
}

/** Greedy word wrap with the shared width estimate. */
export function wrapText(value: string, maxPx: number, px = 12): string[] {
  const out: string[] = [];
  let cur = "";
  for (const word of value.split(" ")) {
    const next = cur === "" ? word : `${cur} ${word}`;
    if (cur !== "" && est(next, px) > maxPx) {
      out.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur !== "") out.push(cur);
  return out;
}

/**
 * The legend under a drawing that numbers crossings and handoffs. Horizontal: entries flow inline and wrap into rows of 20.
 * Stacked: one entry per row, the text word-wrapped. It wraps rather than truncating, so it can never fail the fit check.
 */
export function legend(
  boxes: Boxes,
  entries: readonly LegendEntry[],
  width: number,
  y: number,
  stacked: boolean,
): { g: GroupPrim; h: number } {
  const children: Prim[] = [];
  let cx = 0;
  let rowY = y;
  let rowH = 0;
  for (const e of entries) {
    if (e.path && e.label) boxes.add(e.path, e.label, 12, width - 24, 0);
    const extra = e.risk ? 14 : 0;
    const full = 24 + extra + est(e.text, 12);
    const alone = stacked || full > width;
    const ls = alone ? wrapText(e.text, width - 24 - extra) : [e.text];
    const entryW = alone ? width : full;
    const entryH = Math.max(20, 4 + 16 * ls.length);
    if (alone || (cx > 0 && cx + 16 + entryW > width)) {
      if (rowH > 0) rowY += rowH + (stacked ? 4 : 0);
      cx = 0;
      rowH = 0;
    }
    const x = cx > 0 ? cx + 16 : 0;
    children.push(...badge(x + 9, rowY + 10, e.n, e.risk));
    let tx = x + 24;
    if (e.risk) {
      children.push({ k: "cross", x: n(x + 24), y: n(rowY + 5), size: 10 });
      tx += 14;
    }
    ls.forEach((l, i) => {
      children.push(text(tx, rowY + 14 + 16 * i, l, { size: 12, weight: 500, tone: e.risk ? "danger" : "muted" }));
    });
    cx = x + entryW;
    rowH = Math.max(rowH, entryH);
    if (alone) {
      rowY += rowH + (stacked ? 4 : 0);
      rowH = 0;
      cx = 0;
    }
  }
  const bottom = rowH > 0 ? rowY + rowH : rowY - (stacked ? 4 : 0);
  return { g: { k: "g", part: "legend", children }, h: Math.max(0, bottom - y) };
}
