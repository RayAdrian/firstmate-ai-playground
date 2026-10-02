import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { TITLE_SUFFIX } from "@/components/lesson/inline-text";
import { ExercisesList } from "@/components/exercise/exercises-list";
import { SeedEmptyState } from "@/components/lesson/seed-empty";
import { CommandLine } from "@/components/ui/command-line";
import { REPO_CLONE_CMD, exercisesTreeUrl } from "@/lib/site";
import { getExerciseList } from "@/components/lesson/server/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `Exercises · ${TITLE_SUFFIX}` };

export default async function ExercisesPage() {
  const exercises = await getExerciseList();
  return (
    <>
      <h1 className="text-3xl font-bold text-fg-strong md:text-4xl">Exercises</h1>
      <div className="mt-4 mb-6 max-w-[var(--fm-measure)]">
        <p className="text-base text-fg">
          <a
            href={exercisesTreeUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1 text-link underline underline-offset-2 hover:decoration-2"
          >
            Exercises live in the repo: clone it to start
            <span aria-hidden="true">&rarr;</span>
            <ExternalLink size={14} aria-hidden="true" />
            <span className="sr-only"> (opens in new tab)</span>
          </a>
        </p>
        <CommandLine label="Clone" command={REPO_CLONE_CMD} />
        <p className="mt-2 text-sm text-fg-muted">The repo is private. Ask the owner for access.</p>
      </div>
      {exercises.length === 0 ? (
        <div className="mt-6">
          <SeedEmptyState />
        </div>
      ) : (
        <>
          <p className="mb-8 text-base text-fg-muted">
            {exercises.length} hands-on {exercises.length === 1 ? "project" : "projects"}. Each has a starter, a
            reference solution and a checklist.
          </p>
          <ExercisesList exercises={exercises} />
        </>
      )}
    </>
  );
}
