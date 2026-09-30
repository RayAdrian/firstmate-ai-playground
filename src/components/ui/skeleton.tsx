import type { ReactNode } from "react";
import { cn } from "./cn";

function SkeletonRoot({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("h-4 animate-pulse rounded-lg bg-skeleton", className)} />;
}

const TEXT_WIDTHS = ["w-full", "w-[90%]", "w-3/5"] as const;

/** `lines` text rows at 100%, 90%, 60% width, cycling. */
function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("space-y-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={cn("h-4 animate-pulse rounded-lg bg-skeleton", TEXT_WIDTHS[i % TEXT_WIDTHS.length])} />
      ))}
    </div>
  );
}

function SkeletonTitle({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("h-7 w-2/3 animate-pulse rounded-lg bg-skeleton", className)} />;
}

function SkeletonBadge({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("h-6 w-16 animate-pulse rounded-full bg-skeleton", className)} />;
}

/** A lesson row: title, two text lines. Matches the /curriculum row rhythm (py-3). */
function SkeletonRow({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("space-y-2 py-3", className)}>
      <div className="h-6 w-2/3 animate-pulse rounded-lg bg-skeleton" />
      <div className="h-4 w-full animate-pulse rounded-lg bg-skeleton" />
      <div className="h-4 w-1/2 animate-pulse rounded-lg bg-skeleton" />
    </div>
  );
}

/** A scored news card: score tile beside title, meta, tags and why-it-matters. */
function SkeletonNewsCard({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex gap-3 rounded-card bg-surface p-4 md:gap-4 md:p-6", className)}>
      <div className="size-12 shrink-0 animate-pulse rounded-xl bg-skeleton md:size-14" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-6 w-4/5 animate-pulse rounded-lg bg-skeleton" />
        <div className="h-4 w-1/2 animate-pulse rounded-lg bg-skeleton" />
        <div className="h-6 w-32 animate-pulse rounded-full bg-skeleton" />
        <div className="h-4 w-full animate-pulse rounded-lg bg-skeleton" />
        <div className="h-4 w-3/4 animate-pulse rounded-lg bg-skeleton" />
      </div>
    </div>
  );
}

export const Skeleton = Object.assign(SkeletonRoot, {
  Text: SkeletonText,
  Title: SkeletonTitle,
  Badge: SkeletonBadge,
  Row: SkeletonRow,
  NewsCard: SkeletonNewsCard,
});

/**
 * Container for a loading.tsx: `aria-busy` plus one visually hidden status message.
 * `testId` is one of the selector-contract ids (curriculum-skeleton, lesson-skeleton, ...).
 */
export function SkeletonRegion({
  children,
  label = "Loading…",
  testId,
  className,
}: {
  children: ReactNode;
  label?: string;
  testId?: string;
  className?: string;
}) {
  return (
    <div aria-busy="true" data-testid={testId} className={className}>
      <span className="sr-only" role="status">
        {label}
      </span>
      {children}
    </div>
  );
}
