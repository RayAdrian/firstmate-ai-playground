import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { WorkflowCardData } from "@/lib/workflows/filter";
import { workflowsHref } from "@/lib/workflows/params";

/** Presentational row (PRD WF-39a). Renders nothing for an empty list: no empty heading. */
export function WorkflowsThatUseThis({
  lessonSlug,
  items,
  total,
}: {
  lessonSlug: string;
  items: readonly WorkflowCardData[];
  total: number;
}) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="lesson-workflows" className="mt-10">
      <h2 id="lesson-workflows" className="text-2xl font-bold text-fg-strong">
        Workflows that use this
      </h2>
      <ul className="mt-3 space-y-3">
        {items.map((w) => (
          <li key={w.slug}>
            <Link
              href={`/workflows/${w.slug}`}
              className="flex min-h-11 flex-col rounded-xl bg-surface p-4 hover:bg-accent-subtle dark:border dark:border-border"
            >
              <span className="font-bold text-fg-strong [overflow-wrap:anywhere]">{w.title}</span>
              <span className="mt-1 text-base text-fg [overflow-wrap:anywhere]">{w.problem}</span>
            </Link>
          </li>
        ))}
      </ul>
      {total > items.length ? (
        <p className="mt-3">
          <Link
            href={workflowsHref({ lesson: lessonSlug })}
            className="inline-flex min-h-11 items-center gap-1 font-medium text-link underline underline-offset-2"
          >
            See all {total}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </p>
      ) : null}
    </section>
  );
}
