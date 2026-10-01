/**
 * The drawing model: what the pure layout functions produce and the SVG renderer consumes.
 * No React here, so `scripts/` can import the layout (PRD §17.10). Geometry: DESIGN §6.3.3.
 */
import type { LayoutTextBox } from "@/lib/diagram/fit";

export type Tone = "fg" | "muted" | "danger";

export interface TextPrim {
  k: "text";
  x: number;
  /** Baseline. */
  y: number;
  text: string;
  size: 12 | 14;
  weight: 400 | 500 | 700;
  anchor: "start" | "middle" | "end";
  tone: Tone;
  /** Edge labels that can cross a line get the surface-coloured halo. */
  halo?: boolean;
}

export interface RectPrim {
  k: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  variant: "node" | "key" | "risk" | "key-risk" | "zone";
}

export interface PathPrim {
  k: "path";
  d: string;
  variant: "edge" | "risk" | "underlay";
  /** Arrowhead or the ✕ end-cap at the end of the path. */
  end?: "arrow" | "x";
  /** The ✕ cap at the start of the path (the lanes marker). */
  start?: "x";
}

export interface CirclePrim {
  k: "circle";
  cx: number;
  cy: number;
  r: number;
  variant: "badge" | "badge-risk";
}

/** A 10x10 ✕ drawn as a path (Satoshi has no ✕ glyph). */
export interface CrossPrim {
  k: "cross";
  x: number;
  y: number;
  size: number;
}

export type DiagramPart =
  | "node"
  | "edge"
  | "loop"
  | "exit"
  | "zone"
  | "crossing"
  | "lane"
  | "handoff"
  | "marker"
  | "axis"
  | "legend";

export interface GroupPrim {
  k: "g";
  part: DiagramPart;
  /** A `data-state` token list: `key`, `risk`, or `key risk` (select with `~=`). */
  state?: "key" | "risk" | "key risk";
  /** The diagram data id, for tests. */
  ref?: string;
  children: Prim[];
}

export type Prim = TextPrim | RectPrim | PathPrim | CirclePrim | CrossPrim | GroupPrim;

export interface Drawing {
  /** viewBox width: 576, or 280 for vertical and stacked drawings. */
  width: number;
  height: number;
  children: Prim[];
  /** True when a ✕ marker definition is needed. */
  usesX: boolean;
}

export interface LayoutOutput {
  drawing: Drawing;
  /** `row` or `stacked` for the horizontal orientation of a template with two arrangements. */
  mode?: "row" | "stacked";
  boxes: LayoutTextBox[];
}
