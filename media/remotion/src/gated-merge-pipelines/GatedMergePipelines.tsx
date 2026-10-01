import { interpolate } from "remotion";
import type { CSSProperties } from "react";
import { Frame, clampOpts, stepById, useSeconds } from "../common.tsx";
import { c, font } from "../theme.ts";
import type { StepsFile } from "../lib/vtt.ts";
import raw from "./steps.json";

type Data = StepsFile & {
  pr: { number: number; title: string; headLabel: string; oldSha: string; newSha: string };
  gates: { name: string; label: string }[];
  ui: { pending: string; success: string; none: string; labelStays: string };
  terminal: { command: string; refuse: string; done: string };
};
export const gatedMergeData = raw as Data;

const ROW_H = 92;
const ROW_GAP = 12;
const TOP = 182;

const Check = ({ size = 28, color = c.success }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12.5l5 5L20 6.5" />
  </svg>
);

type Status = "pending" | "success" | "none";

export const GatedMergePipelines = () => {
  const d = gatedMergeData;
  const t = useSeconds();
  const S = (id: string) => stepById(d.steps, id);
  const fade = (from: number, dur = 0.5) => interpolate(t, [from, from + dur], [0, 1], clampOpts);
  const mono: CSSProperties = { fontFamily: font.mono };

  const post = S("post");
  const push = S("push");
  const reset = S("reset");
  const refuse = S("refuse");
  const rerun = S("rerun");
  const merge = S("merge");

  const postAt = (i: number) => post.start_s + 1.5 + i * 3.2;
  const resetAt = (i: number) => reset.start_s + 0.8 + i * 0.5;
  const rerunAt = (i: number) => rerun.start_s + 1.5 + i * 3;
  const shaSwitchAt = push.start_s + 3;

  const statusOf = (i: number): { status: Status; sha: string } => {
    if (t >= rerunAt(i)) return { status: "success", sha: d.pr.newSha };
    if (t >= resetAt(i)) return { status: "none", sha: d.pr.newSha };
    if (t >= postAt(i)) return { status: "success", sha: d.pr.oldSha };
    return { status: "pending", sha: d.pr.oldSha };
  };

  const headSha = t >= shaSwitchAt ? d.pr.newSha : d.pr.oldSha;
  const pushPulse = interpolate(t, [shaSwitchAt, shaSwitchAt + 0.4, shaSwitchAt + 2], [0, 1, 0], clampOpts);

  // Terminal: visible during "refuse" and "merge".
  const termIn1 = refuse.start_s + 0.4;
  const termOut1 = rerun.start_s - 0.4;
  const termIn2 = merge.start_s + 0.4;
  const termOpacity = t < rerun.start_s ? fade(termIn1, 0.4) * (1 - fade(termOut1, 0.4)) : fade(termIn2, 0.4);
  const inMerge = t >= termIn2;
  const typed = (from: number) => Math.max(0, Math.floor((t - from) * 26));
  const cmdStart = inMerge ? termIn2 + 0.3 : termIn1 + 0.3;
  const cmdText = d.terminal.command.slice(0, typed(cmdStart));
  const cmdDone = typed(cmdStart) >= d.terminal.command.length;
  const resultAt = cmdStart + d.terminal.command.length / 26 + 0.6;
  const resultText = inMerge ? d.terminal.done : d.terminal.refuse;
  const resultOpacity = fade(resultAt, 0.3);

  const labelsStay = interpolate(t, [reset.start_s + 2, reset.start_s + 2.6, rerun.start_s - 0.5, rerun.start_s], [0, 1, 1, 0], clampOpts);

  return (
    <Frame steps={d.steps}>
      {/* PR / head panel */}
      <div
        style={{
          position: "absolute",
          left: 60,
          top: TOP,
          width: 360,
          height: 3 * ROW_H + 2 * ROW_GAP,
          boxSizing: "border-box",
          borderRadius: 16,
          border: `3px solid ${c.border}`,
          backgroundColor: c.canvas,
          boxShadow: "0 1px 20px rgb(135 135 135 / 0.12)",
          opacity: fade(0.2, 0.6),
        }}
      >
        <div style={{ position: "absolute", left: 24, top: 22, fontSize: 36, fontWeight: 700, color: c.fgStrong }}>{d.pr.title}</div>
        <div style={{ position: "absolute", left: 24, top: 74, fontSize: 28, fontWeight: 500, color: c.fgMuted }}>{d.pr.headLabel}</div>
        <div
          style={{
            ...mono,
            position: "absolute",
            left: 24,
            right: 24,
            top: 116,
            height: 92,
            boxSizing: "border-box",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 54,
            fontWeight: 700,
            color: c.fgStrong,
            backgroundColor: c.accentSoft,
            border: `3px solid ${c.accent}`,
            boxShadow: `0 0 0 ${pushPulse * 10}px ${c.accentSoft}`,
          }}
        >
          {headSha}
        </div>
        <div style={{ position: "absolute", left: 24, right: 24, top: 218, fontSize: 30, fontWeight: 700, color: c.success, opacity: labelsStay }}>{d.ui.labelStays}</div>
      </div>

      {/* gate rows */}
      {d.gates.map((g, i) => {
        const { status, sha } = statusOf(i);
        const labelOn = t >= postAt(i);
        const appear = fade(0.5 + i * 0.3, 0.6);
        const pill: CSSProperties =
          status === "success"
            ? { backgroundColor: c.successSoft, border: `3px solid ${c.success}`, color: c.success }
            : status === "none"
              ? { backgroundColor: c.surface, border: `3px dashed ${c.controlBorder}`, color: c.fgMuted }
              : { backgroundColor: c.surface, border: `3px solid ${c.border}`, color: c.fgMuted };
        const statusText = status === "success" ? d.ui.success : status === "none" ? d.ui.none : d.ui.pending;
        return (
          <div
            key={g.name}
            style={{
              position: "absolute",
              left: 460,
              width: 760,
              top: TOP + i * (ROW_H + ROW_GAP),
              height: ROW_H,
              boxSizing: "border-box",
              borderRadius: 16,
              border: `3px solid ${c.border}`,
              backgroundColor: c.canvas,
              boxShadow: "0 1px 20px rgb(135 135 135 / 0.12)",
              opacity: appear,
            }}
          >
            <div style={{ ...mono, position: "absolute", left: 24, top: 10, fontSize: 36, fontWeight: 700, color: c.fgStrong }}>{g.name}</div>
            <div style={{ ...mono, position: "absolute", left: 24, top: 56, display: "flex", alignItems: "center", gap: 8, fontSize: 24, color: labelOn ? c.success : c.fgMuted }}>
              {labelOn ? <Check size={20} /> : null}
              {g.label}
            </div>
            <div
              style={{
                position: "absolute",
                right: 16,
                top: 14,
                height: 58,
                boxSizing: "border-box",
                padding: "0 16px",
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 32,
                fontWeight: 700,
                whiteSpace: "nowrap",
                ...pill,
              }}
            >
              {status === "success" ? <Check size={26} /> : null}
              <span>{statusText}</span>
              {status === "success" ? <span style={{ ...mono, fontSize: 26, fontWeight: 500, color: c.fgMuted }}>{sha}</span> : null}
            </div>
          </div>
        );
      })}

      {/* terminal */}
      <div
        style={{
          position: "absolute",
          left: 60,
          width: 1160,
          top: 496,
          height: 114,
          boxSizing: "border-box",
          borderRadius: 14,
          backgroundColor: c.codeBg,
          opacity: termOpacity,
          padding: "14px 28px",
          ...mono,
          fontSize: 34,
          color: c.codeFg,
        }}
      >
        <div style={{ whiteSpace: "pre" }}>
          <span style={{ color: c.codeMuted }}>$ </span>
          {cmdText}
          {!cmdDone ? <span style={{ backgroundColor: c.codeFg, color: c.codeBg }}> </span> : null}
        </div>
        <div
          style={{
            marginTop: 14,
            paddingLeft: 16,
            borderLeft: `6px solid ${inMerge ? c.success : c.accent2}`,
            opacity: resultOpacity,
            whiteSpace: "pre",
          }}
        >
          {resultText}
        </div>
      </div>
    </Frame>
  );
};
