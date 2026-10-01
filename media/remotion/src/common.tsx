import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/fonts";
import { c, font, layout } from "./theme.ts";
import type { Step } from "./lib/vtt.ts";

export const clampOpts = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Loads Satoshi from the repo's public/fonts (the render script and `npm run studio` both point the public dir there). */
export const FontGate = ({ children }: { children: ReactNode }) => {
  const [handle] = useState(() => delayRender("Loading Satoshi"));
  useEffect(() => {
    Promise.all(
      [
        ["Satoshi-Regular.woff2", "400"],
        ["Satoshi-Medium.woff2", "500"],
        ["Satoshi-Bold.woff2", "700"],
      ].map(([file, weight]) => loadFont({ family: "Satoshi", url: staticFile(file), weight })),
    )
      .then(() => continueRender(handle))
      .catch((e) => cancelRender(e));
  }, [handle]);
  return <>{children}</>;
};

/** Seconds helper: the current time in seconds. */
export const useSeconds = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
};

/** Eased 0..1 progress between two times in seconds. */
export const useProgress = (from: number, to: number) => {
  const t = useSeconds();
  return interpolate(t, [from, to], [0, 1], clampOpts);
};

export const stepById = (steps: Step[], id: string): Step => {
  const s = steps.find((x) => x.id === id);
  if (!s) throw new Error(`steps.json has no step "${id}"`);
  return s;
};

/** Headline: each step's `text` (the same string as its caption cue), cross-faded. */
export const Headline = ({ steps }: { steps: Step[] }) => {
  const t = useSeconds();
  return (
    <div style={{ position: "absolute", left: layout.sideX, right: layout.sideX, top: 36, height: 110 }}>
      {steps.map((s, i) => {
        const first = i === 0;
        const last = i === steps.length - 1;
        const opacity = interpolate(
          t,
          [s.start_s, s.start_s + (first ? 0.01 : 0.4), s.end_s - 0.3, s.end_s],
          [first ? 1 : 0, 1, 1, last ? 1 : 0],
          clampOpts,
        );
        const rise = first ? 0 : interpolate(t, [s.start_s, s.start_s + 0.4], [14, 0], clampOpts);
        if (t < s.start_s - 0.01 || t > s.end_s + 0.01) return null;
        return (
          <div
            key={s.id}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              opacity,
              translate: `0px ${rise}px`,
              fontFamily: font.sans,
              fontWeight: 700,
              fontSize: 50,
              lineHeight: 1.15,
              color: c.fgStrong,
              letterSpacing: "-0.01em",
            }}
          >
            {s.text}
          </div>
        );
      })}
    </div>
  );
};

/** Shared page: white canvas, accent rule under the headline zone. */
export const Frame = ({ steps, children }: { steps: Step[]; children: ReactNode }) => (
  <FontGate>
    <AbsoluteFill style={{ backgroundColor: c.canvas, fontFamily: font.sans, color: c.fg }}>
      <Headline steps={steps} />
      <div style={{ position: "absolute", left: layout.sideX, right: layout.sideX, top: 152, height: 3, backgroundColor: c.accent, borderRadius: 2 }} />
      {children}
    </AbsoluteFill>
  </FontGate>
);
