import { Skeleton } from "@/components/ui";

/** Box-for-box stand-in for a scored NewsCard (tile, title, meta, tags, why). */
export function NewsCardSkeleton() {
  return (
    <div className="rounded-card bg-surface p-4 md:p-6" aria-hidden="true">
      <div className="flex gap-3 md:gap-4">
        <Skeleton className="size-12 shrink-0 rounded-xl md:size-14" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-7 w-4/5" />
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-6 w-1/3 rounded-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      </div>
    </div>
  );
}

/** Container for a skeleton region: aria-busy plus a single polite status line. */
export function SkeletonRegion({
  testId,
  label,
  count,
}: {
  testId: "news-skeleton" | "archive-skeleton";
  label: string;
  count: number;
}) {
  return (
    <div data-testid={testId} aria-busy="true" className="space-y-3 md:space-y-4">
      <span className="sr-only" role="status">
        {label}
      </span>
      {Array.from({ length: count }, (_, i) => (
        <NewsCardSkeleton key={i} />
      ))}
    </div>
  );
}
