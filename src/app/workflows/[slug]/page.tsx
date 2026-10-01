import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TITLE_SUFFIX } from "@/components/lesson/inline-text";
import { getCurriculum } from "@/components/lesson/server/queries";
import { parseTool } from "@/components/lesson/tool";
import type { RelatedLesson } from "@/components/workflows/at-a-glance";
import { WorkflowDetail } from "@/components/workflows/workflow-detail";
import { getCommunitySummaries } from "@/lib/community/server";
import { freshnessOf } from "@/lib/workflows/filter";
import { getWorkflowPage } from "@/lib/workflows/queries";

// Content routes render dynamically so seeded changes show without a rebuild (S-3).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/workflows/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getWorkflowPage(slug);
  if (!data) return { title: `Workflow not found · ${TITLE_SUFFIX}` };
  return { title: `${data.workflow.title} · Workflow · ${TITLE_SUFFIX}` };
}

/** The related lesson as "X.Y" + title, or null when it is unset, archived or removed (WF-35). */
async function findRelatedLesson(slug: string | null): Promise<RelatedLesson | null> {
  if (!slug) return null;
  const curriculum = await getCurriculum();
  for (const level of curriculum.levels) {
    const lesson = level.lessons.find((l) => l.slug === slug);
    if (lesson) return { slug, number: lesson.number, title: lesson.title };
  }
  return null;
}

export default async function WorkflowPage({ params, searchParams }: PageProps<"/workflows/[slug]">) {
  const { slug } = await params;
  const query = await searchParams;
  const data = await getWorkflowPage(slug);
  if (!data) notFound();
  const { workflow, today } = data;
  const [lesson, community] = await Promise.all([
    findRelatedLesson(workflow.related_lesson_slug),
    getCommunitySummaries([slug]),
  ]);
  return (
    <WorkflowDetail
      workflow={workflow}
      freshness={freshnessOf(workflow.verified_on, today)}
      lesson={lesson}
      urlTool={parseTool(query.tool)}
      community={community?.get(slug) ?? null}
    />
  );
}
