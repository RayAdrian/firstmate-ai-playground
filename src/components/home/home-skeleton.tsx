import { Skeleton } from "@/components/ui";

/** Loading skeleton shaped like the home content: subtitle, Continue card, level cards, 3 news rows (DESIGN 6.1). */
export function HomeSkeleton() {
  return (
    <div data-testid="home-skeleton" aria-busy="true">
      <span className="sr-only" role="status">
        Loading home…
      </span>
      <Skeleton className="mt-2 h-12 w-2/3 md:h-7" />
      <div className="mt-8 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-8">
        <div className="lg:col-span-7">
          <Skeleton className="h-[172px] w-full rounded-card md:h-[188px]" />
          <Skeleton className="mt-10 h-8 w-40" />
          {/* Row heights and gaps mirror the loaded level cards (divided list at 360, 2 cols at md, 3 at lg) so the
              swap does not move the content below. */}
          <div className="mt-4 grid gap-px md:grid-cols-2 md:gap-4 lg:grid-cols-3">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-[108px] w-full rounded-card md:h-[116px] lg:h-[140px]" />
            ))}
          </div>
          <Skeleton className="mt-4 h-11 w-48" />
        </div>
        <div className="mt-10 lg:col-span-5 lg:col-start-8 lg:mt-0">
          <Skeleton className="h-8 w-44" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-[139px] w-full rounded-card md:h-[96px] lg:h-[108px]" />
            ))}
          </div>
          <Skeleton className="mt-4 h-11 w-24" />
        </div>
      </div>
    </div>
  );
}
