import type { StackDiagram } from "@/lib/contracts/diagram";
import { Boxes, n, nodeGroup, text } from "./common";
import type { LayoutOutput, Prim } from "./model";

/** `stack` has one arrangement, used at both widths (DESIGN §6.3.3). `width` is 576 or 280. */
export function layoutStack(d: StackDiagram, width: number): LayoutOutput {
  const boxes = new Boxes();
  const children: Prim[] = [];
  const x = 24;
  const w = width - x;
  const layersTop = 20;
  let y = layersTop;
  // Authored bottom to top, drawn top to bottom: the last layer is highest on the page.
  for (let i = d.layers.length - 1; i >= 0; i--) {
    const l = d.layers[i]!;
    const { g, h } = nodeGroup(boxes, {
      x,
      y,
      w,
      label: l.label,
      sub: l.sub,
      key: l.emphasis,
      labelPath: `layers[${i}].label`,
      subPath: `layers[${i}].sub`,
      ref: l.id,
    });
    children.push(g);
    y += h + 8;
  }
  const layersBottom = y - 8;
  boxes.add("axis.high", d.axis.high, 12, width, 0);
  boxes.add("axis.low", d.axis.low, 12, width, 0);
  children.push({
    k: "g",
    part: "axis",
    children: [
      text(0, 12, d.axis.high),
      { k: "path", d: `M 10 ${n(layersBottom)} V ${n(layersTop)}`, variant: "edge", end: "arrow" },
      text(0, layersBottom + 16, d.axis.low),
    ],
  });
  // 40 (two label bands) + the layers + 8 per gap.
  return { drawing: { width, height: layersBottom + 20, children, usesX: false }, boxes: boxes.list };
}
