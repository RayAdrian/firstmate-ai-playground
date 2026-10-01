import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EYEBROW_CLASS } from "@/components/lesson/inline-text";
import type { WorkflowRow } from "@/lib/contracts";
import { reportOutdatedUrl } from "@/lib/workflows/report";
import { KindBadges, StackChips, ToolBadges } from "./parts";

export const SECTION_LINKS = [
  { id: "result", label: "Result" },
  { id: "setup", label: "Setup" },
  { id: "prompt", label: "Prompt" },
  { id: "steps", label: "Steps" },
  { id: "why-it-works", label: "Why it works" },
] as const;

export type RelatedLesson = { slug: string; number: string; title: string };

const LINK = "text-link underline underline-offset-2";

function Facts({ workflow, lesson }: { workflow: WorkflowRow; lesson: RelatedLesson | null }) {
  const url = reportOutdatedUrl(workflow.slug);
  return (
    <dl className="space-y-4 text-sm text-fg">
      <div>
        <dt className="mb-1 font-bold text-fg-strong">Tools</dt>
        <dd className="flex flex-wrap gap-2">
          <ToolBadges tools={workflow.tools} />
        </dd>
      </div>
      <div>
        <dt className="mb-1 font-bold text-fg-strong">Setup type</dt>
        <dd className="flex flex-wrap gap-2">
          <KindBadges kinds={workflow.setup_kinds} />
        </dd>
      </div>
      <div>
        <dt className="mb-1 font-bold text-fg-strong">Stack</dt>
        <dd className="flex flex-wrap gap-2">
          <StackChips stacks={workflow.stacks} />
        </dd>
      </div>
      {lesson ? (
        <div>
          <dt className="sr-only">Related lesson</dt>
          <dd>
            <Link href={`/lessons/${lesson.slug}`} className={`inline-flex min-h-11 items-center gap-1 ${LINK}`}>
              Builds on Lesson {lesson.number}: {lesson.title}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </dd>
        </div>
      ) : null}
      <div>
        <dt className="sr-only">Feedback</dt>
        <dd>
          <a href={url} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-11 items-center gap-1 ${LINK}`}>
            Report outdated <span aria-hidden="true">↗</span>
            <span className="sr-only"> (opens in new tab)</span>
          </a>
        </dd>
      </div>
    </dl>
  );
}

/**
 * "At a glance" (PRD WF-35). From lg it is a sticky right rail with the section links; below lg the same
 * facts render as a block under the meta line, without "On this page".
 */
export function AtAGlance({
  workflow,
  lesson,
  variant,
}: {
  workflow: WorkflowRow;
  lesson: RelatedLesson | null;
  variant: "rail" | "inline";
}) {
  if (variant === "inline") {
    return (
      <section aria-label="At a glance" className="mt-6 rounded-card bg-surface p-4 lg:hidden dark:border dark:border-border">
        <p className={`mb-3 ${EYEBROW_CLASS}`}>At a glance</p>
        <Facts workflow={workflow} lesson={lesson} />
      </section>
    );
  }
  return (
    <aside
      aria-label="At a glance"
      className="hidden lg:sticky lg:top-[76px] lg:block lg:self-start"
    >
      <div className="rounded-card bg-surface p-5 dark:border dark:border-border">
        <p className={`mb-3 ${EYEBROW_CLASS}`}>At a glance</p>
        <Facts workflow={workflow} lesson={lesson} />
        <nav aria-label="On this page" className="mt-5 border-t border-divider pt-4">
          <p className={`mb-2 ${EYEBROW_CLASS}`}>On this page</p>
          <ul className="space-y-1">
            {SECTION_LINKS.map((l) => (
              <li key={l.id}>
                <a href={`#${l.id}`} className={`inline-flex min-h-6 items-center py-1 text-sm ${LINK}`}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
