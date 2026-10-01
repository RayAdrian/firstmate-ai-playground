import type { FlowDiagram } from "@/lib/contracts/diagram";
import { nodeHeight } from "@/lib/diagram/fit";
import { Boxes, H_W, V_W, boxesFit, est, lines, n, nodeContentWidth, nodeGroup, text, type Rect } from "./common";
import type { Drawing, GroupPrim, LayoutOutput, Prim } from "./model";

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

/** Horizontal row form (DESIGN §6.3.3 `flow`). Returns null when it does not fit 576 (then the stacked form is used). */
export function flowRow(d: FlowDiagram): LayoutOutput | null {
  const boxes = new Boxes();
  const children: Prim[] = [];

  const items = d.steps.map((s) => ({ s, w: nodeContentWidth(s.label, s.sub), h: nodeHeight(lines(s.label).length, s.sub !== undefined) }));
  const gaps = d.steps.slice(0, -1).map((s) => (s.next ? Math.max(40, Math.ceil(est(s.next, 12)) + 16) : 40));
  const total = items.reduce((a, i) => a + i.w, 0) + gaps.reduce((a, g) => a + g, 0);
  if (total > H_W) return null;

  const exitBand = d.exits.length > 0 ? 80 : 0;
  const rowH = Math.max(...items.map((i) => i.h));
  const cy = exitBand + rowH / 2;
  let x = Math.floor((H_W - total) / 2);
  const rects: Rect[] = [];
  const nodeGroups: GroupPrim[] = [];
  items.forEach((it, i) => {
    const y = exitBand + (rowH - it.h) / 2;
    const { g, rect } = nodeGroup(boxes, {
      x,
      y,
      w: it.w,
      label: it.s.label,
      sub: it.s.sub,
      key: it.s.emphasis,
      labelPath: `steps[${i}].label`,
      subPath: `steps[${i}].sub`,
      ref: it.s.id,
    });
    nodeGroups.push(g);
    rects.push(rect);
    x += it.w + (gaps[i] ?? 0);
  });

  // Arrows between nodes, the `next` label centred over each.
  d.steps.slice(0, -1).forEach((s, i) => {
    const a = rects[i]!;
    const b = rects[i + 1]!;
    const edge: Prim[] = [{ k: "path", d: `M ${n(a.x + a.w)} ${n(cy)} H ${n(b.x)}`, variant: "edge", end: "arrow" }];
    if (s.next) {
      const gap = b.x - (a.x + a.w);
      boxes.add(`steps[${i}].next`, s.next, 12, gap - 16, 0);
      edge.push(text((a.x + a.w + b.x) / 2, cy - 6, s.next, { anchor: "middle", halo: true }));
    }
    children.push({ k: "g", part: "edge", children: edge });
  });
  children.push(...nodeGroups);
  // A `next` on the last step labels no arrow and is not drawn; it still gets a box so the fit check sees it.
  const lastNext = d.steps[d.steps.length - 1]?.next;
  if (lastNext) boxes.add(`steps[${d.steps.length - 1}].next`, lastNext, 12, H_W, 0);

  // Exits above the row.
  const index = new Map(d.steps.map((s, i) => [s.id, i]));
  const placed = d.exits
    .map((e, j) => ({ e, j, src: rects[index.get(e.from) ?? 0]!, w: nodeContentWidth(e.text) }))
    .sort((p, q) => p.src.x + p.src.w / 2 - (q.src.x + q.src.w / 2));
  let prevRight = -16;
  const seenFrom = new Map<string, number>();
  const exitPlans = placed.map((p) => {
    let bx = p.src.x + p.src.w / 2 - p.w / 2;
    bx = Math.max(bx, prevRight + 16, 0);
    bx = Math.min(bx, H_W - p.w);
    const dup = seenFrom.get(p.e.from) ?? 0;
    seenFrom.set(p.e.from, dup + 1);
    const plan = { ...p, bx, dup, overlap: bx < prevRight + 16 };
    prevRight = bx + p.w;
    return plan;
  });
  if (exitPlans.some((p) => p.overlap)) return null;
  const exitGroups: { j: number; g: GroupPrim }[] = [];
  exitPlans.forEach((p, k) => {
    const risk = p.e.style === "risk";
    const { g: nodeG } = nodeGroup(boxes, {
      x: p.bx,
      y: 0,
      w: p.w,
      label: p.e.text,
      risk,
      labelPath: `exits[${p.j}].text`,
    });
    const cx = clamp(p.src.x + p.src.w / 2 + 10 * p.dup, p.bx + 16, p.bx + p.w - 16);
    const srcX = p.src.x + p.src.w / 2 + 10 * p.dup;
    const mid = 60;
    const end = risk ? 46 : 40;
    const d1 = srcX === cx ? `M ${n(srcX)} ${n(p.src.y)} V ${end}` : `M ${n(srcX)} ${n(p.src.y)} V ${mid} H ${n(cx)} V ${end}`;
    const next = exitPlans[k + 1];
    const nextX = next ? clamp(next.src.x + next.src.w / 2 + 10 * next.dup, next.bx + 16, next.bx + next.w - 16) : H_W;
    boxes.add(`exits[${p.j}].label`, p.e.label, 12, nextX - (cx + 6), 0);
    exitGroups.push({
      j: p.j,
      g: {
        k: "g",
        part: "exit",
        ...(risk ? { state: "risk" as const } : {}),
        ref: p.e.from,
        children: [
          nodeG,
          { k: "path", d: d1, variant: risk ? "risk" : "edge", end: risk ? "x" : "arrow" },
          text(cx + 6, 64, p.e.label, { tone: risk ? "danger" : "muted", halo: true }),
        ],
      },
    });
  });
  exitGroups.sort((a, b) => a.j - b.j).forEach((e) => children.push(e.g));

  // Loops below the row.
  const rowBottom = exitBand + rowH;
  d.loops.forEach((l, k) => {
    const a = rects[index.get(l.from) ?? 0]!;
    const b = rects[index.get(l.to) ?? 0]!;
    const lane = rowBottom + 16 + 36 * k;
    const self = l.from === l.to;
    const sx = self ? a.x + a.w / 2 + 16 : a.x + a.w / 2 + 6 * k;
    const tx = self ? b.x + b.w / 2 - 16 : b.x + b.w / 2 - 6 * k;
    const bottom = rowBottom - (rowH - a.h) / 2;
    const tBottom = rowBottom - (rowH - b.h) / 2;
    const dPath = `M ${n(sx)} ${n(bottom)} V ${n(lane)} H ${n(tx)} V ${n(tBottom)}`;
    const w = est(l.label, 12);
    const mid = clamp((sx + tx) / 2, w / 2, H_W - w / 2);
    boxes.add(`loops[${k}].label`, l.label, 12, H_W, 0);
    children.push({
      k: "g",
      part: "loop",
      children: [{ k: "path", d: dPath, variant: "edge", end: "arrow" }, text(mid, lane + 16, l.label, { anchor: "middle", halo: true })],
    });
  });

  const height = rowBottom + (d.loops.length > 0 ? 16 + 36 * d.loops.length : 0);
  if (!boxesFit(boxes.list)) return null;
  const drawing: Drawing = { width: H_W, height, children, usesX: d.exits.some((e) => e.style === "risk") };
  return { drawing, mode: "row", boxes: boxes.list };
}

/** Stacked form: the vertical layout, and the horizontal fallback. Always 280 wide. */
export function flowStacked(d: FlowDiagram): LayoutOutput {
  const boxes = new Boxes();
  const children: Prim[] = [];
  const Wn = V_W - 16 * d.loops.length;
  const index = new Map(d.steps.map((s, i) => [s.id, i]));

  // First pass: vertical positions.
  let y = 0;
  const tops: number[] = [];
  const heights: number[] = [];
  const gapTops: number[] = [];
  const gapHeights: number[] = [];
  const exitTops: number[][] = [];
  // Loop labels are placed while walking the gaps and attached to their loop path afterwards.
  const loopTexts = new Map<number, Prim>();
  const loopsFrom = (i: number) => d.loops.map((l, k) => ({ l, k })).filter(({ l }) => index.get(l.from) === i);
  const exitsFrom = (i: number) => d.exits.map((e, j) => ({ e, j })).filter(({ e }) => index.get(e.from) === i);
  d.steps.forEach((s, i) => {
    tops[i] = y;
    heights[i] = nodeHeight(lines(s.label).length, s.sub !== undefined);
    y += heights[i]!;
    const isLast = i === d.steps.length - 1;
    const nl = (s.next && !isLast ? 1 : 0) + loopsFrom(i).length;
    const ex = exitsFrom(i);
    gapTops[i] = y;
    if (isLast && nl === 0 && ex.length === 0) {
      gapHeights[i] = 0;
      exitTops[i] = [];
      return;
    }
    gapHeights[i] = isLast && nl === 0 ? 0 : Math.max(32, 16 + 16 * nl);
    y += gapHeights[i]!;
    exitTops[i] = ex.map(() => {
      const top = y;
      y += 16 + 40;
      return top;
    });
    if (ex.length > 0 && !isLast) y += 16;
  });
  const height = y;

  const lastNext = d.steps[d.steps.length - 1]?.next;
  if (lastNext) boxes.add(`steps[${d.steps.length - 1}].next`, lastNext, 12, Wn - 36, 0);

  // Nodes.
  const rects: Rect[] = [];
  d.steps.forEach((s, i) => {
    const { g, rect } = nodeGroup(boxes, {
      x: 0,
      y: tops[i]!,
      w: Wn,
      label: s.label,
      sub: s.sub,
      key: s.emphasis,
      labelPath: `steps[${i}].label`,
      subPath: `steps[${i}].sub`,
      ref: s.id,
    });
    rects[i] = rect;
    children.push(g);
  });

  // Spine, `next` labels and loop labels.
  d.steps.forEach((s, i) => {
    const isLast = i === d.steps.length - 1;
    const bottom = tops[i]! + heights[i]!;
    const ex = exitsFrom(i);
    const lastExit = ex.length > 0 ? exitTops[i]![ex.length - 1]! + 16 + 20 : null;
    let lineNo = 0;
    const labelY = () => gapTops[i]! + 20 + 16 * lineNo++;
    const edgeChildren: Prim[] = [];
    if (s.next && !isLast) {
      boxes.add(`steps[${i}].next`, s.next, 12, Wn - 36, 0);
      edgeChildren.push(text(36, labelY(), s.next, { halo: true }));
    }
    loopsFrom(i).forEach(({ l, k }) => {
      boxes.add(`loops[${k}].label`, l.label, 12, Wn - 36, 0);
      loopTexts.set(k, text(Wn, labelY(), l.label, { anchor: "end", halo: true }));
    });
    if (!isLast) {
      edgeChildren.unshift({ k: "path", d: `M 24 ${n(bottom)} V ${n(tops[i + 1]!)}`, variant: "edge", end: "arrow" });
      children.push({ k: "g", part: "edge", children: edgeChildren });
    }
    // Exits.
    ex.forEach(({ e, j }, m) => {
      const risk = e.style === "risk";
      const top = exitTops[i]![m]!;
      const boxY = top + 16;
      const bw = Wn - 32;
      boxes.add(`exits[${j}].label`, e.label, 12, Wn - 40, 0);
      const { g: nodeG } = nodeGroup(boxes, { x: 32, y: boxY, w: bw, label: e.text, risk, labelPath: `exits[${j}].text` });
      const mid = boxY + 20;
      const grp: Prim[] = [];
      if (m === 0 && isLast) grp.push({ k: "path", d: `M 24 ${n(bottom)} V ${n(lastExit ?? mid)}`, variant: "edge" });
      grp.push(
        text(40, top + 12, e.label, { tone: risk ? "danger" : "muted", halo: true }),
        nodeG,
        { k: "path", d: `M 24 ${n(mid)} H ${risk ? 30 : 32}`, variant: risk ? "risk" : "edge", end: risk ? "x" : "arrow" },
      );
      children.push({ k: "g", part: "exit", ...(risk ? { state: "risk" as const } : {}), ref: e.from, children: grp });
    });
  });

  // Loops on the right.
  const used = new Map<number, number>();
  const bump = (i: number): number => {
    const c = used.get(i) ?? 0;
    used.set(i, c + 1);
    return c;
  };
  d.loops.forEach((l, k) => {
    const si = index.get(l.from) ?? 0;
    const ti = index.get(l.to) ?? 0;
    const xk = Wn + 8 + 16 * k;
    const self = si === ti;
    const sy = self ? tops[si]! + 14 : tops[si]! + 20 + 6 * bump(si);
    const ty = self ? tops[ti]! + heights[ti]! - 14 : tops[ti]! + 20 + 6 * bump(ti);
    children.push({
      k: "g",
      part: "loop",
      children: [{ k: "path", d: `M ${Wn} ${n(sy)} H ${xk} V ${n(ty)} H ${Wn}`, variant: "edge", end: "arrow" }, loopTexts.get(k)!],
    });
  });

  const drawing: Drawing = { width: V_W, height, children, usesX: d.exits.some((e) => e.style === "risk") };
  return { drawing, boxes: boxes.list };
}
