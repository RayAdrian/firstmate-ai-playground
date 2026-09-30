"use client";

import { ProgressBar, Skeleton } from "@/components/ui";
import { useChecklist } from "@/lib/progress";

/**
 * "3 / 4" with a bar for one exercise's checklist. An em dash means "no data": nothing has been
 * checked yet (the literal "not started" is banned from the DOM). Skeleton until hydrated.
 */
export function ExerciseProgress({ slug, itemIds }: { slug: string; itemIds: readonly string[] }) {
  const { hydrated, doneCount, total } = useChecklist(slug, itemIds);
  if (!hydrated) {
    return (
      <span data-testid="progress-placeholder" className="block">
        <Skeleton className="h-5 w-24" />
      </span>
    );
  }
  if (doneCount === 0) {
    return (
      <span className="text-fg-muted">
        <span aria-hidden="true">—</span>
        <span className="sr-only">No progress yet</span>
      </span>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <span className="whitespace-nowrap text-sm tabular-nums text-fg-muted">
        {doneCount} / {total}
      </span>
      <div className="w-20">
        <ProgressBar
          value={doneCount}
          max={total}
          label={`Checklist progress`}
          valueText={`${doneCount} of ${total} done`}
        />
      </div>
    </div>
  );
}
