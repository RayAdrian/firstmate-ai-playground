import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DIAGRAM_MAX_HEIGHT, type DiagramInput } from "@/lib/contracts/diagram";
import { checkLabelsFit, type DiagramOrientation } from "@/lib/diagram/fit";
import { diagramLayout, layoutDiagram } from "@/components/diagram/layout";
import { expectLabelsFit } from "../../support/diagram-fit";
import {
  boundaryInput,
  capBoundary,
  capFlow,
  capLanes,
  capStack,
  flowInput,
  lanesInput,
  parse,
  stackInput,
} from "../g0/fixtures";

const LAYOUT_DIR = path.resolve(__dirname, "../../../src/components/diagram/layout");
const ORIENTATIONS: DiagramOrientation[] = ["horizontal", "vertical"];
const fixtures: [string, DiagramInput][] = [
  ["flow", flowInput()],
  ["stack", stackInput()],
  ["boundary", boundaryInput()],
  ["lanes", lanesInput()],
];
const caps: [string, DiagramInput][] = [
  ["flow", capFlow()],
  ["stack", capStack()],
  ["boundary", capBoundary()],
  ["lanes", capLanes()],
];

describe("layout against G0's checkLabelsFit (DG-3)", () => {
  it.each(fixtures)("a %s fixture fits in both orientations", (_t, input) => {
    expectLabelsFit(parse(input), diagramLayout);
  });

  it.each(caps)("the cap-maximum %s fixture has no width issues in either orientation", (_t, input) => {
    const issues = checkLabelsFit(parse(input), diagramLayout).filter((i) => i.path !== "layout");
    expect(issues).toEqual([]);
  });

  it.each(fixtures)("every %s layout gives every declared text a box and stays within the height cap", (_t, input) => {
    const d = parse(input);
    for (const o of ORIENTATIONS) {
      const out = layoutDiagram(d, o);
      expect(out.drawing.height).toBeLessThanOrEqual(DIAGRAM_MAX_HEIGHT);
      expect(out.drawing.width).toBe(o === "horizontal" && out.mode !== "stacked" ? 576 : 280);
    }
  });

  it("the check can fail: a 24-character line in a box that is 1px too narrow returns exactly one issue naming its path", () => {
    const d = parse(flowInput());
    const narrow: typeof diagramLayout = (diagram, o) => {
      const out = diagramLayout(diagram, o);
      return {
        ...out,
        boxes: out.boxes.map((b) => (b.path === "steps[0].label" ? { ...b, text: "a".repeat(24), boxWidth: 20 + 212 } : b)),
      };
    };
    const issues = checkLabelsFit(d, narrow);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toBe("steps[0].label");
  });

  it("height is a budget: six two-line steps with subs overflow 560 vertically and give exactly one height issue", () => {
    const d = parse(capFlow());
    const real = checkLabelsFit(d, diagramLayout);
    expect(real.map((i) => i.path)).toEqual(["layout"]);
  });

  it("a layout at exactly 560 passes and one pixel over gives exactly one height issue", () => {
    const d = parse(stackInput());
    const at = (height: number): typeof diagramLayout => (diagram, o) => ({ ...diagramLayout(diagram, o), height });
    expect(checkLabelsFit(d, at(DIAGRAM_MAX_HEIGHT))).toEqual([]);
    const over = checkLabelsFit(d, at(DIAGRAM_MAX_HEIGHT + 1));
    expect(over).toHaveLength(1);
    expect(over[0]?.path).toBe("layout");
  });

  it("falls back to the stacked geometry (viewBox 280) when a row would not fit, and reports it", () => {
    const d = parse(capFlow());
    const out = layoutDiagram(d, "horizontal");
    expect(out.mode).toBe("stacked");
    expect(out.drawing.width).toBe(280);
    const row = layoutDiagram(parse(flowInput()), "horizontal");
    expect(row.mode).toBe("row");
    expect(row.drawing.width).toBe(576);
  });

  it("every layout is deterministic and reproduces the same drawing", () => {
    for (const [, input] of fixtures) {
      const d = parse(input);
      for (const o of ORIENTATIONS) expect(JSON.stringify(layoutDiagram(d, o))).toBe(JSON.stringify(layoutDiagram(d, o)));
    }
  });

  it("the layout module has no React import, so scripts/ can use it", () => {
    for (const f of readdirSync(LAYOUT_DIR)) {
      expect(readFileSync(path.join(LAYOUT_DIR, f), "utf8"), f).not.toMatch(/from "react|from "next/);
    }
  });
});
