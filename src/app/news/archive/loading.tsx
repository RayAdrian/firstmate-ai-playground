import { Skeleton } from "@/components/ui";
import { SkeletonRegion } from "@/components/news/skeletons";

export default function NewsArchiveLoading() {
  return (
    <>
      <Skeleton className="h-9 w-56" />
      <div className="mt-6 lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-3">
          <Skeleton className="h-11 w-36 lg:h-96 lg:w-full lg:rounded-card" />
        </div>
        <div className="mt-6 min-w-0 lg:col-span-9 lg:mt-0">
          <Skeleton className="h-5 w-40" />
          <div className="mt-6">
            <SkeletonRegion testId="archive-skeleton" label="Loading archive…" count={6} />
          </div>
        </div>
      </div>
    </>
  );
}
