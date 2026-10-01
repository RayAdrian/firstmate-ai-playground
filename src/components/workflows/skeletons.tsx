import { Skeleton, SkeletonRegion } from "@/components/ui";

// Loading skeletons shaped like the final layouts (DESIGN 4.8).

function CardSkeleton() {
  return (
    <div aria-hidden="true" className="rounded-card bg-surface p-5 md:p-6">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-2/3" />
      <div className="mt-4 flex gap-2">
        <Skeleton.Badge className="w-24" />
        <Skeleton.Badge />
      </div>
      <Skeleton className="mt-4 h-4 w-1/2" />
    </div>
  );
}

export function WorkflowsSkeleton() {
  return (
    <SkeletonRegion testId="workflows-skeleton" label="Loading workflows…">
      <Skeleton className="h-[2.375rem] w-48 md:h-11" />
      <Skeleton className="mt-6 h-11 max-w-xl" />
      <div className="mt-6 lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-3">
          <Skeleton className="h-11 w-36 lg:h-96 lg:w-full lg:rounded-card" />
        </div>
        <div className="mt-6 min-w-0 lg:col-span-9 lg:mt-0">
          <Skeleton className="h-6 w-32" />
          <div className="mt-6 grid gap-3 md:grid-cols-2 md:gap-4">
            {Array.from({ length: 6 }, (_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </SkeletonRegion>
  );
}

export function WorkflowSkeleton() {
  return (
    <SkeletonRegion testId="workflow-skeleton" label="Loading workflow…">
      <Skeleton className="h-5 w-64" />
      <Skeleton className="mt-6 h-4 w-24" />
      <Skeleton className="mt-2 h-10 w-full md:w-3/4" />
      <Skeleton className="mt-3 h-7 w-3/4" />
      <Skeleton className="mt-3 h-5 w-1/2" />
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <Skeleton className="h-32 rounded-card" />
        <Skeleton className="h-32 rounded-card" />
      </div>
      <Skeleton className="mt-10 h-40 w-full rounded-card" />
      <Skeleton className="mt-6 h-40 w-full rounded-card" />
    </SkeletonRegion>
  );
}
