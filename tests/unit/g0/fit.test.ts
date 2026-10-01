// @vitest-environment node
import { describe, expect, it } from "vitest";
import { estimateTextWidth, type Diagram, type DiagramInput } from "@/lib/contracts/diagram";
import {
  checkLabelsFit,
  diagramTextSlots,
  formatDiagramIssues,
  type DiagramLayoutFn,
  type DiagramOrientation,
  type LayoutTextBox,
} from "@/lib/diagram/fit";
import { expectLabelsFit } from "../../support/diagram-fit";
import {
  L24,
  boundaryInput,
  capBoundary,
  capFlow,
  capLanes,
  capStack,
  flowInput,
  label2,
  lanesInput,
  parse,
  stackInput,
} from "./fixtures";

/** A stand-in for G1's layout: every text gets a box wide enough for a 24-char line. */
const WIDE: Record<DiagramOrientation, number> = { horizontal: 230, vertical: 230 };
const fontFor = (path: string) => (/\.sub$|\.next$|^loops|^crossings|^handoffs|^axis/.test(path) ? 12 : 14);

function layoutWith(opts: {
  height?: number;
  maxWidth?: (path: string, o: DiagramOrientation) => number;
  skip?: (path: string) => boolean;
}): DiagramLayoutFn {
  return (d: Diagram, o: DiagramOrientation) => ({
    height: opts.height ?? 400,
    boxes: diagramTextSlots(d)
      .filter((s) => !opts.skip?.(s.path))
      .map<LayoutTextBox>((s) => ({
        path: s.path,
        text: s.text,
        fontPx: fontFor(s.path),
        maxWidth: opts.maxWidth?.(s.path, o) ?? WIDE[o],
      })),
  });
}

const everyType = [
  ["flow", flowInput],
  ["stack", stackInput],
  ["boundary", boundaryInput],
  ["lanes", lanesInput],
  ["flow caps", capFlow],
  ["stack caps", capStack],
  ["boundary caps", capBoundary],
  ["lanes caps", capLanes],
] as const;

describe("checkLabelsFit", () => {
  it.each(everyType)("%s: a generous layout returns no issues", (_n, make) => {
    const d = parse(make());
    expect(checkLabelsFit(d, layoutWith({}))).toEqual([]);
    expect(() => expectLabelsFit(d, layoutWith({}))).not.toThrow();
  });

  it("measures with estimateTextWidth: a 24-char line at 14px is exactly at the boundary", () => {
    const d = parse(flowInput());
    const need = estimateTextWidth(L24, 14);
    const fits = layoutWith({ maxWidth: (p) => (p === "steps[0].label" ? need : 999) });
    const fails = layoutWith({ maxWidth: (p) => (p === "steps[0].label" ? need - 0.01 : 999) });
    // fontFor("steps[0].label") is 14 and the label is "Ask" (3 chars), so use a long label instead.
    const long = parse({ ...flowInput(), steps: [{ id: "a", label: L24 }, { id: "b", label: "B" }], loops: [], exits: [] } as DiagramInput);
    expect(checkLabelsFit(long, fits)).toEqual([]);
    const issues = checkLabelsFit(long, fails);
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe("steps[0].label");
    expect(d.type).toBe("flow");
  });

  it("one too-wide label yields exactly one issue naming its path, even in both orientations", () => {
    const d = parse(flowInput());
    const issues = checkLabelsFit(d, layoutWith({ maxWidth: (p) => (p === "steps[1].sub" ? 10 : 230) }));
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe("steps[1].sub");
    expect(issues[0].reason).toMatch(/both orientations/);
    expect(issues[0].reason).toContain("agent proposes");
  });

  it("an orientation-specific overflow names that orientation", () => {
    const d = parse(flowInput());
    const issues = checkLabelsFit(d, layoutWith({ maxWidth: (p, o) => (p === "loops[0].label" && o === "vertical" ? 5 : 230) }));
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe("loops[0].label");
    expect(issues[0].reason).toMatch(/vertical layout/);
    expect(issues[0].reason).not.toMatch(/horizontal/);
  });

  it("measures each line of a two-line label on its own, and names the line", () => {
    const d = parse({ ...flowInput(), steps: [{ id: "a", label: `short\n${L24}` }, { id: "b", label: "B" }], loops: [], exits: [] } as DiagramInput);
    const need = estimateTextWidth(L24, 14);
    // Wide enough for the long second line: fits. A box sized for the whole 2-line string is irrelevant.
    expect(checkLabelsFit(d, layoutWith({ maxWidth: () => need }))).toEqual([]);
    const issues = checkLabelsFit(d, layoutWith({ maxWidth: () => need - 1 }));
    expect(issues.map((i) => i.path)).toEqual(["steps[0].label"]);
    expect(issues[0].reason).toContain("line 2");
    expect(issues[0].reason).not.toContain("line 1");
  });

  it("flags each overflowing text separately, in a stable order", () => {
    const d = parse(stackInput());
    const issues = checkLabelsFit(d, layoutWith({ maxWidth: () => 1 }));
    const paths = issues.map((i) => i.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toEqual(diagramTextSlots(d).map((s) => s.path));
  });

  describe("height", () => {
    it.each([
      [560, 0],
      [560.5, 1],
      [900, 1],
    ])("height %s gives %s issue(s)", (height, n) => {
      const issues = checkLabelsFit(parse(flowInput()), layoutWith({ height }));
      expect(issues).toHaveLength(n);
      if (n) expect(issues[0].path).toBe("layout");
    });
    it("a height problem in one orientation only is named", () => {
      const base = layoutWith({});
      const layout: DiagramLayoutFn = (d, o) => ({ ...base(d, o), height: o === "vertical" ? 600 : 300 });
      const issues = checkLabelsFit(parse(flowInput()), layout);
      expect(issues).toHaveLength(1);
      expect(issues[0].reason).toMatch(/600.*560.*vertical/);
    });
    it("NaN height fails", () => {
      expect(checkLabelsFit(parse(flowInput()), layoutWith({ height: NaN }))).toHaveLength(1);
    });
  });

  describe("a layout cannot silently omit a label", () => {
    it("reports a declared text with no box", () => {
      const d = parse(flowInput());
      const issues = checkLabelsFit(d, layoutWith({ skip: (p) => p === "exits[0].text" }));
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({ path: "exits[0].text" });
      expect(issues[0].reason).toMatch(/no box/);
    });
    it("ignores extra boxes the layout adds for text the diagram does not declare", () => {
      const d = parse(flowInput());
      const base = layoutWith({});
      const layout: DiagramLayoutFn = (dd, o) => {
        const r = base(dd, o);
        return { ...r, boxes: [...r.boxes, { path: "legend", text: "Key", fontPx: 12, maxWidth: 100 }] };
      };
      expect(checkLabelsFit(d, layout)).toEqual([]);
    });
  });

  describe("diagramTextSlots covers every text the diagram declares", () => {
    it("flow", () => {
      const paths = diagramTextSlots(parse(flowInput())).map((s) => s.path);
      expect(paths).toEqual([
        "steps[0].label", "steps[0].next",
        "steps[1].label", "steps[1].sub",
        "steps[2].label", "steps[3].label",
        "loops[0].label", "exits[0].label", "exits[0].text",
      ]);
    });
    it("stack", () => {
      expect(diagramTextSlots(parse(stackInput())).map((s) => s.path)).toEqual([
        "layers[0].label", "layers[1].label", "layers[1].sub", "layers[2].label", "axis.low", "axis.high",
      ]);
    });
    it("boundary, including nested zones", () => {
      expect(diagramTextSlots(parse(boundaryInput())).map((s) => s.path)).toEqual([
        "zones[0].label", "zones[0].items[0].label",
        "zones[0].zones[0].label", "zones[0].zones[0].items[0].label",
        "zones[1].label", "zones[1].items[0].label",
        "crossings[0].label", "crossings[1].label",
      ]);
    });
    it("lanes, including an optional handoff label and the marker", () => {
      expect(diagramTextSlots(parse(lanesInput())).map((s) => s.path)).toEqual([
        "lanes[0].label", "lanes[1].label",
        "steps[0].label", "steps[1].label", "steps[2].label",
        "handoffs[1].label", "marker.label",
      ]);
    });
    it("a two-line label is one slot carrying both lines", () => {
      const slots = diagramTextSlots(parse(capStack()));
      expect(slots.find((s) => s.path === "layers[0].label")?.text).toBe(label2);
    });
  });

  it("formatDiagramIssues prints `<path>: <reason>`", () => {
    expect(formatDiagramIssues([{ path: "a.b", reason: "too wide" }])).toEqual(["a.b: too wide"]);
  });
});

describe("expectLabelsFit", () => {
  it("throws listing the issues, so a failing fixture proves the check can fail", () => {
    const d = parse(stackInput());
    expect(() => expectLabelsFit(d, layoutWith({ maxWidth: (p) => (p === "layers[2].label" ? 1 : 230) }))).toThrow(
      /layers\[2\]\.label/,
    );
    expect(() => expectLabelsFit(d, layoutWith({ height: 700 }))).toThrow(/layout/);
  });
});
