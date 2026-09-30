import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { isOutdated, verifiedLine, type ToolVersions } from "./format";
import { LessonState, LevelProgress, RailCount } from "./curriculum-progress";

export type CurriculumListLesson = {
  slug: string;
  sort: number;
  title: string;
  objective: string;
  est_minutes: number;
  tool_versions: ToolVersions;
  last_verified_on: string | null;
};

export type CurriculumListLevel = {
  number: number;
  title: string;
  summary: string;
  lessons: CurriculumListLesson[];
};

export function OutdatedBadge() {
  return (
    <span
      title="Last verified more than 60 days ago; commands may have changed."
      className="inline-flex h-6 items-center gap-1 rounded-full bg-warning-soft px-2.5 text-xs font-medium text-warning"
    >
      <AlertTriangle size={12} aria-hidden="true" />
      May be outdated
    </span>
  );
}

/**
 * Levels in numeric order with lessons in `sort` order (C-1.1), whatever order they arrive in.
 * Completion state is client-only and appears after hydration (P-5).
 */
export function CurriculumList({
  levels,
  today,
}: {
  levels: readonly CurriculumListLevel[];
  today: string;
}) {
  const ordered = [...levels]
    .sort((a, b) => a.number - b.number)
    .map((level) => ({ ...level, lessons: [...level.lessons].sort((a, b) => a.sort - b.sort) }));

  return (
    <div className="lg:grid lg:grid-cols-12 lg:gap-8">
      <nav
        aria-label="Levels"
        className="mb-8 lg:sticky lg:top-[76px] lg:col-span-3 lg:mb-0 lg:self-start"
      >
        <p className="mb-2 hidden text-xs font-medium uppercase tracking-eyebrow text-fg-muted lg:block">
          On this page
        </p>
        <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
          {ordered.map((level) => (
            <li key={level.number} className="flex items-center justify-between gap-3">
              <a
                href={`#level-${level.number}`}
                className="inline-flex h-11 items-center rounded-full bg-accent-soft px-4 text-sm font-medium text-link lg:h-auto lg:min-h-6 lg:bg-transparent lg:px-0 lg:py-1"
              >
                L{level.number}
                <span className="hidden lg:inline">&nbsp;{level.title}</span>
              </a>
              <RailCount slugs={level.lessons.map((l) => l.slug)} />
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-12 lg:col-span-9">
        {ordered.map((level) => (
          <section
            key={level.number}
            id={`level-${level.number}`}
            aria-labelledby={`level-${level.number}-eyebrow level-${level.number}-title`}
          >
            <p
              id={`level-${level.number}-eyebrow`}
              className="text-xs font-medium uppercase tracking-eyebrow text-fg-muted"
            >
              Level {level.number}
            </p>
            <h2 id={`level-${level.number}-title`} className="mt-1 text-2xl font-bold text-fg-strong">
              {level.title}
            </h2>
            <p className="mt-1 text-base text-fg-muted">{level.summary}</p>
            <LevelProgress level={level.number} slugs={level.lessons.map((l) => l.slug)} />
            <ol className="mt-4 divide-y divide-border-subtle rounded-card bg-surface dark:border dark:border-border">
              {level.lessons.map((lesson, i) => {
                const line = verifiedLine(lesson.last_verified_on, lesson.tool_versions);
                const outdated = isOutdated(lesson.last_verified_on, today);
                return (
                  <li
                    key={lesson.slug}
                    className="relative p-5 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-solid has-[a:focus-visible]:outline-focus md:p-6"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-baseline gap-3">
                        <span className="text-sm tabular-nums text-fg-muted">
                          {level.number}.{i + 1}
                        </span>
                        <h3 className="text-lg font-bold text-fg-strong">
                          <Link href={`/lessons/${lesson.slug}`} className="after:absolute after:inset-0">
                            {lesson.title}
                          </Link>
                        </h3>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-2">
                        <LessonState slug={lesson.slug} />
                      </div>
                    </div>
                    <p className="mt-1 text-base text-fg line-clamp-2 lg:line-clamp-none">{lesson.objective}</p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
                      <span>{lesson.est_minutes} min</span>
                      {line && <span>· {line}</span>}
                      {outdated && <OutdatedBadge />}
                    </p>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
