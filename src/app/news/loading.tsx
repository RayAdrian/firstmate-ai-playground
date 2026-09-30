import { Skeleton, SkeletonRegion } from "@/components/ui";

// Same boxes as the loaded page: h1 + meta line, then news cards. The 8-col/4-col split only exists at lg.
export default function NewsLoading() {
  return (
    <div className="lg:grid lg:grid-cols-12 lg:gap-8">
      <SkeletonRegion testId="news-skeleton" label="Loading news…" className="min-w-0 lg:col-span-8">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-2 h-6 w-64" />
        <div className="mt-4 space-y-3 md:space-y-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton.NewsCard key={i} />
          ))}
        </div>
      </SkeletonRegion>
    </div>
  );
}
