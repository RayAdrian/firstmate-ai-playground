import { Skeleton, SkeletonRegion } from "@/components/ui";

// The filter column is skeletoned too: rendering real defaults here would flash values that may not match the URL.
export default function NewsArchiveLoading() {
  return (
    <SkeletonRegion testId="archive-skeleton" label="Loading archive…">
      <Skeleton className="h-9 w-56" />
      <div className="mt-6 lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-3">
          <Skeleton className="h-11 w-36 lg:h-96 lg:w-full lg:rounded-card" />
        </div>
        <div className="mt-6 min-w-0 lg:col-span-9 lg:mt-0">
          <Skeleton className="h-6 w-40" />
          <div className="mt-6 space-y-3 md:space-y-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton.NewsCard key={i} />
            ))}
          </div>
        </div>
      </div>
    </SkeletonRegion>
  );
}
