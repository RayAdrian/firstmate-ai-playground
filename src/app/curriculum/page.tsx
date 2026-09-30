import type { Metadata } from "next";
import { TITLE_SUFFIX } from "@/components/lesson/inline-text";
import { CurriculumList } from "@/components/lesson/curriculum-list";
import { SeedEmptyState } from "@/components/lesson/seed-empty";
import { getCurriculum } from "@/components/lesson/server/queries";
import { applyRouteHooks } from "@/components/lesson/server/test-hooks";

// Content routes render dynamically so seeded changes show without a rebuild (S-3).
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `Curriculum · ${TITLE_SUFFIX}` };

export default async function CurriculumPage() {
  // The test hooks live in the page, not in getCurriculum, so lessons and exercises are unaffected.
  await applyRouteHooks("curriculum");
  const { levels, today } = await getCurriculum();
  const lessonCount = levels.reduce((n, l) => n + l.lessons.length, 0);

  return (
    <>
      <h1 className="text-3xl font-bold text-fg-strong md:text-4xl">Curriculum</h1>
      {lessonCount === 0 ? (
        <div className="mt-6">
          <SeedEmptyState />
        </div>
      ) : (
        <>
          <p className="mt-2 mb-8 text-base text-fg-muted">
            {levels.length} {levels.length === 1 ? "level" : "levels"} · {lessonCount}{" "}
            {lessonCount === 1 ? "lesson" : "lessons"}. No lesson is locked; start wherever fits.
          </p>
          <CurriculumList levels={levels} today={today} />
        </>
      )}
    </>
  );
}
