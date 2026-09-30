"use client";

import { Check } from "lucide-react";
import { ProgressBar, Skeleton } from "@/components/ui";
import { useLessonCompletion, useLessonsProgress } from "@/lib/progress";

/** Success pill: state is carried by the icon and the text, never by colour alone. */
export function CompletedBadge({ label = "Completed" }: { label?: string }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full bg-success-soft px-2.5 text-xs font-medium text-success">
      <Check size={12} aria-hidden="true" />
      {label}
    </span>
  );
}

/** "2 / 4" plus a progress bar for one level. Before hydration: a skeleton of the same size, no false 0. */
export function LevelProgress({ level, slugs }: { level: number; slugs: readonly string[] }) {
  const { hydrated, completedCount, total } = useLessonsProgress(slugs);
  if (!hydrated) {
    return (
      <div className="mt-3 flex items-center gap-3" data-testid="progress-placeholder" aria-hidden="true">
        <Skeleton className="h-5 w-12" />
        <Skeleton className="h-2 flex-1" />
      </div>
    );
  }
  return (
    <div className="mt-3 flex items-center gap-3">
      <span className="text-sm tabular-nums text-fg-muted">
        {completedCount} / {total}
      </span>
      <div className="flex-1">
        <ProgressBar
          value={completedCount}
          max={total}
          label={`Level ${level}`}
          valueText={`${completedCount} of ${total} lessons complete`}
        />
      </div>
      {total > 0 && completedCount === total && <CompletedBadge />}
    </div>
  );
}

/** Completion badge for a curriculum row. Nothing is rendered for "not started" (DESIGN 6.2). */
export function LessonState({ slug }: { slug: string }) {
  const { hydrated, completed } = useLessonCompletion(slug);
  if (!hydrated) return <span className="inline-block h-6 w-20" aria-hidden="true" />;
  return completed ? <CompletedBadge /> : <span className="inline-block h-6 w-0" aria-hidden="true" />;
}

/** "2/4" count next to a level's link in the lg rail. Empty until hydrated. */
export function RailCount({ slugs }: { slugs: readonly string[] }) {
  const { hydrated, completedCount, total } = useLessonsProgress(slugs);
  return (
    <span className="hidden text-sm tabular-nums text-fg-muted lg:inline" aria-hidden={!hydrated}>
      {hydrated ? `${completedCount}/${total}` : ""}
    </span>
  );
}
