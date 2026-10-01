import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExercisePanel } from "@/components/exercise/exercise-panel";
import { CompleteBlock, TrackLastViewed } from "@/components/lesson/lesson-actions";
import {
  Differences,
  LessonHeader,
  LessonRail,
  PrevNextNav,
  ToolPanelContent,
} from "@/components/lesson/lesson-sections";
import { TITLE_SUFFIX } from "@/components/lesson/inline-text";
import { Markdown } from "@/components/lesson/markdown";
import { computePrevNext } from "@/components/lesson/navigation";
import { applyRouteHooks } from "@/components/lesson/server/test-hooks";
import { getLessonPage } from "@/components/lesson/server/queries";
import { parseTool } from "@/components/lesson/tool";
import { ToolProvider, ToolTabs } from "@/components/lesson/tool-tabs";
import { LessonWorkflowsRow } from "@/components/workflows/lesson-workflows";

// Content routes render dynamically so seeded changes show without a rebuild (S-3).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/lessons/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getLessonPage(slug);
  if (!data) return { title: `Lesson not found · ${TITLE_SUFFIX}` };
  return { title: `${data.lesson.title} · L${data.level.number} · ${TITLE_SUFFIX}` };
}

export default async function LessonPage({ params, searchParams }: PageProps<"/lessons/[slug]">) {
  const { slug } = await params;
  const query = await searchParams;
  // Test hooks (delay/fail) live here, below the layout, so they exercise loading.tsx and error.tsx.
  await applyRouteHooks("lesson");
  const data = await getLessonPage(slug);
  if (!data) notFound();

  const { lesson, level, number, exercise, navLessons, today } = data;
  const urlTool = parseTool(query.tool);
  const prevNext = computePrevNext(navLessons, lesson.slug);

  return (
    <ToolProvider initialTool={urlTool ?? "claude"} hasUrlTool={urlTool !== null}>
      <TrackLastViewed slug={lesson.slug} />
      <div className="lg:grid lg:grid-cols-12 lg:gap-8">
        <article className="min-w-0 lg:col-span-8">
          <LessonHeader
            slug={lesson.slug}
            number={number}
            title={lesson.title}
            objective={lesson.objective}
            minutes={lesson.est_minutes}
            lastVerifiedOn={lesson.last_verified_on}
            toolVersions={lesson.tool_versions}
            today={today}
            level={{ number: level.number, title: level.title }}
          />

          <hr className="my-8 border-divider" />

          <section aria-labelledby="concept">
            <h2 id="concept" className="text-2xl font-bold text-fg-strong">
              Concept
            </h2>
            <Markdown source={lesson.concept_md} />
          </section>

          <section aria-labelledby="tools" className="mt-10">
            <h2 id="tools" className="mb-3 text-2xl font-bold text-fg-strong">
              In your tool
            </h2>
            <ToolTabs
              scope="lesson"
              label="Tool"
              panels={{
                claude: (
                  <ToolPanelContent
                    tool="claude"
                    body={lesson.claude_md}
                    noEquivalent={lesson.claude_no_equivalent}
                    workaround={lesson.claude_workaround_md}
                    version={lesson.tool_versions.claude_code}
                  />
                ),
                codex: (
                  <ToolPanelContent
                    tool="codex"
                    body={lesson.codex_md}
                    noEquivalent={lesson.codex_no_equivalent}
                    workaround={lesson.codex_workaround_md}
                    version={lesson.tool_versions.codex_cli}
                  />
                ),
              }}
            />
          </section>

          <Differences items={lesson.differences} />

          {exercise && (
            <ExercisePanel
              exercise={{
                slug: exercise.slug,
                title: exercise.title,
                goal: exercise.goal,
                repoPath: exercise.repo_path,
                setupCmd: exercise.setup_cmd,
                verifyCmd: exercise.verify_cmd,
                prompts: exercise.starter_prompts,
                checklist: exercise.checklist,
                solutionNotes: exercise.solution_notes,
              }}
            />
          )}

          <CompleteBlock slug={lesson.slug} />
          {prevNext && <PrevNextNav prevNext={prevNext} />}
          <LessonWorkflowsRow lessonSlug={lesson.slug} />
        </article>

        <div className="lg:col-span-4">
          <LessonRail hasExercise={exercise !== null} />
        </div>
      </div>
    </ToolProvider>
  );
}
