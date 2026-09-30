import type { Metadata } from "next";
import { ExercisesList } from "@/components/exercise/exercises-list";
import { SeedEmptyState } from "@/components/lesson/seed-empty";
import { getExerciseList } from "@/components/lesson/server/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Exercises" };

export default async function ExercisesPage() {
  const exercises = await getExerciseList();
  return (
    <>
      <h1 className="text-3xl font-bold text-fg-strong md:text-4xl">Exercises</h1>
      {exercises.length === 0 ? (
        <div className="mt-6">
          <SeedEmptyState />
        </div>
      ) : (
        <>
          <p className="mt-2 mb-8 text-base text-fg-muted">
            {exercises.length} hands-on {exercises.length === 1 ? "project" : "projects"}. Each has a starter, a
            reference solution and a checklist.
          </p>
          <ExercisesList exercises={exercises} />
        </>
      )}
    </>
  );
}
