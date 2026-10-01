import { z } from "zod";

/**
 * Diagram data contract (PRD §17.3). Lessons author diagrams as a fenced `diagram` block of YAML;
 * workflows as the optional `diagram` frontmatter field. Both parse through `diagramSchema`.
 * Every cap below is a hard fail. A 5th type needs a design review and a change to this file.
 */

/** Text caps. */
export const DIAGRAM_LINE_MAX = 24;
export const DIAGRAM_LABEL_MAX_LINES = 2;
export const DIAGRAM_LABEL_MAX = DIAGRAM_LINE_MAX * DIAGRAM_LABEL_MAX_LINES + (DIAGRAM_LABEL_MAX_LINES - 1); // 49
export const DIAGRAM_SUB_MAX = 28;
/** A flow exit `text` is one line (DESIGN §6.3.3 Delta 3). */
export const DIAGRAM_EXIT_TEXT_MAX = 20;
export const DIAGRAM_EDGE_MAX = 16;
export const DIAGRAM_TITLE_MAX = 60;
export const DIAGRAM_SUMMARY_MAX = 200;
export const DIAGRAM_ID_MAX = 32;

/** Count caps. */
export const DIAGRAM_FLOW_STEPS = { min: 2, max: 6 } as const;
export const DIAGRAM_FLOW_LOOPS_MAX = 2;
export const DIAGRAM_FLOW_EXITS_MAX = 2;
export const DIAGRAM_STACK_LAYERS = { min: 2, max: 5 } as const;
export const DIAGRAM_BOUNDARY_ZONES_MAX = 3;
export const DIAGRAM_BOUNDARY_ITEMS_MAX = 4;
export const DIAGRAM_BOUNDARY_CROSSINGS_MAX = 4;
export const DIAGRAM_LANES = { min: 2, max: 3 } as const;
export const DIAGRAM_LANE_COLS = { min: 1, max: 6 } as const;
export const DIAGRAM_LANES_HANDOFFS_MAX = 4;
/** Lessons: at most this many diagram fences per lesson (DG-7). */
export const DIAGRAM_MAX_PER_LESSON = 2;

/** Geometry shared by the renderer and the fit check. */
/** DESIGN §6.3.3 (Deltas 1 and 2): 576 horizontal, 280 vertical, the vertical SVG capped at max-w-[336px]. */
export const DIAGRAM_VIEWBOX_WIDTH_HORIZONTAL = 576;
export const DIAGRAM_VIEWBOX_WIDTH_VERTICAL = 280;
export const DIAGRAM_VERTICAL_MAX_CSS_WIDTH = 336;
export const DIAGRAM_MAX_HEIGHT = 560;

export const DIAGRAM_TYPES = ["flow", "stack", "boundary", "lanes"] as const;
export type DiagramType = (typeof DIAGRAM_TYPES)[number];

/**
 * Options for `yaml`'s `parse` / `parseDocument`: no merge keys, no aliases (`maxAliasCount: 0`),
 * the core schema only (so a custom tag does not resolve and is reported), and duplicate keys are an error.
 */
export const DIAGRAM_YAML_OPTIONS = {
  schema: "core",
  version: "1.2",
  merge: false,
  maxAliasCount: 0,
  uniqueKeys: true,
  strict: true,
} as const;

/**
 * Text-width heuristic with no DOM: about 0.55em per character plus 15% slack.
 * Deliberately conservative, so a label that passes here fits in Satoshi.
 */
export const TEXT_EM_PER_CHAR = 0.55;
export const TEXT_SLACK = 1.15;
export function estimateTextWidth(text: string, fontPx: number): number {
  return text.length * TEXT_EM_PER_CHAR * fontPx * TEXT_SLACK;
}

type Path = (string | number)[];

const lineStr = z.string().min(1).max(DIAGRAM_LINE_MAX);
const label = z
  .string()
  .min(1)
  .max(DIAGRAM_LABEL_MAX)
  .refine(
    (s) =>
      s.split("\n").length <= DIAGRAM_LABEL_MAX_LINES &&
      s.split("\n").every((l) => l.trim().length >= 1 && l.length <= DIAGRAM_LINE_MAX),
    `at most ${DIAGRAM_LABEL_MAX_LINES} non-empty lines of ${DIAGRAM_LINE_MAX} characters, split on "\\n"`,
  );
const sub = z
  .string()
  .min(1)
  .max(DIAGRAM_SUB_MAX)
  .refine((s) => !s.includes("\n"), "must be a single line");
const edge = z.string().min(1).max(DIAGRAM_EDGE_MAX);
const exitText = z
  .string()
  .min(1)
  .max(DIAGRAM_EXIT_TEXT_MAX)
  .refine((s) => !s.includes("\n"), "must be a single line");
const nodeId = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "expected kebab-case id")
  .max(DIAGRAM_ID_MAX);

const node = z
  .object({ id: nodeId, label, sub: sub.optional(), emphasis: z.literal(true).optional() })
  .strict();

const common = {
  /** Unique per page; drives DOM ids (diagram-<id>-title-h / -v). */
  id: nodeId,
  title: z.string().min(1).max(DIAGRAM_TITLE_MAX),
  /** The one claim the diagram makes. */
  summary: z.string().min(1).max(DIAGRAM_SUMMARY_MAX),
};

const flow = z
  .object({
    ...common,
    type: z.literal("flow"),
    /** `next` labels the arrow to the following step. */
    steps: z
      .array(node.extend({ next: edge.optional() }))
      .min(DIAGRAM_FLOW_STEPS.min)
      .max(DIAGRAM_FLOW_STEPS.max),
    /** Back-edges. */
    loops: z
      .array(z.object({ from: nodeId, to: nodeId, label: edge }).strict())
      .max(DIAGRAM_FLOW_LOOPS_MAX)
      .default([]),
    exits: z
      .array(
        z.object({ from: nodeId, label: edge, text: exitText, style: z.enum(["ok", "risk"]) }).strict(),
      )
      .max(DIAGRAM_FLOW_EXITS_MAX)
      .default([]),
  })
  .strict();

const stack = z
  .object({
    ...common,
    type: z.literal("stack"),
    /** Listed bottom (low) to top (high). */
    layers: z.array(node).min(DIAGRAM_STACK_LAYERS.min).max(DIAGRAM_STACK_LAYERS.max),
    axis: z.object({ low: edge, high: edge }).strict(),
  })
  .strict();

const zone = z
  .object({
    id: nodeId,
    label: lineStr,
    items: z.array(node).max(DIAGRAM_BOUNDARY_ITEMS_MAX).default([]),
  })
  .strict();
const boundary = z
  .object({
    ...common,
    type: z.literal("boundary"),
    /** At most 3 zones in total, nested one level deep (a nested zone carries no `zones`). */
    zones: z.array(zone.extend({ zones: z.array(zone).optional() })).min(1),
    crossings: z
      .array(
        z
          .object({
            from: nodeId,
            to: nodeId,
            label: edge,
            style: z.enum(["normal", "risk"]).default("normal"),
          })
          .strict(),
      )
      .max(DIAGRAM_BOUNDARY_CROSSINGS_MAX)
      .default([]),
  })
  .strict();

const lanes = z
  .object({
    ...common,
    type: z.literal("lanes"),
    lanes: z
      .array(z.object({ id: nodeId, label: lineStr }).strict())
      .min(DIAGRAM_LANES.min)
      .max(DIAGRAM_LANES.max),
    /** (lane, col) is unique. */
    steps: z
      .array(
        node.extend({
          lane: nodeId,
          col: z.number().int().min(DIAGRAM_LANE_COLS.min).max(DIAGRAM_LANE_COLS.max),
          /** `risk`: a dashed danger boundary; with `emphasis` it is the key risk step (lanes v2, DESIGN §6.3.3). */
          style: z.enum(["normal", "risk"]).default("normal"),
        }),
      )
      .min(2),
    handoffs: z
      .array(
        z
          .object({
            from: nodeId,
            to: nodeId,
            label: edge.optional(),
            style: z.enum(["normal", "risk"]).default("normal"),
          })
          .strict(),
      )
      .max(DIAGRAM_LANES_HANDOFFS_MAX)
      .default([]),
    /** One at most. */
    marker: z
      .object({
        col: z.number().int().min(DIAGRAM_LANE_COLS.min).max(DIAGRAM_LANE_COLS.max),
        label: lineStr,
        style: z.enum(["ok", "risk"]),
      })
      .strict()
      .optional(),
  })
  .strict();

const union = z.discriminatedUnion("type", [flow, stack, boundary, lanes]);

/** Cross-field rules (§17.3). Each failure carries a path. */
export const diagramSchema = union.superRefine((d, ctx) => {
  const issue = (path: Path, message: string) => ctx.addIssue({ code: "custom", path, message });

  // Every id lives in one namespace: steps, layers, zones, items, lanes.
  const seen = new Set<string>();
  const register = (id: string, path: Path) => {
    if (seen.has(id)) issue([...path, "id"], `duplicate id "${id}"`);
    else seen.add(id);
  };
  const emphasised: Path[] = [];
  const noteEmphasis = (n: { emphasis?: true }, path: Path) => {
    if (n.emphasis) emphasised.push([...path, "emphasis"]);
  };

  switch (d.type) {
    case "flow": {
      d.steps.forEach((s, i) => {
        register(s.id, ["steps", i]);
        noteEmphasis(s, ["steps", i]);
      });
      const index = new Map(d.steps.map((s, i) => [s.id, i]));
      d.loops.forEach((l, i) => {
        const from = index.get(l.from);
        const to = index.get(l.to);
        if (from === undefined) issue(["loops", i, "from"], `unknown step "${l.from}"`);
        if (to === undefined) issue(["loops", i, "to"], `unknown step "${l.to}"`);
        if (from !== undefined && to !== undefined && to > from) {
          issue(["loops", i, "to"], `a loop must go back: "${l.to}" is after "${l.from}"`);
        }
      });
      d.exits.forEach((x, i) => {
        if (!index.has(x.from)) issue(["exits", i, "from"], `unknown step "${x.from}"`);
      });
      break;
    }
    case "stack":
      d.layers.forEach((s, i) => {
        register(s.id, ["layers", i]);
        noteEmphasis(s, ["layers", i]);
      });
      break;
    case "boundary": {
      let zoneCount = 0;
      const visit = (z: (typeof d.zones)[number] | z.infer<typeof zone>, zp: Path) => {
        zoneCount++;
        register(z.id, zp);
        z.items.forEach((it, ii) => {
          register(it.id, [...zp, "items", ii]);
          noteEmphasis(it, [...zp, "items", ii]);
        });
      };
      d.zones.forEach((z, zi) => {
        visit(z, ["zones", zi]);
        z.zones?.forEach((n, ni) => visit(n, ["zones", zi, "zones", ni]));
      });
      if (zoneCount > DIAGRAM_BOUNDARY_ZONES_MAX) {
        issue(["zones"], `at most ${DIAGRAM_BOUNDARY_ZONES_MAX} zones in total, got ${zoneCount}`);
      }
      d.crossings.forEach((c, i) => {
        if (!seen.has(c.from)) issue(["crossings", i, "from"], `unknown zone or item "${c.from}"`);
        if (!seen.has(c.to)) issue(["crossings", i, "to"], `unknown zone or item "${c.to}"`);
      });
      break;
    }
    case "lanes": {
      d.lanes.forEach((l, i) => register(l.id, ["lanes", i]));
      const laneIds = new Set(d.lanes.map((l) => l.id));
      const cells = new Set<string>();
      const stepIds = new Set<string>();
      d.steps.forEach((s, i) => {
        register(s.id, ["steps", i]);
        stepIds.add(s.id);
        noteEmphasis(s, ["steps", i]);
        if (!laneIds.has(s.lane)) issue(["steps", i, "lane"], `unknown lane "${s.lane}"`);
        const cell = `${s.lane}/${s.col}`;
        if (cells.has(cell)) issue(["steps", i, "col"], `lane "${s.lane}" already has a step in column ${s.col}`);
        cells.add(cell);
      });
      d.handoffs.forEach((h, i) => {
        if (!stepIds.has(h.from)) issue(["handoffs", i, "from"], `unknown step "${h.from}"`);
        if (!stepIds.has(h.to)) issue(["handoffs", i, "to"], `unknown step "${h.to}"`);
      });
      break;
    }
  }

  for (const p of emphasised.slice(1)) issue(p, "at most one emphasised node per diagram");
});

export type Diagram = z.infer<typeof diagramSchema>;
export type FlowDiagram = Extract<Diagram, { type: "flow" }>;
export type StackDiagram = Extract<Diagram, { type: "stack" }>;
export type BoundaryDiagram = Extract<Diagram, { type: "boundary" }>;
export type LanesDiagram = Extract<Diagram, { type: "lanes" }>;
/** Input shape (before defaults are applied), for fixtures and authors. */
export type DiagramInput = z.input<typeof diagramSchema>;
