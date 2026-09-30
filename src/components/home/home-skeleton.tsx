import { Skeleton } from "@/components/ui";

/** Loading skeleton shaped like the home content: subtitle, Continue card, level cards, 3 news rows (DESIGN 6.1). */
export function HomeSkeleton() {
  return (
    <div data-testid="home-skeleton" aria-busy="true">
      <span className="sr-only" role="status">
        Loading home…
      </span>
      <Skeleton className="mt-2 h-6 w-2/3" />
      <div className="mt-8 lg:grid lg:grid-cols-12 lg:gap-x-8 lg:gap-y-10">
        <div className="lg:col-span-7 lg:row-start-1">
          <Skeleton className="h-[204px] w-full rounded-card md:h-[216px]" />
        </div>
        <div className="mt-10 lg:col-span-12 lg:row-start-2 lg:mt-0">
          <Skeleton className="h-8 w-40" />
          <div className="mt-4 grid gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-[92px] w-full rounded-card md:h-[104px]" />
            ))}
          </div>
        </div>
        <div className="mt-10 lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:mt-0">
          <Skeleton className="h-7 w-44" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-[100px] w-full rounded-card" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
