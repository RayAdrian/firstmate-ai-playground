import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiagramFigure } from "@/components/diagram/diagram-figure";
import { layoutDiagram } from "@/components/diagram/layout";
import type { GroupPrim, Prim } from "@/components/diagram/layout/model";
import { diagramLayout } from "@/components/diagram/layout";
import { validateDiagramValue } from "@/components/diagram/parse";
import type { DiagramInput } from "@/lib/contracts/diagram";
import { checkLabelsFit } from "@/lib/diagram/fit";
import { expectLabelsFit } from "../../support/diagram-fit";
import { parse } from "../g0/fixtures";

type LanesInput = Extract<DiagramInput, { type: "lanes" }>;

/** The worked example from DESIGN §6.3.3 (lanes v2): lesson 5.3. */
const WORKED: LanesInput = {
  type: "lanes",
  id: "pinned-approval",
  title: "An approval covers one commit",
  summary: "The review checked A. Once the head moves to B, success on A is refused, so B needs its own review.",
  lanes: [
    { id: "author", label: "Author" },
    { id: "reviewer", label: "Reviewer" },
  ],
  steps: [
    { id: "review-a", lane: "reviewer", col: 1, label: "Review A" },
    { id: "push-b", lane: "author", col: 2, label: "Push B" },
    { id: "post-a", lane: "reviewer", col: 3, label: "Post success on A", sub: "refused: A not head", emphasis: true, style: "risk" },
  ],
  handoffs: [{ from: "review-a", to: "post-a", label: "stale result" }],
  marker: { col: 3, label: "head moves to B", style: "risk" },
};

const walk = (prims: readonly Prim[], visit: (p: Prim, parents: GroupPrim[]) => void, parents: GroupPrim[] = []): void => {
  for (const p of prims) {
    visit(p, parents);
    if (p.k === "g") walk(p.children, visit, [...parents, p]);
  }
};
const parts = (d: ReturnType<typeof parse>, part: string): GroupPrim[] => {
  const out: GroupPrim[] = [];
  walk(layoutDiagram(d, "horizontal").drawing.children, (p) => {
    if (p.k === "g" && p.part === part) out.push(p);
  });
  return out;
};

describe("lanes v2: the worked 5.3 example (DESIGN §6.3.3)", () => {
  const d = parse(WORKED);
  const out = layoutDiagram(d, "horizontal");

  it("fits the grid at 282 high, and the check passes in both orientations", () => {
    expect(out.mode).toBe("row");
    expect(out.drawing.width).toBe(576);
    expect(out.drawing.height).toBe(282);
    expectLabelsFit(d, diagramLayout);
  });

  it("has a time axis with a circle per used column at 88, 288 and 488, on the line at y 232", () => {
    const [axis] = parts(d, "axis");
    const circles = axis!.children.filter((c) => c.k === "circle");
    expect(circles.map((c) => (c.k === "circle" ? [c.cx, c.cy] : []))).toEqual([[88, 232], [288, 232], [488, 232]]);
    const line = axis!.children.find((c) => c.k === "path");
    expect(line && line.k === "path" && line.d).toBe("M 0 232 H 576");
    expect(line && line.k === "path" && line.end).toBe("arrow");
    // The line comes before the circles so they sit on it.
    expect(axis!.children.findIndex((c) => c.k === "path")).toBeLessThan(axis!.children.findIndex((c) => c.k === "circle"));
    const word = axis!.children.find((c) => c.k === "text" && c.text === "Time");
    expect(word && word.k === "text" && [word.x, word.y]).toEqual([0, 214]);
  });

  it("draws the same-lane handoff straight across the marker, on a 6px underlay", () => {
    const [h] = parts(d, "handoff");
    const paths = h!.children.filter((c) => c.k === "path");
    expect(paths.map((p) => (p.k === "path" ? [p.variant, p.d] : []))).toEqual([
      ["underlay", "M 176 161 H 400"],
      ["edge", "M 176 161 H 400"],
    ]);
  });

  it("z-order: marker first, then lanes, then the axis, then handoffs, then the legend", () => {
    const order = out.drawing.children.map((c) => (c.k === "g" ? c.part : c.k));
    expect(order).toEqual(["marker", "lane", "lane", "axis", "handoff", "legend"]);
  });

  it("places the marker tick at 388 down to the axis, with the cross at 383 and the label at 396", () => {
    const [m] = parts(d, "marker");
    const line = m!.children.find((c) => c.k === "path");
    expect(line && line.k === "path" && line.d).toBe("M 388 24 V 232");
    const cross = m!.children.find((c) => c.k === "cross");
    expect(cross && cross.k === "cross" && cross.x).toBe(383);
    const label = m!.children.find((c) => c.k === "text");
    expect(label && label.k === "text" && label.x).toBe(396);
  });

  it("the key risk step is a 2px dashed danger box with a bold label, tagged key and risk", () => {
    const { container } = render(<DiagramFigure diagram={d} />);
    const g = container.querySelector('svg[aria-labelledby$="-title-h"] [data-part="node"][data-state~="key"][data-state~="risk"]')!;
    expect(g.getAttribute("data-state")).toBe("key risk");
    const rect = g.querySelector("rect")!;
    expect(rect.getAttribute("stroke-width")).toBe("2");
    expect(rect.getAttribute("stroke-dasharray")).toBe("6 4");
    expect(rect.getAttribute("class")).toContain("stroke-danger");
    expect(rect.getAttribute("class")).toContain("fill-surface-raised");
    expect(rect.getAttribute("class")).not.toContain("fill-accent-soft");
    expect(g.querySelector("text")!.getAttribute("class")).toContain("font-bold");
    // The timeline carries it too.
    expect(container.querySelector('svg[aria-labelledby$="-title-v"] [data-state="key risk"]')).not.toBeNull();
  });

  it("the text alternative appends (risk) after (key)", () => {
    const { container } = render(<DiagramFigure diagram={d} />);
    const text = container.querySelector("details [role=region]")!.textContent!;
    expect(text).toContain("Time 3, Reviewer: Post success on A: refused: A not head (key) (risk)");
    expect(text).toContain("Time 3, event: head moves to B (risk)");
    expect(text).toContain("Review A to Post success on A: stale result.");
  });
});

describe("lanes v2: handoff routing", () => {
  const base = (over: Partial<LanesInput>): LanesInput => ({ ...WORKED, ...over });

  it("an other-lane forward handoff into the marker's column takes one elbow at offset +8", () => {
    const d = parse(
      base({
        steps: [
          { id: "a", lane: "author", col: 1, label: "A" },
          { id: "b", lane: "reviewer", col: 3, label: "B" },
        ],
        handoffs: [{ from: "a", to: "b" }],
        marker: { col: 3, label: "moves", style: "ok" },
      }),
    );
    const [h] = parts(d, "handoff");
    const line = h!.children.filter((c) => c.k === "path")[1];
    // gap before col 3 is x 388; +8 puts the vertical at 396, never on the marker.
    expect(line && line.k === "path" && /H 396 V /.test(line.d)).toBe(true);
  });

  it("a gap without a marker uses 0 first, then +8", () => {
    const d = parse(
      base({
        lanes: [
          { id: "author", label: "Author" },
          { id: "reviewer", label: "Reviewer" },
          { id: "head", label: "Head" },
        ],
        steps: [
          { id: "a", lane: "author", col: 2, label: "A" },
          { id: "c", lane: "head", col: 2, label: "C" },
          { id: "b", lane: "reviewer", col: 3, label: "B" },
        ],
        handoffs: [
          { from: "a", to: "b" },
          { from: "c", to: "b" },
        ],
        marker: undefined,
      }),
    );
    const lines = parts(d, "handoff").map((h) => (h.children.filter((c) => c.k === "path")[1] as { d: string }).d);
    expect(lines[0]).toMatch(/H 388 V /);
    expect(lines[1]).toMatch(/H 396 V /);
  });

  it("a backward or same-column handoff is badge-only", () => {
    const d = parse(
      base({
        steps: [
          { id: "a", lane: "author", col: 2, label: "A" },
          { id: "b", lane: "reviewer", col: 1, label: "B" },
          { id: "c", lane: "reviewer", col: 2, label: "C" },
        ],
        handoffs: [
          { from: "a", to: "b" },
          { from: "a", to: "c" },
        ],
        marker: undefined,
      }),
    );
    for (const h of parts(d, "handoff")) expect(h.children.some((c) => c.k === "path")).toBe(false);
    expect(parts(d, "handoff")).toHaveLength(2);
  });

  it("a same-lane handoff over an occupied cell is badge-only", () => {
    const d = parse(
      base({
        steps: [
          { id: "a", lane: "author", col: 1, label: "A" },
          { id: "m", lane: "author", col: 2, label: "M" },
          { id: "b", lane: "author", col: 3, label: "B" },
        ],
        handoffs: [{ from: "a", to: "b" }],
        marker: undefined,
      }),
    );
    expect(parts(d, "handoff")[0]!.children.some((c) => c.k === "path")).toBe(false);
  });

  it("a risk handoff is dashed and ends in the x cap, with a dashed-badge pair", () => {
    const d = parse(base({ handoffs: [{ from: "review-a", to: "post-a", style: "risk" }] }));
    const [h] = parts(d, "handoff");
    const line = h!.children.filter((c) => c.k === "path")[1];
    expect(line && line.k === "path" && [line.variant, line.end]).toEqual(["risk", "x"]);
    expect(h!.state).toBe("risk");
  });
});

describe("lanes v2: the grid across 1 to 6 columns", () => {
  const diagramFor = (c: number): ReturnType<typeof parse> =>
    parse({
      type: "lanes",
      id: `cols-${c}`,
      title: "T",
      summary: "S",
      lanes: [
        { id: "a", label: "Author" },
        { id: "b", label: "Reviewer" },
      ],
      steps: Array.from({ length: Math.max(c, 2) }, (_, i) => ({ id: `s${i + 1}`, lane: i % 2 === 0 ? "a" : "b", col: Math.min(i + 1, c), label: `S${i + 1}` })).slice(0, c === 1 ? 2 : c).map((s, i) => (c === 1 ? { ...s, lane: i === 0 ? "a" : "b", col: 1 } : s)),
      handoffs: [],
    } as DiagramInput);

  it.each([1, 2, 3, 4, 5, 6])("c = %i: labels fit both orientations and the height stays within 560", (c) => {
    const d = diagramFor(c);
    expect(checkLabelsFit(d, diagramLayout)).toEqual([]);
    for (const o of ["horizontal", "vertical"] as const) expect(layoutDiagram(d, o).drawing.height).toBeLessThanOrEqual(560);
  });

  it.each([1, 2, 3, 4, 5])("c = %i: axis circles sit at the column centres, clear of 'Time' and the arrowhead", (c) => {
    const d = diagramFor(c);
    expect(layoutDiagram(d, "horizontal").mode).toBe("row");
    const [axis] = parts(d, "axis");
    const xs = axis!.children.flatMap((p) => (p.k === "circle" ? [p.cx] : []));
    expect(xs).toHaveLength(c);
    const pitch = 600 / c;
    xs.forEach((x, i) => expect(x).toBeCloseTo(i * pitch + (pitch - 24) / 2, 1));
    for (const x of xs) {
      expect(x - 10).toBeGreaterThanOrEqual(28);
      expect(x + 10).toBeLessThanOrEqual(548);
    }
  });

  it("c = 6: the boxes are under the 96 minimum, so the horizontal SVG uses the timeline", () => {
    const out = layoutDiagram(diagramFor(6), "horizontal");
    expect(out.mode).toBe("stacked");
    expect(out.drawing.width).toBe(280);
  });

  it("the grid is the old height plus the 12px gap and 44px band", () => {
    const d = diagramFor(3);
    // marker none: 2 lanes x (28 + 40) + 12 between + 12 gap + 44 band = 204
    expect(layoutDiagram(d, "horizontal").drawing.height).toBe(28 + 40 + 12 + 28 + 40 + 12 + 44);
  });
});

describe("lanes v2: a marker at column 1 stays on the canvas", () => {
  it("clamps the tick, the cross and the label inside 0..576", () => {
    const d = parse({ ...WORKED, marker: { col: 1, label: "head moves to B", style: "risk" } });
    const out = layoutDiagram(d, "horizontal");
    expect(out.mode).toBe("row");
    const [m] = parts(d, "marker");
    const xs: number[] = [];
    for (const c of m!.children) {
      if (c.k === "path") xs.push(...(c.d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number).filter((_, i) => i % 2 === 0));
      if (c.k === "cross") xs.push(c.x, c.x + c.size);
      if (c.k === "text") xs.push(c.x);
    }
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(576);
    }
    expect(layoutDiagram(parse({ ...WORKED, marker: { col: 1, label: "x", style: "ok" } }), "horizontal").drawing.width).toBe(576);
  });
});

describe("lanes v2: the no-handoffs authoring note", () => {
  const without = (cols: number) =>
    ({ ...WORKED, handoffs: [], marker: undefined, steps: WORKED.steps.map((s) => ({ ...s, col: Math.min(s.col, cols) })).filter((s, i, a) => a.findIndex((t) => t.lane === s.lane && t.col === s.col) === i) }) as LanesInput;

  it("is printed for 3 or more columns and not for fewer", () => {
    const three = validateDiagramValue(without(3));
    expect(three.ok && three.notes).toContain("diagram pinned-approval: lanes with no handoffs reads as unconnected boxes; add the handoff that carries the story");
    const two = validateDiagramValue(without(2));
    expect(two.ok && two.notes.filter((n) => /no handoffs/.test(n))).toEqual([]);
  });

  it("is not printed when there is a handoff", () => {
    const r = validateDiagramValue(WORKED);
    expect(r.ok && r.notes.filter((n) => /no handoffs/.test(n))).toEqual([]);
  });
});

describe("lanes v2: the contract", () => {
  it("lane steps default to style normal and accept risk", () => {
    const d = parse({ ...WORKED, steps: WORKED.steps.map((s) => ({ ...s, style: undefined })) as LanesInput["steps"] });
    expect(d.type === "lanes" && d.steps.every((s) => s.style === "normal")).toBe(true);
    expect(validateDiagramValue(WORKED).ok).toBe(true);
  });
});
