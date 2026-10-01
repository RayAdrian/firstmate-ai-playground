import {
  DIAGRAM_MAX_HEIGHT,
  estimateTextWidth,
  type Diagram,
} from "@/lib/contracts/diagram";

/**
 * Runtime label-fit check (PRD §17.3). Pure: no React, no DOM, so `scripts/` can import it.
 * Callers: `workflows:validate`, the lesson seed and the workflow seed (DG-7, DG-8), and the unit
 * tests through `expectLabelsFit` (tests/support/diagram-fit.ts). Nothing else implements fit.
 *
 * G0 holds no geometry. The renderer's pure layout function (G1) is passed in and reports, for
 * each orientation, the total height and one box per piece of text.
 */

export type DiagramOrientation = "horizontal" | "vertical";
export const DIAGRAM_ORIENTATIONS: readonly DiagramOrientation[] = ["horizontal", "vertical"];

/** One piece of text and the room it has. */
export interface LayoutTextBox {
  /**
   * Where the text comes from in the diagram data, as the path used in issues, e.g.
   * `steps[0].label`, `steps[2].next`, `zones[0].items[1].sub`, `axis.low`, `marker.label`.
   */
  path: string;
  /** The text, `\n` separating lines. Each line is measured on its own. */
  text: string;
  fontPx: number;
  /** Inner width available to a line, in viewBox units (box width minus padding). */
  maxWidth: number;
}

export interface DiagramLayoutResult {
  /** Total viewBox height. */
  height: number;
  boxes: readonly LayoutTextBox[];
}

/** G1's pure layout function: geometry for one diagram in one orientation. */
export type DiagramLayoutFn = (diagram: Diagram, orientation: DiagramOrientation) => DiagramLayoutResult;

export interface DiagramIssue {
  /** Path in the diagram data, or `layout` for the height check. */
  path: string;
  reason: string;
}

type Slot = { path: string; text: string };

/** Every text the diagram declares, by data path. A layout must give each one a box. */
export function diagramTextSlots(d: Diagram): Slot[] {
  const out: Slot[] = [];
  const add = (path: string, text: string | undefined) => {
    if (text !== undefined) out.push({ path, text });
  };
  switch (d.type) {
    case "flow":
      d.steps.forEach((s, i) => {
        add(`steps[${i}].label`, s.label);
        add(`steps[${i}].sub`, s.sub);
        add(`steps[${i}].next`, s.next);
      });
      d.loops.forEach((l, i) => add(`loops[${i}].label`, l.label));
      d.exits.forEach((x, i) => {
        add(`exits[${i}].label`, x.label);
        add(`exits[${i}].text`, x.text);
      });
      break;
    case "stack":
      d.layers.forEach((l, i) => {
        add(`layers[${i}].label`, l.label);
        add(`layers[${i}].sub`, l.sub);
      });
      add("axis.low", d.axis.low);
      add("axis.high", d.axis.high);
      break;
    case "boundary": {
      const zone = (z: (typeof d.zones)[number], p: string) => {
        add(`${p}.label`, z.label);
        z.items.forEach((it, ii) => {
          add(`${p}.items[${ii}].label`, it.label);
          add(`${p}.items[${ii}].sub`, it.sub);
        });
      };
      d.zones.forEach((z, zi) => {
        zone(z, `zones[${zi}]`);
        z.zones?.forEach((n, ni) => zone({ ...n, zones: undefined }, `zones[${zi}].zones[${ni}]`));
      });
      d.crossings.forEach((c, i) => add(`crossings[${i}].label`, c.label));
      break;
    }
    case "lanes":
      d.lanes.forEach((l, i) => add(`lanes[${i}].label`, l.label));
      d.steps.forEach((s, i) => {
        add(`steps[${i}].label`, s.label);
        add(`steps[${i}].sub`, s.sub);
      });
      d.handoffs.forEach((h, i) => add(`handoffs[${i}].label`, h.label));
      if (d.marker) add("marker.label", d.marker.label);
      break;
  }
  return out;
}

/**
 * Returns one issue for each label line, `sub` or edge label that does not fit its box when measured
 * with `estimateTextWidth`, for each declared text the layout gave no box, and for a total height over
 * 560, in both orientations. An empty array means the diagram fits.
 *
 * A text that fails in both orientations yields one issue (path unique), naming the orientations.
 * Height issues use the path `layout`.
 */
export function checkLabelsFit(diagram: Diagram, layout: DiagramLayoutFn): DiagramIssue[] {
  const byPath = new Map<string, { reasons: string[]; orientations: DiagramOrientation[] }>();
  const order: string[] = [];
  const record = (path: string, orientation: DiagramOrientation, reason: string) => {
    let e = byPath.get(path);
    if (!e) {
      e = { reasons: [], orientations: [] };
      byPath.set(path, e);
      order.push(path);
    }
    if (!e.orientations.includes(orientation)) e.orientations.push(orientation);
    if (!e.reasons.includes(reason)) e.reasons.push(reason);
  };

  const slots = diagramTextSlots(diagram);

  for (const orientation of DIAGRAM_ORIENTATIONS) {
    const result = layout(diagram, orientation);

    if (!(result.height <= DIAGRAM_MAX_HEIGHT)) {
      record("layout", orientation, `height ${result.height} is over the ${DIAGRAM_MAX_HEIGHT} maximum`);
    }

    const boxed = new Set<string>();
    for (const box of result.boxes) {
      boxed.add(box.path);
      box.text.split("\n").forEach((line, i, lines) => {
        const width = estimateTextWidth(line, box.fontPx);
        if (width > box.maxWidth) {
          const which = lines.length > 1 ? `line ${i + 1} ` : "";
          record(
            box.path,
            orientation,
            `${which}"${line}" needs about ${Math.ceil(width)} but the box allows ${Math.floor(box.maxWidth)}`,
          );
        }
      });
    }
    for (const slot of slots) {
      if (!boxed.has(slot.path)) record(slot.path, orientation, "the layout gave this text no box");
    }
  }

  return order.map((path) => {
    const e = byPath.get(path)!;
    const both = e.orientations.length === DIAGRAM_ORIENTATIONS.length;
    const where = both ? "in both orientations" : `in the ${e.orientations[0]} layout`;
    return { path, reason: `${e.reasons.join("; ")} (${where})` };
  });
}

/** Formats issues the way the seed and `workflows:validate` print them: `<field>: <reason>`. */
export function formatDiagramIssues(issues: readonly DiagramIssue[]): string[] {
  return issues.map((i) => `${i.path}: ${i.reason}`);
}
