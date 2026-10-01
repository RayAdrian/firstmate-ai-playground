import { getWorkflowsForLesson, type LessonWorkflows } from "@/lib/workflows/queries";
import { WorkflowsThatUseThis } from "./lesson-row";

/**
 * Mounted on /lessons/[slug] after previous/next. A failed read renders nothing: the lesson must never fail
 * because of this row.
 */
export async function LessonWorkflowsRow({ lessonSlug }: { lessonSlug: string }) {
  const found: LessonWorkflows | null = await getWorkflowsForLesson(lessonSlug, 3).catch(() => null);
  if (!found) return null;
  return <WorkflowsThatUseThis lessonSlug={lessonSlug} items={found.items} total={found.total} />;
}
