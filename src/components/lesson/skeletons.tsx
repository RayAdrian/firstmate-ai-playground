import { Skeleton } from "@/components/ui";

// Loading skeletons shaped like the final layout (DESIGN 4.8): same boxes, same gaps.

function Busy({ testId, label, children }: { testId: string; label: string; children: React.ReactNode }) {
  return (
    <div data-testid={testId} aria-busy="true">
      <span className="sr-only" role="status">
        {label}
      </span>
      {children}
    </div>
  );
}

function LessonRowSkeleton() {
  return (
    <li className="p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="mt-2 h-6 w-full" />
      <Skeleton className="mt-2 h-5 w-3/4" />
    </li>
  );
}

export function CurriculumSkeleton() {
  return (
    <Busy testId="curriculum-skeleton" label="Loading curriculum…">
      <Skeleton className="h-[2.375rem] w-56 md:h-11" />
      <Skeleton className="mt-2 mb-8 h-6 w-2/3" />
      <div className="lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="mb-8 hidden lg:col-span-3 lg:mb-0 lg:block" />
        <div className="space-y-12 lg:col-span-9">
          {[1, 2].map((n) => (
            <section key={n}>
              <Skeleton className="h-4 w-16" />
              <Skeleton className="mt-1 h-8 w-2/3" />
              <Skeleton className="mt-1 h-6 w-1/2" />
              <Skeleton className="mt-3 h-5 w-full" />
              <ol className="mt-4 divide-y divide-border-subtle rounded-card bg-surface">
                <LessonRowSkeleton />
                <LessonRowSkeleton />
                <LessonRowSkeleton />
              </ol>
            </section>
          ))}
        </div>
      </div>
    </Busy>
  );
}

export function LessonSkeleton() {
  return (
    <Busy testId="lesson-skeleton" label="Loading lesson…">
      <Skeleton className="h-5 w-64" />
      <Skeleton className="mt-6 h-4 w-24" />
      <Skeleton className="mt-2 h-10 w-full md:w-3/4" />
      <Skeleton className="mt-2 h-10 w-2/3 md:hidden" />
      <Skeleton className="mt-3 h-7 w-3/4" />
      <Skeleton className="mt-3 h-5 w-1/2" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-5" />
        ))}
      </div>
      <div className="mt-8 flex gap-2">
        <Skeleton className="h-11 w-32" />
        <Skeleton className="h-11 w-32" />
      </div>
      <div className="mt-4 space-y-3">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-5" />
        ))}
      </div>
      <Skeleton className="mt-8 h-32 w-full rounded-card" />
    </Busy>
  );
}

export function ExercisesSkeleton() {
  return (
    <Busy testId="exercises-skeleton" label="Loading exercises…">
      <Skeleton className="h-[2.375rem] w-48 md:h-11" />
      <Skeleton className="mt-2 mb-8 h-6 w-2/3" />
      <div className="space-y-3">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-card" />
        ))}
      </div>
    </Busy>
  );
}
