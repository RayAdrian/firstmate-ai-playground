"use client";

import { useSyncExternalStore } from "react";
import { cn } from "./cn";
import { Skeleton } from "./skeleton";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** Integer percentage, half-up, clamped to 0..100. Never NaN (max 0 gives 0). */
export function progressPercent(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / max) * 100)));
}

/**
 * Progress bar (DESIGN.md §4.7). Until the client has mounted it renders a same-size placeholder with
 * NO role=progressbar, so tests and assistive tech never see a false 0 (P-5).
 * `showCount` adds the visible "value / max" text the bar is meant to be paired with.
 */
export function ProgressBar({
  value,
  max = 100,
  label,
  valueText,
  size = "md",
  showCount = false,
  className,
}: {
  value: number;
  max?: number;
  label: string;
  valueText?: string;
  size?: "sm" | "md";
  showCount?: boolean;
  className?: string;
}) {
  const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const pct = progressPercent(value, max);
  const track = size === "sm" ? "h-1.5" : "h-2";

  if (!mounted) {
    return (
      <div
        data-testid="progress-placeholder"
        aria-busy="true"
        className={cn("flex items-center gap-3", className)}
      >
        <Skeleton className={cn("w-full rounded-full", track)} />
        {showCount ? <Skeleton className="h-4 w-[3ch] shrink-0" /> : null}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={valueText}
        className={cn("w-full overflow-hidden rounded-full bg-progress-track", track)}
      >
        <div
          className="h-full rounded-full bg-progress-fill transition-[width] duration-[var(--fm-duration-base)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      {showCount ? (
        <span className="shrink-0 text-sm tabular-nums text-fg-muted">
          {Number.isFinite(value) ? value : 0} / {Number.isFinite(max) ? max : 0}
        </span>
      ) : null}
    </div>
  );
}
