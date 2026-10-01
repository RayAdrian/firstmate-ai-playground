import type { ReactElement } from "react";
import Link from "next/link";
import { Clapperboard, SquareTerminal } from "lucide-react";
import { getLessonMedia } from "@/components/lesson/server/media";
import { getCurriculum } from "@/components/lesson/server/queries";
import { logSkippedDiagram } from "./lesson-diagram";

/**
 * A workflow's `watch` line (PRD §17.5, DG-11): "Watch: <manifest title> (Lesson X.Y) →", a same-tab link to the lesson's
 * Watch block (`#watch-<media-id>`). Resolved at render. A manifest that is missing or invalid, or a lesson that is gone or
 * archived, omits the line and logs (DG-9): a stale `watch` never breaks the page.
 */
export async function WatchLine({ watch, context }: { watch: string; context: string }): Promise<ReactElement | null> {
  const [lessonSlug, mediaId] = watch.split("/");
  if (!lessonSlug || !mediaId) {
    logSkippedDiagram(context, "watch", ["not <lesson-slug>/<media-id>"]);
    return null;
  }
  const items = await getLessonMedia(lessonSlug);
  const item = items.find((i) => i.manifest.id === mediaId);
  if (!item) {
    logSkippedDiagram(context, "watch", [`no valid media item ${watch}`]);
    return null;
  }
  const curriculum = await getCurriculum();
  const lesson = curriculum.levels.flatMap((l) => l.lessons).find((l) => l.slug === lessonSlug);
  if (!lesson) {
    logSkippedDiagram(context, "watch", [`lesson ${lessonSlug} is missing or archived`]);
    return null;
  }
  const Icon = item.manifest.kind === "animation" ? Clapperboard : SquareTerminal;
  return (
    <p className="mt-4">
      <Link
        href={`/lessons/${lessonSlug}#watch-${mediaId}`}
        className="inline-flex min-h-11 items-center gap-2 font-medium text-link hover:underline"
      >
        <Icon size={16} aria-hidden="true" />
        <span>
          Watch: {item.manifest.title} (Lesson {lesson.number})<span aria-hidden="true"> →</span>
        </span>
      </Link>
    </p>
  );
}
