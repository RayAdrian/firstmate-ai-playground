/**
 * The pure layout module (PRD §17.10, DESIGN §6.3.3). No React, so `scripts/` can import it.
 *
 *   layoutDiagram(d, orientation)  full drawing model + text boxes, for the renderer
 *   diagramLayout                  G0's `DiagramLayoutFn`: `{ height, mode, boxes }`, for `checkLabelsFit`
 *
 * Fit-or-stack: flow, boundary and lanes try their preferred horizontal arrangement at 576. If a label box is too
 * small or the arrangement does not fit, the horizontal SVG uses the stacked (vertical, 280 wide) geometry instead
 * and the layout reports `mode: "stacked"`. `stack` has one arrangement for both widths.
 */
import type { Diagram } from "@/lib/contracts/diagram";
import type { DiagramLayoutFn, DiagramLayoutResult, DiagramOrientation } from "@/lib/diagram/fit";
import { boundaryColumns, boundaryStacked } from "./boundary";
import { H_W, V_W } from "./common";
import { flowRow, flowStacked } from "./flow";
import { lanesGrid, lanesTimeline } from "./lanes";
import type { LayoutOutput } from "./model";
import { layoutStack } from "./stack";

export type { Drawing, DiagramPart, GroupPrim, LayoutOutput, Prim } from "./model";

export function layoutDiagram(d: Diagram, orientation: DiagramOrientation): LayoutOutput {
  const horizontal = orientation === "horizontal";
  switch (d.type) {
    case "stack":
      return layoutStack(d, horizontal ? H_W : V_W);
    case "flow": {
      const row = horizontal ? flowRow(d) : null;
      return row ?? { ...flowStacked(d), ...(horizontal ? { mode: "stacked" as const } : {}) };
    }
    case "boundary": {
      const cols = horizontal ? boundaryColumns(d) : null;
      return cols ?? { ...boundaryStacked(d), ...(horizontal ? { mode: "stacked" as const } : {}) };
    }
    case "lanes": {
      const grid = horizontal ? lanesGrid(d) : null;
      return grid ?? { ...lanesTimeline(d), ...(horizontal ? { mode: "stacked" as const } : {}) };
    }
  }
}

/** G0's layout contract, for `checkLabelsFit` / `expectLabelsFit`. */
export const diagramLayout: DiagramLayoutFn = (d, orientation): DiagramLayoutResult => {
  const out = layoutDiagram(d, orientation);
  return {
    height: out.drawing.height,
    ...(out.mode ? { mode: out.mode } : {}),
    boxes: out.boxes,
  };
};
