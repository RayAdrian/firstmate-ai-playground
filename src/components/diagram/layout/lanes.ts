import type { LanesDiagram } from "@/lib/contracts/diagram";
import { nodeHeight } from "@/lib/diagram/fit";
import {
  BadgeLedger,
  Boxes,
  H_W,
  V_W,
  badge,
  boxesFit,
  est,
  flat,
  legend,
  lines,
  n,
  nodeGroup,
  text,
  type LegendEntry,
  type Rect,
} from "./common";
import type { GroupPrim, LayoutOutput, Prim } from "./model";

type Step = LanesDiagram["steps"][number];
const stepH = (s: Step): number => nodeHeight(lines(s.label).length, s.sub !== undefined);

function legendEntries(d: LanesDiagram): LegendEntry[] {
  const labels = new Map(d.steps.map((s) => [s.id, flat(s.label)]));
  return d.handoffs.map((h, i) => ({
    n: i + 1,
    text: `${h.label ? `${h.label}: ` : ""}${labels.get(h.from) ?? h.from} → ${labels.get(h.to) ?? h.to}`,
    risk: h.style === "risk",
    ...(h.label ? { path: `handoffs[${i}].label`, label: h.label } : {}),
  }));
}

/** Grid form (horizontal): lanes as rows, time as columns. Null when it does not fit 576 (then the timeline is used). */
export function lanesGrid(d: LanesDiagram): LayoutOutput | null {
  const boxes = new Boxes();
  const children: Prim[] = [];
  const cols = Math.max(...d.steps.map((s) => s.col), d.marker?.col ?? 0);
  const pitch = (H_W + 24) / cols;
  const bw = pitch - 24;
  if (bw < 96) return null;
  const markerX = d.marker ? (d.marker.col - 1) * pitch - 12 : 0;
  if (d.marker && markerX < 0) return null; // a marker before column 1 has no gap to sit in

  const top = d.marker ? 24 : 0;
  let y = top;
  const rects = new Map<string, Rect>();
  const laneRows: { y: number; h: number }[] = [];
  const laneGroups: GroupPrim[] = [];
  d.lanes.forEach((lane, li) => {
    const steps = d.steps.map((s, i) => ({ s, i })).filter(({ s }) => s.lane === lane.id);
    const rowH = Math.max(40, ...steps.map(({ s }) => stepH(s)));
    boxes.add(`lanes[${li}].label`, lane.label, 12, H_W, 0);
    const g: Prim[] = [text(0, y + 14, lane.label, { weight: 700 })];
    for (const { s, i } of steps) {
      const { g: ng, rect } = nodeGroup(boxes, {
        x: (s.col - 1) * pitch,
        y: y + 28,
        w: bw,
        label: s.label,
        sub: s.sub,
        key: s.emphasis,
        labelPath: `steps[${i}].label`,
        subPath: `steps[${i}].sub`,
        ref: s.id,
      });
      rects.set(s.id, rect);
      g.push(ng);
    }
    laneRows.push({ y, h: rowH });
    laneGroups.push({ k: "g", part: "lane", ref: lane.id, children: g });
    y += 28 + rowH + 12;
  });
  const bodyBottom = y - 12;
  children.push(...laneGroups);

  if (d.marker) {
    const risk = d.marker.style === "risk";
    boxes.add("marker.label", d.marker.label, 12, H_W, 0);
    const fitsRight = est(d.marker.label, 12) <= H_W - (markerX + 6);
    children.push({
      k: "g",
      part: "marker",
      ...(risk ? { state: "risk" as const } : {}),
      children: [
        { k: "path", d: `M ${n(markerX)} ${top} V ${n(bodyBottom)}`, variant: risk ? "risk" : "edge", ...(risk ? { start: "x" as const } : {}) },
        fitsRight
          ? text(markerX + 6, 14, d.marker.label, { tone: risk ? "danger" : "muted" })
          : text(markerX - 6, 14, d.marker.label, { tone: risk ? "danger" : "muted", anchor: "end" }),
      ],
    });
  }

  // Handoffs: a line when the target is in the next column and the vertical stays clear of the lane captions.
  const maxCaption = Math.max(...d.lanes.map((l) => est(l.label, 12)));
  const stepById = new Map(d.steps.map((s) => [s.id, s]));
  const ledger = new BadgeLedger();
  const gapCount = new Map<number, number>();
  d.handoffs.forEach((h, i) => {
    const a = rects.get(h.from)!;
    const b = rects.get(h.to)!;
    const sa = stepById.get(h.from)!;
    const sb = stepById.get(h.to)!;
    const risk = h.style === "risk";
    const g: Prim[] = [];
    const slot = gapCount.get(sa.col) ?? 0;
    const gx = sa.col * pitch - 12 + [6, -6, 9, -9][slot % 4]!;
    if (sb.col === sa.col + 1 && gx > maxCaption + 8) {
      gapCount.set(sa.col, slot + 1);
      const sy = a.y + a.h / 2;
      const ty = b.y + b.h / 2;
      const tx = b.x - (risk ? 6 : 0);
      const dPath = sy === ty ? `M ${n(a.x + a.w)} ${n(sy)} H ${n(tx)}` : `M ${n(a.x + a.w)} ${n(sy)} H ${n(gx)} V ${n(ty)} H ${n(tx)}`;
      g.push({ k: "path", d: dPath, variant: risk ? "risk" : "edge", end: risk ? "x" : "arrow" });
    }
    const p = ledger.place(h.from, a);
    const q = ledger.place(h.to, b);
    g.push(...badge(p.cx, p.cy, i + 1, risk), ...badge(q.cx, q.cy, i + 1, risk));
    children.push({ k: "g", part: "handoff", ...(risk ? { state: "risk" as const } : {}), children: g });
  });

  let height = bodyBottom;
  if (d.handoffs.length > 0) {
    const lg = legend(boxes, legendEntries(d), H_W, bodyBottom + 16, false);
    children.push(lg.g);
    height = bodyBottom + 16 + lg.h;
  }
  if (!boxesFit(boxes.list)) return null;
  const drawing = { width: H_W, height, children, usesX: d.marker?.style === "risk" || d.handoffs.some((h) => h.style === "risk") };
  return { drawing, mode: "row", boxes: boxes.list };
}

/** Timeline (vertical, and the horizontal fallback): lanes become labels on the boxes and time runs down. 280 wide. */
export function lanesTimeline(d: LanesDiagram): LayoutOutput {
  const boxes = new Boxes();
  const children: Prim[] = [];
  const laneIndex = new Map(d.lanes.map((l, i) => [l.id, i]));
  const colsUsed = [...new Set([...d.steps.map((s) => s.col), ...(d.marker ? [d.marker.col] : [])])].sort((a, b) => a - b);
  d.lanes.forEach((l, i) => boxes.add(`lanes[${i}].label`, l.label, 12, V_W - 36));

  // Badges straddle the first box's top border, so leave room above it.
  let y = d.handoffs.length > 0 ? 9 : 0;
  const rects = new Map<string, Rect>();
  const perLane = new Map<string, Prim[]>(d.lanes.map((l) => [l.id, []]));
  const circles: Prim[] = [];
  let firstCircle: number | null = null;
  let markerGroup: GroupPrim | null = null;

  colsUsed.forEach((col, ci) => {
    if (d.marker && d.marker.col === col) {
      const risk = d.marker.style === "risk";
      boxes.add("marker.label", d.marker.label, 12, V_W - 14, 0);
      const mid: Prim[] = [];
      if (risk) mid.push({ k: "cross", x: 0, y: y + 5, size: 10 });
      mid.push(
        text(risk ? 14 : 0, y + 14, d.marker.label, { tone: risk ? "danger" : "muted" }),
        { k: "path", d: `M 0 ${y + 22} H ${V_W}`, variant: risk ? "risk" : "edge" },
      );
      markerGroup = { k: "g", part: "marker", ...(risk ? { state: "risk" as const } : {}), children: mid };
      children.push(markerGroup);
      y += 34;
    }
    const group = d.steps
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.col === col)
      .sort((p, q) => (laneIndex.get(p.s.lane) ?? 0) - (laneIndex.get(q.s.lane) ?? 0));
    group.forEach(({ s, i }, k) => {
      const lane = d.lanes[laneIndex.get(s.lane) ?? 0]!;
      const { g, h, rect } = nodeGroup(boxes, {
        x: 36,
        y,
        w: V_W - 36,
        label: s.label,
        sub: s.sub,
        key: s.emphasis,
        labelPath: `steps[${i}].label`,
        subPath: `steps[${i}].sub`,
        ref: s.id,
        eyebrow: { text: lane.label, path: `lanes[${laneIndex.get(s.lane) ?? 0}].label` },
        noBoxes: false,
      });
      rects.set(s.id, rect);
      perLane.get(s.lane)?.push(g);
      if (k === 0) {
        const cy = y + 18;
        firstCircle ??= cy;
        circles.push(
          { k: "circle", cx: 14, cy, r: 10, variant: "badge" },
          text(14, cy + 4, String(col), { size: 12, weight: 700, tone: "fg", anchor: "middle" }),
        );
      }
      y += h + (k === group.length - 1 ? 0 : 12);
    });
    if (group.length > 0 && ci < colsUsed.length - 1) y += 16;
  });
  const bodyBottom = y;

  d.lanes.forEach((l) => {
    children.push({ k: "g", part: "lane", ref: l.id, children: perLane.get(l.id) ?? [] });
  });
  // The time rail: a line with an arrowhead pointing down, and one circle per column used.
  if (firstCircle !== null) {
    children.push({
      k: "g",
      part: "axis",
      children: [{ k: "path", d: `M 14 ${n(firstCircle)} V ${n(bodyBottom)}`, variant: "edge", end: "arrow" }, ...circles],
    });
  }

  const ledger = new BadgeLedger();
  d.handoffs.forEach((h, i) => {
    const risk = h.style === "risk";
    const p = ledger.place(h.from, rects.get(h.from)!);
    const q = ledger.place(h.to, rects.get(h.to)!);
    children.push({
      k: "g",
      part: "handoff",
      ...(risk ? { state: "risk" as const } : {}),
      children: [...badge(p.cx, p.cy, i + 1, risk), ...badge(q.cx, q.cy, i + 1, risk)],
    });
  });

  let height = bodyBottom;
  if (d.handoffs.length > 0) {
    const lg = legend(boxes, legendEntries(d), V_W, bodyBottom + 16, true);
    children.push(lg.g);
    height = bodyBottom + 16 + lg.h;
  }
  const drawing = { width: V_W, height, children, usesX: d.marker?.style === "risk" || d.handoffs.some((h) => h.style === "risk") };
  return { drawing, boxes: boxes.list };
}
