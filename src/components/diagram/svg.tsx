import type { ReactElement, ReactNode } from "react";
import type { Drawing, Prim, TextPrim } from "./layout/model";

// Token utilities only (DG-5): no hex, rgb(), hsl() or named colours in the markup, so dark mode is free.
// Class strings are literals so Tailwind's scanner sees them.
const TEXT_TONE: Record<TextPrim["tone"], string> = {
  fg: "fill-fg",
  muted: "fill-fg-muted",
  danger: "fill-danger",
};
const TEXT_WEIGHT: Record<TextPrim["weight"], string> = { 400: "font-normal", 500: "font-medium", 700: "font-bold" };

const RECT = {
  node: { className: "fill-surface-raised stroke-control-border", sw: 1, dash: undefined },
  key: { className: "fill-accent-soft stroke-link", sw: 2, dash: undefined },
  risk: { className: "fill-surface-raised stroke-danger", sw: 1.5, dash: "6 4" },
  // The key risk step: a 2px dashed danger boundary on the raised fill (never the accent fill, which would say "good path").
  "key-risk": { className: "fill-surface-raised stroke-danger", sw: 2, dash: "6 4" },
  zone: { className: "fill-none stroke-control-border", sw: 1, dash: undefined },
} as const;

const CIRCLE = {
  badge: { className: "fill-surface-raised stroke-fg-muted", sw: 1, dash: undefined },
  "badge-risk": { className: "fill-surface-raised stroke-danger", sw: 1.5, dash: "3 2" },
} as const;

function renderPrim(p: Prim, key: number, ids: { arrow: string; x: string }): ReactNode {
  switch (p.k) {
    case "g":
      return (
        <g
          key={key}
          data-part={p.part}
          {...(p.state ? { "data-state": p.state } : {})}
          {...(p.ref ? { "data-ref": p.ref } : {})}
        >
          {p.children.map((c, i) => renderPrim(c, i, ids))}
        </g>
      );
    case "rect": {
      const v = RECT[p.variant];
      const h = v.sw / 2;
      return (
        <rect
          key={key}
          x={p.x + h}
          y={p.y + h}
          width={p.w - v.sw}
          height={p.h - v.sw}
          rx={12}
          strokeWidth={v.sw}
          {...(v.dash ? { strokeDasharray: v.dash } : {})}
          className={v.className}
        />
      );
    }
    case "text":
      return (
        <text
          key={key}
          x={p.x}
          y={p.y}
          fontSize={p.size}
          textAnchor={p.anchor}
          className={`${TEXT_TONE[p.tone]} ${TEXT_WEIGHT[p.weight]}${p.halo ? " stroke-surface" : ""}`}
          {...(p.halo ? { strokeWidth: 4, strokeLinejoin: "round" as const, paintOrder: "stroke" } : {})}
        >
          {p.text}
        </text>
      );
    case "path": {
      const risk = p.variant === "risk";
      if (p.variant === "underlay") {
        return <path key={key} d={p.d} strokeWidth={6} className="fill-none stroke-surface" />;
      }
      return (
        <path
          key={key}
          d={p.d}
          strokeWidth={1.5}
          strokeLinejoin="round"
          {...(risk ? { strokeDasharray: "6 4" } : {})}
          {...(p.end ? { markerEnd: `url(#${p.end === "x" ? ids.x : ids.arrow})` } : {})}
          {...(p.start ? { markerStart: `url(#${ids.x})` } : {})}
          className={`fill-none ${risk ? "stroke-danger" : "stroke-fg-muted"}`}
        />
      );
    }
    case "circle": {
      const v = CIRCLE[p.variant];
      return (
        <circle
          key={key}
          cx={p.cx}
          cy={p.cy}
          r={p.r}
          strokeWidth={v.sw}
          {...(v.dash ? { strokeDasharray: v.dash } : {})}
          className={v.className}
        />
      );
    }
    case "cross":
      return (
        <path
          key={key}
          d={`M ${p.x} ${p.y} l ${p.size} ${p.size} M ${p.x + p.size} ${p.y} l ${-p.size} ${p.size}`}
          strokeWidth={1.5}
          className="fill-none stroke-danger"
        />
      );
  }
}

/**
 * One orientation's SVG. `role="img"`, named by the title and described by the summary; nothing inside is focusable.
 * `suffix` is `h` or `v`, so the two SVGs on a page never share an id.
 */
export function DiagramSvg({
  drawing,
  diagramId,
  suffix,
  title,
  summary,
  className,
}: {
  drawing: Drawing;
  diagramId: string;
  suffix: "h" | "v";
  title: string;
  summary: string;
  className: string;
}): ReactElement {
  const base = `diagram-${diagramId}`;
  const ids = { arrow: `${base}-${suffix}-arrow`, x: `${base}-${suffix}-x` };
  const titleId = `${base}-title-${suffix}`;
  const descId = `${base}-desc-${suffix}`;
  return (
    <svg
      role="img"
      aria-labelledby={titleId}
      aria-describedby={descId}
      focusable="false"
      viewBox={`0 0 ${drawing.width} ${drawing.height}`}
      width={drawing.width}
      height={drawing.height}
      className={className}
    >
      <title id={titleId}>{title}</title>
      <desc id={descId}>{summary}</desc>
      <defs>
        <marker id={ids.arrow} markerUnits="userSpaceOnUse" markerWidth={8} markerHeight={8} refX={8} refY={4} orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" className="fill-fg-muted stroke-none" />
        </marker>
        {drawing.usesX && (
          <marker id={ids.x} markerUnits="userSpaceOnUse" markerWidth={8} markerHeight={8} refX={4} refY={4} orient="auto">
            <path d="M0 0 L8 8 M8 0 L0 8" strokeWidth={1.5} className="fill-none stroke-danger" />
          </marker>
        )}
      </defs>
      {drawing.children.map((c, i) => renderPrim(c, i, ids))}
    </svg>
  );
}
