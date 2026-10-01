import type { LanesDiagram } from "@/lib/contracts/diagram";
import { DIAGRAM_GEOMETRY, nodeHeight } from "@/lib/diagram/fit";
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

/**
 * Grid form (horizontal, lanes v2, DESIGN §6.3.3): lanes as rows, time as columns, a numbered and arrowed time axis
 * below the last lane. Null when it does not fit 576 (then the timeline is used).
 */
export function lanesGrid(d: LanesDiagram): LayoutOutput | null {
  const boxes = new Boxes();
  const cols = Math.max(...d.steps.map((s) => s.col), d.marker?.col ?? 0);
  const pitch = (H_W + 24) / cols;
  const bw = pitch - 24;
  if (bw < 96) return null;

  const top = d.marker ? 24 : 0;
  let y = top;
  const rects = new Map<string, Rect>();
  const laneGroups: GroupPrim[] = [];
  const bands: { top: number; bottom: number; caption: number }[] = [];
  const rowCentre = new Map<string, number>();
  d.lanes.forEach((lane, li) => {
    const steps = d.steps.map((s, i) => ({ s, i })).filter(({ s }) => s.lane === lane.id);
    const rowH = Math.max(40, ...steps.map(({ s }) => stepH(s)));
    boxes.add(`lanes[${li}].label`, lane.label, 12, H_W, 0);
    const g: Prim[] = [text(0, y + 14, lane.label, { weight: 700, halo: true })];
    for (const { s, i } of steps) {
      const { g: ng, rect } = nodeGroup(boxes, {
        x: (s.col - 1) * pitch,
        y: y + 28,
        w: bw,
        label: s.label,
        sub: s.sub,
        key: s.emphasis,
        risk: s.style === "risk",
        labelPath: `steps[${i}].label`,
        subPath: `steps[${i}].sub`,
        ref: s.id,
      });
      rects.set(s.id, rect);
      g.push(ng);
    }
    bands.push({ top: y, bottom: y + 28, caption: est(lane.label, 12) });
    rowCentre.set(lane.id, y + 28 + rowH / 2);
    laneGroups.push({ k: "g", part: "lane", ref: lane.id, children: g });
    y += 28 + rowH + 12;
  });
  const bodyBottom = y - 12;

  // Time axis: a 12px gap, then a 44px band. "Time" caption row, then the line at band top + 30.
  const axisTop = bodyBottom + DIAGRAM_GEOMETRY.lanesAxisGap;
  const yAxis = axisTop + 30;
  const axisBottom = axisTop + DIAGRAM_GEOMETRY.lanesAxisBand;
  const used = [...new Set([...d.steps.map((s) => s.col), ...(d.marker ? [d.marker.col] : [])])].sort((a, b) => a - b);
  const axis: Prim[] = [text(0, axisTop + 12, "Time", { weight: 700, halo: true }), { k: "path", d: `M 0 ${n(yAxis)} H ${H_W}`, variant: "edge", end: "arrow" }];
  for (const col of used) {
    const cx = (col - 1) * pitch + bw / 2;
    axis.push({ k: "circle", cx: n(cx), cy: n(yAxis), r: 10, variant: "badge" }, text(cx, yAxis + 4, String(col), { size: 12, weight: 700, tone: "fg", anchor: "middle" }));
  }

  const children: Prim[] = [];
  // Marker: drawn first (z-order back), a tick that ends on the axis. Clamped on-canvas for column 1. It is never an obstacle.
  if (d.marker) {
    const risk = d.marker.style === "risk";
    boxes.add("marker.label", d.marker.label, 12, H_W, 0);
    const xm = Math.max((d.marker.col - 1) * pitch - 12, 6);
    const w = est(d.marker.label, 12);
    const tone = risk ? ("danger" as const) : ("muted" as const);
    const labelX = risk ? xm + 8 : xm + 6;
    const fitsRight = w <= H_W - labelX;
    const mk: Prim[] = [{ k: "path", d: `M ${n(xm)} ${top} V ${n(yAxis)}`, variant: risk ? "risk" : "edge" }];
    if (risk) mk.push({ k: "cross", x: n(xm - 5), y: 4, size: 10 });
    mk.push(fitsRight ? text(labelX, 14, d.marker.label, { tone }) : text(Math.max(xm - 6, w), 14, d.marker.label, { tone, anchor: "end" }));
    children.push({ k: "g", part: "marker", ...(risk ? { state: "risk" as const } : {}), children: mk });
  }
  children.push(...laneGroups, { k: "g", part: "axis", children: axis });

  // Handoffs: same-lane forward = straight; other-lane forward = one elbow in the gap before the target; else badge-only.
  // Each drawn line sits on a 6px stroke-surface underlay so it reads as crossing the marker.
  const stepById = new Map(d.steps.map((s) => [s.id, s]));
  const occupied = new Set(d.steps.map((s) => `${s.lane}/${s.col}`));
  const gapUse = new Map<number, number>();
  const ledger = new BadgeLedger();
  const handoffGroups: GroupPrim[] = [];
  const badgeGroups: { g: GroupPrim; badges: Prim[] }[] = [];
  d.handoffs.forEach((h, i) => {
    const a = rects.get(h.from)!;
    const b = rects.get(h.to)!;
    const sa = stepById.get(h.from)!;
    const sb = stepById.get(h.to)!;
    const risk = h.style === "risk";
    const stop = risk ? 6 : 0;
    const clearBetween = (lane: string) => {
      for (let c = sa.col + 1; c < sb.col; c++) if (occupied.has(`${lane}/${c}`)) return false;
      return true;
    };
    let dPath: string | null = null;
    if (sb.col > sa.col) {
      const ya = rowCentre.get(sa.lane)!;
      const yb = rowCentre.get(sb.lane)!;
      if (sa.lane === sb.lane) {
        if (clearBetween(sa.lane)) dPath = `M ${n(a.x + a.w)} ${n(ya)} H ${n(b.x - stop)}`;
      } else if (clearBetween(sa.lane)) {
        const offsets = d.marker?.col === sb.col ? [8, -8] : [0, 8, -8];
        const slot = gapUse.get(sb.col) ?? 0;
        const off = offsets[slot];
        const xv = (sb.col - 1) * pitch - 12 + (off ?? 0);
        const lo = Math.min(ya, yb);
        const hi = Math.max(ya, yb);
        const crossed = bands.filter((bd) => bd.bottom > lo && bd.top < hi);
        if (off !== undefined && crossed.every((bd) => xv > bd.caption + 8)) {
          gapUse.set(sb.col, slot + 1);
          dPath = `M ${n(a.x + a.w)} ${n(ya)} H ${n(xv)} V ${n(yb)} H ${n(b.x - stop)}`;
        }
      }
    }
    const g: Prim[] = [];
    if (dPath) {
      g.push({ k: "path", d: dPath, variant: "underlay" }, { k: "path", d: dPath, variant: risk ? "risk" : "edge", end: risk ? "x" : "arrow" });
    }
    const p = ledger.place(h.from, a);
    const q = ledger.place(h.to, b);
    const badges = [...badge(p.cx, p.cy, i + 1, risk), ...badge(q.cx, q.cy, i + 1, risk)];
    const grp: GroupPrim = { k: "g", part: "handoff", ...(risk ? { state: "risk" as const } : {}), children: g };
    handoffGroups.push(grp);
    badgeGroups.push({ g: grp, badges });
  });
  // Back to front: underlays and lines, then badges.
  badgeGroups.forEach(({ g, badges }) => g.children.push(...badges));
  children.push(...handoffGroups);

  let height = axisBottom;
  if (d.handoffs.length > 0) {
    const lg = legend(boxes, legendEntries(d), H_W, axisBottom + 16, false);
    children.push(lg.g);
    height = axisBottom + 16 + lg.h;
  }
  if (!boxesFit(boxes.list)) return null;
  const usesX = d.marker?.style === "risk" || d.handoffs.some((h) => h.style === "risk");
  return { drawing: { width: H_W, height, children, usesX }, mode: "row", boxes: boxes.list };
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
        risk: s.style === "risk",
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
