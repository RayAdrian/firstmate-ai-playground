import Link from "next/link";
import { SeedEmptyState } from "@/components/lesson/seed-empty";
import { getCurriculum } from "@/components/lesson/server/queries";
import { applyRouteHooks } from "@/components/lesson/server/test-hooks";
import { DigestTopItems } from "@/components/news";
import { ContinueCard, type ContinueLesson } from "./continue-card";
import { LevelCards } from "./level-cards";

/** Everything on the home page below the h1 (DESIGN 6.1). Async server component, suspended by the page. */
export async function HomeContent() {
  await applyRouteHooks("home");
  const { levels } = await getCurriculum();

  const withLessons = levels.filter((l) => l.lessons.length > 0);
  const lessonCount = withLessons.reduce((n, l) => n + l.lessons.length, 0);
  const continueLessons: ContinueLesson[] = withLessons.flatMap((level) =>
    level.lessons.map((lesson) => ({
      slug: lesson.slug,
      title: lesson.title,
      level: level.number,
      levelTitle: level.title,
      minutes: lesson.est_minutes,
    })),
  );
  const first = continueLessons[0];

  return (
    <>
      <p className="mt-2 text-base text-fg-muted md:text-lg">
        {lessonCount > 0
          ? `${lessonCount} hands-on ${lessonCount === 1 ? "lesson" : "lessons"}. Pick up where you left off.`
          : "Hands-on lessons for Claude Code and Codex CLI."}
      </p>

      <div className="mt-8 lg:grid lg:grid-cols-12 lg:gap-x-8 lg:gap-y-10">
        {first ? (
          <>
            <div className="lg:col-span-7 lg:row-start-1">
              <ContinueCard lessons={continueLessons} defaultSlug={first.slug} />
            </div>
            <section aria-labelledby="levels-title" className="mt-10 lg:col-span-12 lg:row-start-2 lg:mt-0">
              <h2 id="levels-title" className="text-xl font-bold text-fg-strong">
                Your levels
              </h2>
              <div className="mt-4">
                <LevelCards
                  levels={withLessons.map((level) => ({
                    number: level.number,
                    title: level.title,
                    slugs: level.lessons.map((l) => l.slug),
                  }))}
                />
              </div>
              <Link
                href="/curriculum"
                className="mt-4 inline-flex min-h-11 items-center font-medium text-link underline underline-offset-2"
              >
                View full curriculum
              </Link>
            </section>
          </>
        ) : (
          <div className="lg:col-span-7 lg:row-start-1">
            <SeedEmptyState />
          </div>
        )}
        <div className="mt-10 lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:mt-0">
          <DigestTopItems />
        </div>
      </div>
    </>
  );
}
