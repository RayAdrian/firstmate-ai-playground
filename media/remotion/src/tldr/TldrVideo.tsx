// The one TL;DR composition (PRD §19.5, DESIGN §6.3.4 "Video template"). It draws from a lesson's `tldr` props and
// contains no per-lesson code. Motion is fades and rises of at most 24 px over at most 300 ms; nothing else moves.
// All text lines come from the plan (calc.ts), so what the fit check measured is what is drawn.
import type { CSSProperties } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { FontGate } from "../common.tsx";
import { c, font } from "../theme.ts";
import { beatFrame, TOOL_LABEL } from "./beats.ts";
import type { Entry, Plan, TldrProps } from "./calc.ts";
import { PILL } from "./wrap.ts";
import type { Fitted, Seg } from "./wrap.ts";

const F_IN = 9; // 300 ms
const F_MID = 8; // 250 ms
const F_OUT = 6; // 200 ms
const RISE = 24;
const ease = Easing.out(Easing.cubic);
const prog = (f: number, start: number, dur: number) =>
  interpolate(f, [start, start + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

const layer = (opacity: number, rise = 0, progress = 1): CSSProperties => ({
  position: "absolute",
  inset: 0,
  opacity,
  transform: rise ? `translateY(${(1 - progress) * rise}px)` : undefined,
  display: opacity <= 0 ? "none" : undefined,
});

const Line = ({ segs }: { segs: Seg[] }) => (
  <>
    {segs.map((s, i) =>
      s.code ? (
        <span
          key={i}
          style={{
            fontFamily: font.mono,
            fontSize: `${PILL.scale}em`,
            fontWeight: 400,
            background: c.accentSoft,
            color: c.fg,
            borderRadius: 10,
            padding: `0 ${PILL.padX}px`,
          }}
        >
          {s.text}
        </span>
      ) : (
        <span key={i}>{s.text}</span>
      ),
    )}
  </>
);

/** Draws the fitted lines, one block per line, so wrapping can never differ from the measured wrap. */
const Lines = ({ fit, color, weight = 500, mono = false }: { fit: Fitted; color: string; weight?: number; mono?: boolean }) => (
  <div style={{ fontSize: fit.size, lineHeight: `${fit.lineHeight}px`, fontWeight: weight, color, whiteSpace: "pre", fontFamily: mono ? font.mono : font.sans, fontVariantLigatures: "none", fontFeatureSettings: '"liga" 0, "calt" 0' }}>
    {fit.lines.map((l, i) => (
      <div key={i}>{mono ? l.map((s) => s.text).join("") : <Line segs={l} />}</div>
    ))}
  </div>
);

const Badge = ({ n, size, soft }: { n: number; size: number; soft?: boolean }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      flex: "none",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: soft ? c.accentSoft : c.accent,
      color: soft ? c.accent : "#ffffff",
      fontSize: size === 56 ? 30 : 18,
      fontWeight: 700,
      fontFamily: font.sans,
    }}
  >
    {n}
  </div>
);

const CodeBlock = ({ e, small }: { e: Entry; small?: boolean }) => {
  const fit = small ? e.recapFit : e.fit;
  return (
    <div style={{ background: c.codeBg, borderRadius: small ? 16 : 24, overflow: "hidden" }}>
      <div
        style={{
          background: c.codeHeaderBg,
          color: c.codeMuted,
          height: small ? 32 : 44,
          padding: small ? "0 16px" : "0 24px",
          display: "flex",
          alignItems: "center",
          fontFamily: font.mono,
          fontVariantLigatures: "none",
          fontSize: small ? 22 : 26,
          fontWeight: 500,
        }}
      >
        {e.label}
      </div>
      <div style={{ padding: small ? "8px 16px" : "16px 24px" }}>
        <Lines fit={fit} color={c.codeFg} weight={400} mono />
      </div>
    </div>
  );
};

const kindLine = (e: Entry) => (e.kind === "command" ? "Run it in your terminal, in any repo." : "Type it into your agent.");
const tryLead = (e: Entry) => (e.tool === "all" ? "Try this" : `Try this in ${TOOL_LABEL[e.tool]}`);

const HeaderStrip = ({ title, seg }: { title: string; seg: number }) => (
  <div
    style={{
      position: "absolute",
      left: 64,
      right: 64,
      top: 48,
      height: 48,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      fontFamily: font.sans,
      fontSize: 26,
      lineHeight: "32px",
    }}
  >
    <div style={{ display: "flex", minWidth: 0, maxWidth: 800 }}>
      <span style={{ color: c.accent, fontWeight: 700, flex: "none" }}>TL;DR</span>
      <span style={{ color: c.fgMuted, fontWeight: 500, whiteSpace: "pre", flex: "none" }}>{" · "}</span>
      <span style={{ color: c.fgMuted, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
    </div>
    <div style={{ display: "flex", gap: 8 }}>
      {[1, 2, 3, 4].map((n) => (
        <div key={n} style={{ width: 40, height: 8, borderRadius: 4, background: n <= seg ? c.accent : c.border }} />
      ))}
    </div>
  </div>
);

const TitleFrame = ({ title, plan }: { title: string; plan: Plan }) => {
  const h = 56 + 18 + plan.titleFit.lines.length * 92 + 20 + 40;
  const top = Math.max(48, Math.round(259 - h / 2)); // centred in the y 48-470 safe zone (controls show while paused)
  return (
    <div style={{ position: "absolute", left: 64, right: 64, top, fontFamily: font.sans }} aria-label={title}>
      <div style={{ fontSize: 48, lineHeight: "56px", fontWeight: 700, color: c.accent, letterSpacing: "0.12em", textTransform: "uppercase" }}>TL;DR</div>
      <div style={{ marginTop: 18 }}>
        <Lines fit={plan.titleFit} color={c.fgStrong} weight={700} />
      </div>
      <div style={{ marginTop: 20, fontSize: 32, lineHeight: "40px", fontWeight: 500, color: c.fgMuted }}>Three takeaways and one thing to try</div>
    </div>
  );
};

const Compact = ({ n, text, top }: { n: number; text: string; top: number }) => (
  <div style={{ position: "absolute", left: 64, right: 64, top, height: 40, display: "flex", alignItems: "center", gap: 16 }}>
    <Badge n={n} size={32} soft />
    <div style={{ fontFamily: font.sans, fontSize: 30, lineHeight: "40px", fontWeight: 500, color: c.fgMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
      {text.replace(/`/g, "")}
    </div>
  </div>
);

const Current = ({ n, fit, top }: { n: number; fit: Fitted; top: number }) => (
  <div style={{ position: "absolute", left: 64, right: 64, top, display: "flex", gap: 16, alignItems: "flex-start" }}>
    <div style={{ paddingTop: 6 }}>
      <Badge n={n} size={56} />
    </div>
    <Lines fit={fit} color={c.fgStrong} />
  </div>
);

const TryPanel = ({ e }: { e: Entry }) => (
  <>
    <div style={{ position: "absolute", left: 64, right: 64, top: 112, fontFamily: font.sans, fontSize: 56, lineHeight: "68px", fontWeight: 700, color: c.fgStrong, whiteSpace: "nowrap" }}>{tryLead(e)}</div>
    <div style={{ position: "absolute", left: 64, right: 64, top: 180, fontFamily: font.sans, fontSize: 32, lineHeight: "40px", fontWeight: 500, color: c.fgMuted }}>{kindLine(e)}</div>
    <div style={{ position: "absolute", left: 64, right: 64, top: 228 }}>
      <CodeBlock e={e} />
    </div>
  </>
);

const Recap = ({ title, plan }: { title: string; plan: Plan }) => {
  return (
    <>
      <div style={{ position: "absolute", left: 64, right: 64, top: 48, height: 48, display: "flex", alignItems: "center", fontFamily: font.sans, fontSize: 32, lineHeight: "40px", fontWeight: 700, whiteSpace: "nowrap" }}>
        <span style={{ color: c.accent }}>TL;DR</span>
        <span style={{ color: c.fgStrong, whiteSpace: "pre" }}>{" · "}</span>
        <span style={{ color: c.fgStrong, overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
      </div>
      <div style={{ position: "absolute", left: 64, top: 112, width: 672, display: "flex", flexDirection: "column", gap: 20 }}>
        {plan.recapPointFits.map((fit, i) => (
          <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div style={{ paddingTop: 4 }}>
              <Badge n={i + 1} size={32} soft />
            </div>
            <Lines fit={fit} color={c.fg} />
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 784, top: 112, width: 432, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontFamily: font.sans, fontSize: 32, lineHeight: "40px", fontWeight: 700, color: c.fgStrong }}>Try this</div>
        {plan.entries.map((e) => (
          <CodeBlock key={e.tool} e={e} small />
        ))}
      </div>
    </>
  );
};

export const TldrVideo = ({ title, tldr, plan }: TldrProps) => {
  const f = useCurrentFrame();
  if (!plan) throw new Error("TldrVideo needs the plan from calculateMetadata");
  const B = plan.beats;
  const start = (i: number) => beatFrame(B[i].start_s);
  const tryIdx = B.map((b, i) => (b.kind === "try" ? i : -1)).filter((i) => i >= 0);
  const recapIdx = B.length - 1;
  const tryStart = start(tryIdx[0]);

  // Which header segment is filled: instant at each beat start (a state change, not an animation).
  let seg = 0;
  B.forEach((b, i) => {
    if (f >= start(i)) seg = b.kind === "point" ? (b.point ?? 0) : b.kind === "try" ? 4 : b.kind === "recap" ? 4 : 0;
  });

  const titleOpacity = 1 - prog(f, start(1), F_MID);
  const stripOpacity = prog(f, start(1), F_MID) * (1 - prog(f, start(recapIdx), F_IN));
  const recapIn = prog(f, start(recapIdx), F_IN);

  return (
    <FontGate>
      <AbsoluteFill style={{ background: c.canvas, fontFamily: font.sans }}>
        <div style={layer(titleOpacity)}>
          <TitleFrame title={title} plan={plan} />
        </div>

        <div style={layer(stripOpacity)}>
          <HeaderStrip title={title} seg={seg} />
        </div>

        {[0, 1, 2].map((i) => {
          const s = start(1 + i);
          const nextStart = i < 2 ? start(2 + i) : tryStart;
          const inP = prog(f, s, F_IN);
          const out = 1 - prog(f, nextStart, i < 2 ? F_OUT : F_MID);
          const top = 120 + i * 56 + (i > 0 ? 8 : 0);
          return (
            <div key={`p${i}`}>
              <div style={layer(inP * out, RISE, inP)}>
                <Current n={i + 1} fit={plan.pointFits[i]} top={top} />
              </div>
              {i < 2 && (
                <div style={layer(prog(f, nextStart, F_OUT) * (1 - prog(f, tryStart, F_MID)))}>
                  <Compact n={i + 1} text={tldr.points[i]} top={120 + i * 56} />
                </div>
              )}
            </div>
          );
        })}

        {tryIdx.map((bi, j) => {
          const s = start(bi);
          const next = bi + 1;
          const nextIsRecap = next === recapIdx;
          const inP = prog(f, s, j === 0 ? F_IN : F_OUT);
          const out = 1 - prog(f, start(next), nextIsRecap ? F_IN : F_OUT);
          const entry = plan.entries[j] as Entry;
          return (
            <div key={`t${j}`} style={layer(inP * out, RISE, inP)}>
              <TryPanel e={entry} />
            </div>
          );
        })}

        <div style={layer(recapIn)}>
          <Recap title={title} plan={plan} />
        </div>
      </AbsoluteFill>
    </FontGate>
  );
};
