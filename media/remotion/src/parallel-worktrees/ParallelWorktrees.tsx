import { interpolate } from "remotion";
import type { CSSProperties } from "react";
import { Frame, clampOpts, stepById, useSeconds } from "../common.tsx";
import { c, font } from "../theme.ts";
import type { StepsFile } from "../lib/vtt.ts";
import raw from "./steps.json";

type Data = StepsFile & {
  ui: { main: string; tests: string; prewired: string; rebased: string };
  shared: { file: string; resolution: "prewire" | "owner"; owner?: string }[];
  lanes: { branch: string; dir: string; files: string[] }[];
};
export const parallelWorktreesData = raw as Data;

const CARD_W = 360;
const GAP = 40;
const CARD_TOP = 262;
const CARD_H = 340;
const ROW0 = 124;
const ROW_H = 72;
const CHIP_W = 190;
const CHIP_GAP = 12;
const MAIN = { top: 172, h: 62 };

const cardX = (i: number) => 60 + i * (CARD_W + GAP);
const slotLeft = (k: number) => 1220 - 16 - (3 * CHIP_W + 2 * CHIP_GAP) + k * (CHIP_W + CHIP_GAP);

const Check = ({ size = 28, color = c.success }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12.5l5 5L20 6.5" />
  </svg>
);

type Kind = "normal" | "conflict" | "resolved" | "dimmed";

const chipStyle = (kind: Kind): CSSProperties => {
  switch (kind) {
    case "conflict":
      return { backgroundColor: c.warningSoft, border: `3px solid ${c.accent2}` };
    case "resolved":
      return { backgroundColor: c.successSoft, border: `3px solid ${c.success}` };
    case "dimmed":
      return { backgroundColor: c.surface, border: `3px dashed ${c.controlBorder}`, opacity: 0.7 };
    default:
      return { backgroundColor: c.surface, border: `3px solid ${c.border}` };
  }
};

export const ParallelWorktrees = () => {
  const d = parallelWorktreesData;
  const t = useSeconds();
  const S = (id: string) => stepById(d.steps, id);
  const fade = (from: number, dur = 0.5) => interpolate(t, [from, from + dur], [0, 1], clampOpts);

  const work = S("work");
  const collide = S("collide");
  const fence = S("fence");
  const cleanup = S("cleanup");
  const mergeSteps = [S("merge-1"), S("merge-2"), S("merge-3")];

  // Rows holding a file that appears in more than one lane at the same row.
  const sharedRows = d.shared.map((sh) => ({
    ...sh,
    cells: d.lanes.flatMap((l, li) => l.files.map((f, ri) => (f === sh.file ? { li, ri } : null)).filter((x): x is { li: number; ri: number } => x !== null)),
  }));

  const kindOf = (li: number, file: string): Kind => {
    const sh = d.shared.find((x) => x.file === file);
    if (!sh) return "normal";
    const lane = d.lanes[li];
    if (t >= fence.start_s + 1) {
      if (sh.resolution === "prewire") return "resolved";
      return lane.branch === sh.owner ? "resolved" : "dimmed";
    }
    if (t >= collide.start_s + 0.6) return "conflict";
    return "normal";
  };

  // Merge timeline per lane: tests pill -> token travels -> chip lands on main -> card dims.
  const mergeT = (k: number) => {
    const s = mergeSteps[k].start_s;
    return { rebase: s + 0.3, tests: s + 2.2, travel0: s + 4.2, travel1: s + 5.6, landed: s + 5.6 };
  };

  const cleanupOpacity = interpolate(t, [cleanup.start_s + 0.3, cleanup.start_s + 2.5], [1, 0], clampOpts);
  const cleanupRise = interpolate(t, [cleanup.start_s + 0.3, cleanup.start_s + 2.5], [0, 30], clampOpts);

  const lastLanded = mergeT(2).landed;
  const showFinalTests = t >= lastLanded + 0.5;
  const prewiredOpacity = fade(fence.start_s + 1, 0.6) * (1 - fade(lastLanded, 0.4));

  const mono: CSSProperties = { fontFamily: font.mono };

  return (
    <Frame steps={d.steps}>
      {/* main branch bar */}
      <div
        style={{
          position: "absolute",
          left: 60,
          width: 1160,
          top: MAIN.top,
          height: MAIN.h,
          boxSizing: "border-box",
          borderRadius: 14,
          backgroundColor: c.codeBg,
          opacity: fade(0.2, 0.6),
        }}
      >
        <div style={{ ...mono, position: "absolute", left: 24, top: 0, height: MAIN.h, display: "flex", alignItems: "center", fontSize: 34, fontWeight: 700, color: c.codeFg }}>
          {d.ui.main}
        </div>
        {/* pre-wired shared file */}
        <div
          style={{
            position: "absolute",
            left: 150,
            top: 8,
            height: MAIN.h - 16,
            boxSizing: "border-box",
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            borderRadius: 10,
            backgroundColor: c.successSoft,
            color: c.fgStrong,
            fontSize: 26,
            fontWeight: 500,
            opacity: prewiredOpacity,
            whiteSpace: "nowrap",
          }}
        >
          <Check size={26} />
          <span style={mono}>{d.ui.prewired}</span>
        </div>
        {/* merged branches */}
        {d.lanes.map((l, k) => {
          const op = fade(mergeT(k).landed, 0.4);
          return (
            <div
              key={l.branch}
              style={{
                position: "absolute",
                left: slotLeft(k) - 60,
                top: 8,
                width: CHIP_W,
                height: MAIN.h - 16,
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                borderRadius: 10,
                backgroundColor: c.accent,
                color: "#ffffff",
                fontSize: 28,
                fontWeight: 700,
                opacity: op,
              }}
            >
              <span style={mono}>{l.branch.split("/")[1]}</span>
              <Check size={26} color="#ffffff" />
            </div>
          );
        })}
        {showFinalTests ? (
          <div
            style={{
              position: "absolute",
              left: 150,
              top: 8,
              height: MAIN.h - 16,
              boxSizing: "border-box",
              padding: "0 16px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              borderRadius: 10,
              backgroundColor: c.successSoft,
              color: c.fgStrong,
              fontSize: 28,
              fontWeight: 700,
              opacity: fade(lastLanded + 0.5, 0.6),
              whiteSpace: "nowrap",
            }}
          >
            <Check size={26} />
            <span>{d.ui.tests}</span>
          </div>
        ) : null}
      </div>

      {/* conflict bridges between chips in the same row of neighbouring lanes */}
      {sharedRows.flatMap((sh) =>
        sh.cells.flatMap((cell, ci) => {
          const next = sh.cells[ci + 1];
          if (!next || next.ri !== cell.ri || next.li !== cell.li + 1) return [];
          const op = interpolate(t, [collide.start_s + 0.6, collide.start_s + 1.2, fence.start_s + 0.2, fence.start_s + 0.8], [0, 1, 1, 0], clampOpts);
          return [
            <div
              key={`${sh.file}-${cell.li}`}
              style={{
                position: "absolute",
                left: cardX(cell.li) + CARD_W - 20 - 3,
                width: GAP + 40 + 6,
                top: CARD_TOP + ROW0 + cell.ri * ROW_H + 24,
                height: 10,
                borderRadius: 5,
                backgroundColor: c.accent2,
                opacity: op,
              }}
            />,
          ];
        }),
      )}

      {/* worktree cards */}
      {d.lanes.map((lane, li) => {
        const appear = fade(0.8 + li * 0.9, 0.7);
        const m = mergeT(li);
        const merged = t >= m.landed;
        const dim = merged ? 0.5 : 1;
        const progress = interpolate(t, [work.start_s + 0.5, work.end_s - 1], [0, 1], clampOpts);
        const tests = fade(m.tests, 0.4);
        const rebased = li > 0 ? fade(m.rebase, 0.4) : 0;
        const x = cardX(li);
        return (
          <div
            key={lane.branch}
            style={{
              position: "absolute",
              left: x,
              top: CARD_TOP,
              width: CARD_W,
              height: CARD_H,
              boxSizing: "border-box",
              borderRadius: 16,
              border: `3px solid ${c.border}`,
              backgroundColor: c.canvas,
              boxShadow: "0 1px 20px rgb(135 135 135 / 0.12)",
              opacity: appear * dim * cleanupOpacity,
              translate: `0px ${(1 - appear) * 24 + cleanupRise}px`,
            }}
          >
            <div style={{ ...mono, position: "absolute", left: 20, top: 18, fontSize: 34, fontWeight: 700, color: c.fgStrong }}>{lane.branch}</div>
            <div style={{ ...mono, position: "absolute", left: 20, top: 62, fontSize: 24, color: c.fgMuted, opacity: 1 - Math.max(rebased, tests) }}>{lane.dir}</div>
            {/* agent progress */}
            <div style={{ position: "absolute", left: 20, right: 20, top: 100, height: 12, borderRadius: 6, backgroundColor: c.border }}>
              <div style={{ width: `${progress * 100}%`, height: "100%", borderRadius: 6, backgroundColor: c.accent }} />
            </div>
            {/* file chips */}
            {lane.files.map((file, ri) => {
              if (!file) return null;
              const reveal = fade(work.start_s + 1 + ri * 2.2 + li * 0.5, 0.5);
              const kind = kindOf(li, file);
              const handoff = kind === "dimmed";
              return (
                <div
                  key={ri}
                  style={{
                    position: "absolute",
                    left: 20,
                    right: 20,
                    top: ROW0 + ri * ROW_H,
                    height: 56,
                    boxSizing: "border-box",
                    padding: "0 14px",
                    borderRadius: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    opacity: reveal * (handoff ? 0.75 : 1),
                    translate: `0px ${(1 - reveal) * 10}px`,
                    ...chipStyle(kind),
                  }}
                >
                  <span style={{ ...mono, fontSize: 32, fontWeight: 500, color: c.fgStrong, textDecoration: handoff ? "line-through" : "none" }}>{file}</span>
                  {kind === "resolved" ? <Check /> : null}
                </div>
              );
            })}
            {/* rebased badge + tests pill during this lane's merge step */}
            <div style={{ position: "absolute", left: 20, top: 54, display: "flex", gap: 8 }}>
              {li > 0 ? (
                <div style={{ opacity: rebased, padding: "2px 12px", borderRadius: 999, backgroundColor: c.accentSoft, color: c.accent, fontSize: 26, fontWeight: 700 }}>{d.ui.rebased}</div>
              ) : null}
              <div style={{ opacity: tests, display: "flex", alignItems: "center", gap: 8, padding: "2px 12px", borderRadius: 999, backgroundColor: c.successSoft, color: c.success, fontSize: 26, fontWeight: 700 }}>
                <Check size={24} />
                {d.ui.tests}
              </div>
            </div>
          </div>
        );
      })}

      {/* merge tokens flying from a card up to main */}
      {d.lanes.map((lane, k) => {
        const m = mergeT(k);
        if (t < m.travel0 || t > m.travel1 + 0.05) return null;
        const p = interpolate(t, [m.travel0, m.travel1], [0, 1], { ...clampOpts, easing: (x) => x * x * (3 - 2 * x) });
        const x0 = cardX(k) + CARD_W / 2;
        const y0 = CARD_TOP + 20;
        const x1 = slotLeft(k) + CHIP_W / 2;
        const y1 = MAIN.top + MAIN.h / 2;
        const size = 34;
        return (
          <div
            key={lane.branch}
            style={{
              position: "absolute",
              left: x0 + (x1 - x0) * p - size / 2,
              top: y0 + (y1 - y0) * p - size / 2,
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: c.accent,
              boxShadow: `0 0 0 8px ${c.accentSoft}`,
              opacity: 1 - interpolate(p, [0.85, 1], [0, 1], clampOpts),
            }}
          />
        );
      })}
    </Frame>
  );
};
