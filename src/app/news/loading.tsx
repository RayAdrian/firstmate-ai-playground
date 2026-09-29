import { Skeleton } from "@/components/ui";
import { SkeletonRegion } from "@/components/news/skeletons";

export default function NewsLoading() {
  return (
    <div className="lg:grid lg:grid-cols-12 lg:gap-8">
      <div className="min-w-0 lg:col-span-8">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-2 h-5 w-64" />
        <div className="mt-4">
          <SkeletonRegion testId="news-skeleton" label="Loading news…" count={4} />
        </div>
      </div>
    </div>
  );
}
