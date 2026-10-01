import type { BoundaryDiagram } from "@/lib/contracts/diagram";
import { nodeHeight } from "@/lib/diagram/fit";
import {
  BadgeLedger,
  Boxes,
  H_W,
  V_W,
  badge,
  boxesFit,
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

type ZoneIn = BoundaryDiagram["zones"][number];
interface ZoneLike {
  id: string;
  label: string;
  items: ZoneIn["items"];
  zones?: ZoneLike[] | undefined;
}

const CAPTION = 38; // 10 pad + 16 caption + 12 clear (a badge straddling the first item's top border clears it)
const PAD = 10;
const ITEM_GAP = 12;

const itemH = (it: ZoneIn["items"][number]): number => nodeHeight(lines(it.label).length, it.sub !== undefined);
const itemsH = (z: ZoneLike): number => (z.items.length === 0 ? 0 : z.items.reduce((a, it) => a + itemH(it), 0) + ITEM_GAP * (z.items.length - 1));
const nestedH = (z: ZoneLike): number => {
  const list = z.zones ?? [];
  return list.length === 0 ? 0 : list.reduce((a, c) => a + zoneH(c, false), 0) + ITEM_GAP * (list.length - 1);
};

/** Natural height of a zone. `subcols`: its items and nested zones sit side by side (a lone top-level zone). */
function zoneH(z: ZoneLike, subcols: boolean): number {
  const i = itemsH(z);
  const c = nestedH(z);
  if (i === 0 && c === 0) return 36;
  const body = subcols ? Math.max(i, c) : i + (i > 0 && c > 0 ? ITEM_GAP : 0) + c;
  return CAPTION + body + PAD;
}

interface Registry {
  rects: Map<string, Rect>;
  labels: Map<string, string>;
  top: Map<string, number>;
  zoneIds: Set<string>;
}

function drawZone(
  boxes: Boxes,
  reg: Registry,
  z: ZoneLike,
  path: string,
  rect: Rect,
  topIdx: number,
  subcols: boolean,
): GroupPrim {
  reg.rects.set(z.id, rect);
  reg.labels.set(z.id, z.label);
  reg.top.set(z.id, topIdx);
  reg.zoneIds.add(z.id);
  boxes.add(`${path}.label`, z.label, 12, rect.w);
  const children: Prim[] = [
    { k: "rect", x: n(rect.x), y: n(rect.y), w: n(rect.w), h: n(rect.h), variant: "zone" },
    text(rect.x + 10, rect.y + 22, z.label, { weight: 700 }),
  ];
  const inner = rect.w - 2 * PAD;
  const colW = subcols ? (inner - 40) / 2 : inner;
  let y = rect.y + CAPTION;
  z.items.forEach((it, i) => {
    const { g, rect: r } = nodeGroup(boxes, {
      x: rect.x + PAD,
      y,
      w: colW,
      label: it.label,
      sub: it.sub,
      key: it.emphasis,
      labelPath: `${path}.items[${i}].label`,
      subPath: `${path}.items[${i}].sub`,
      ref: it.id,
    });
    reg.rects.set(it.id, r);
    reg.labels.set(it.id, it.label);
    reg.top.set(it.id, topIdx);
    children.push(g);
    y += r.h + ITEM_GAP;
  });
  let ny = subcols ? rect.y + CAPTION : y;
  const nx = subcols ? rect.x + PAD + colW + 40 : rect.x + PAD;
  (z.zones ?? []).forEach((c, ci) => {
    const h = zoneH(c, false);
    children.push(drawZone(boxes, reg, c, `${path}.zones[${ci}]`, { x: nx, y: ny, w: colW, h }, topIdx, false));
    ny += h + ITEM_GAP;
  });
  return { k: "g", part: "zone", ref: z.id, children };
}

function build(d: BoundaryDiagram, columns: boolean): LayoutOutput | null {
  const boxes = new Boxes();
  const reg: Registry = { rects: new Map(), labels: new Map(), top: new Map(), zoneIds: new Set() };
  const W = columns ? H_W : V_W;
  const padTop = d.crossings.length > 0 ? 9 : 0;
  const t = d.zones.length;
  const subcols = columns && t === 1 && (d.zones[0]?.zones?.length ?? 0) > 0;
  const zones = d.zones as ZoneLike[];
  const children: Prim[] = [];
  let bodyBottom: number;
  const gapBetween = 40;
  const colW = (H_W - gapBetween * (t - 1)) / t;

  if (columns) {
    const h = Math.max(...zones.map((z) => zoneH(z, subcols)));
    zones.forEach((z, i) => {
      children.push(drawZone(boxes, reg, z, `zones[${i}]`, { x: i * (colW + gapBetween), y: padTop, w: colW, h }, i, subcols));
    });
    bodyBottom = padTop + h;
    // A node narrower than the 96 minimum cannot be a row cell.
    for (const it of zones.flatMap((z) => [...z.items, ...(z.zones ?? []).flatMap((c) => c.items)])) {
      const r = reg.rects.get(it.id);
      if (r && r.w < 96) return null;
    }
  } else {
    let y = padTop;
    zones.forEach((z, i) => {
      const h = zoneH(z, false);
      children.push(drawZone(boxes, reg, z, `zones[${i}]`, { x: 0, y, w: W, h }, i, false));
      y += h + 16;
    });
    bodyBottom = y - 16;
  }

  // Crossings: numbered badge pairs and a legend; also a line where it runs only through the gaps between columns.
  const ledger = new BadgeLedger();
  const gapCount = new Map<number, number>();
  const entries: LegendEntry[] = [];
  d.crossings.forEach((c, i) => {
    const from = reg.rects.get(c.from)!;
    const to = reg.rects.get(c.to)!;
    const risk = c.style === "risk";
    const g: Prim[] = [];
    const ti = reg.top.get(c.from) ?? 0;
    const tj = reg.top.get(c.to) ?? 0;
    if (columns && !subcols && !reg.zoneIds.has(c.from) && !reg.zoneIds.has(c.to) && Math.abs(ti - tj) === 1) {
      const left = Math.min(ti, tj);
      const slot = gapCount.get(left) ?? 0;
      gapCount.set(left, slot + 1);
      const gx = (left + 1) * colW + left * gapBetween + gapBetween / 2 + [-12, -4, 4, 12][slot % 4]!;
      const goesRight = ti < tj;
      const sx = goesRight ? from.x + from.w : from.x;
      const sy = from.y + from.h / 2;
      const ty = to.y + to.h / 2;
      const stop = risk ? 6 : 0;
      const tx = goesRight ? to.x - stop : to.x + to.w + stop;
      const d1 = sy === ty ? `M ${n(sx)} ${n(sy)} H ${n(tx)}` : `M ${n(sx)} ${n(sy)} H ${n(gx)} V ${n(ty)} H ${n(tx)}`;
      g.push({ k: "path", d: d1, variant: risk ? "risk" : "edge", end: risk ? "x" : "arrow" });
    }
    const a = ledger.place(c.from, from);
    const b = ledger.place(c.to, to);
    g.push(...badge(a.cx, a.cy, i + 1, risk), ...badge(b.cx, b.cy, i + 1, risk));
    children.push({ k: "g", part: "crossing", ...(risk ? { state: "risk" as const } : {}), children: g });
    entries.push({
      n: i + 1,
      text: `${c.label}: ${flat(reg.labels.get(c.from) ?? c.from)} → ${flat(reg.labels.get(c.to) ?? c.to)}`,
      risk,
      path: `crossings[${i}].label`,
      label: c.label,
    });
  });

  let height = bodyBottom;
  if (entries.length > 0) {
    const lg = legend(boxes, entries, W, bodyBottom + 16, !columns);
    children.push(lg.g);
    height = bodyBottom + 16 + lg.h;
  }
  if (columns && !boxesFit(boxes.list)) return null;
  return {
    drawing: { width: W, height, children, usesX: d.crossings.some((c) => c.style === "risk") },
    ...(columns ? { mode: "row" as const } : {}),
    boxes: boxes.list,
  };
}

export function boundaryColumns(d: BoundaryDiagram): LayoutOutput | null {
  return build(d, true);
}

export function boundaryStacked(d: BoundaryDiagram): LayoutOutput {
  return build(d, false)!;
}
