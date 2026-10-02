import Link from "next/link";
import { Badge } from "@/components/ui";
import { EYEBROW_CLASS } from "@/components/lesson/inline-text";
import { ExerciseGithubLink } from "./github-link";
import { ExerciseProgress } from "./exercise-progress";

export type ExerciseListEntry = {
  slug: string;
  title: string;
  level: number;
  lessonSlug: string;
  lessonTitle: string;
  lessonNumber: string;
  automated: boolean;
  repoPath: string;
  itemIds: string[];
};

function VerifyBadge({ automated }: { automated: boolean }) {
  return <Badge variant="neutral">{automated ? "Auto" : "Manual"}</Badge>;
}

/** Exercises index (E-5): a table from lg up, cards grouped by level below. */
export function ExercisesList({ exercises }: { exercises: readonly ExerciseListEntry[] }) {
  const levels = [...new Set(exercises.map((e) => e.level))].sort((a, b) => a - b);
  return (
    <>
      <div className="hidden lg:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Exercises</caption>
          <thead>
            <tr className="border-b border-divider text-sm text-fg-muted">
              {["Level", "Exercise", "Lesson", "Verify", "Progress", "Repo"].map((h) => (
                <th key={h} scope="col" className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {exercises.map((e) => (
              <tr key={e.slug} className="border-b border-border-subtle">
                <td className="px-3 py-3 text-fg-muted">L{e.level}</td>
                <td className="px-3 py-3">
                  <Link
                    href={`/lessons/${e.lessonSlug}#exercise`}
                    className="font-bold text-link underline underline-offset-2"
                  >
                    {e.title}
                  </Link>
                </td>
                <td className="px-3 py-3 text-fg">
                  {e.lessonNumber} {e.lessonTitle}
                </td>
                <td className="px-3 py-3">
                  <VerifyBadge automated={e.automated} />
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  <ExerciseProgress slug={e.slug} itemIds={e.itemIds} />
                </td>
                <td className="whitespace-nowrap px-3 py-1">
                  <ExerciseGithubLink repoPath={e.repoPath} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-8 lg:hidden">
        {levels.map((level) => (
          <section key={level} aria-labelledby={`ex-level-${level}`}>
            <h2 id={`ex-level-${level}`} className={`mb-2 ${EYEBROW_CLASS}`}>
              Level {level}
            </h2>
            <div className="space-y-3">
              {exercises
                .filter((e) => e.level === level)
                .map((e) => (
                  <article
                    key={e.slug}
                    aria-labelledby={`ex-card-${e.slug}`}
                    className="relative rounded-card bg-surface p-5 dark:border dark:border-border"
                  >
                    <h3 id={`ex-card-${e.slug}`} className="text-lg font-bold text-fg-strong">
                      <Link
                        href={`/lessons/${e.lessonSlug}#exercise`}
                        className="text-link underline underline-offset-2 after:absolute after:inset-0"
                      >
                        {e.title}
                      </Link>
                    </h3>
                    <p className="mt-1 text-base text-fg-muted">
                      Lesson {e.lessonNumber} {e.lessonTitle}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <VerifyBadge automated={e.automated} />
                      <ExerciseProgress slug={e.slug} itemIds={e.itemIds} />
                    </div>
                    <ExerciseGithubLink repoPath={e.repoPath} className="mt-1" />
                  </article>
                ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
