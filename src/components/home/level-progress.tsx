"use client";

import { Check } from "lucide-react";
import { Badge, ProgressBar, Skeleton } from "@/components/ui";
import { useLessonsProgress } from "@/lib/progress";

/**
 * "1 / 2" plus a bar for one level card. Until hydration it renders a same-size skeleton, never a
 * false "0 / n" (P-5). Reuses ProgressBar, whose accessible name is "Level <n>" (DESIGN 11.3).
 */
export function HomeLevelProgress({ level, slugs }: { level: number; slugs: readonly string[] }) {
  const { hydrated, completedCount, total } = useLessonsProgress(slugs);
  if (!hydrated) {
    return (
      <div className="mt-3" data-testid="progress-placeholder" aria-busy="true">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="mt-2 h-2 w-full rounded-full" />
      </div>
    );
  }
  return (
    <div className="mt-3">
      <div className="flex h-6 items-center justify-between gap-2">
        <span className="text-sm tabular-nums text-fg-muted">
          {completedCount} / {total}
        </span>
        {total > 0 && completedCount === total ? (
          <Badge variant="success" icon={<Check />}>
            Done
          </Badge>
        ) : null}
      </div>
      <ProgressBar
        className="mt-2"
        value={completedCount}
        max={total}
        label={`Level ${level}`}
        valueText={`${completedCount} of ${total} lessons complete`}
      />
    </div>
  );
}
