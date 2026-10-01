"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { buttonClasses } from "@/components/ui";
import { EYEBROW_CLASS } from "@/components/lesson/inline-text";
import { useLastViewed, useLessonsProgress } from "@/lib/progress";

export type ContinueLesson = {
  slug: string;
  title: string;
  level: number;
  levelTitle: string;
  minutes: number;
};

/**
 * Continue card (C-4, DESIGN 6.1). The server renders the C-4.2 default (first lesson of the first
 * level); after mount, if `lastViewed` names another active lesson, the title, meta and link swap in
 * place. Same box, so no layout shift. An unknown or archived slug silently falls back to the default.
 */
export function ContinueCard({
  lessons,
  defaultSlug,
}: {
  lessons: readonly ContinueLesson[];
  defaultSlug: string;
}) {
  const { hydrated, lastViewed } = useLastViewed();
  const { isComplete } = useLessonsProgress(lessons.map((l) => l.slug));
  const bySlug = useMemo(() => new Map(lessons.map((l) => [l.slug, l])), [lessons]);
  const fallback = bySlug.get(defaultSlug) ?? lessons[0];
  if (!fallback) return null;
  const start = (hydrated && lastViewed ? bySlug.get(lastViewed.slug) : undefined) ?? fallback;

  // Resume the last viewed lesson. If it is already complete, move on to the next incomplete lesson in curriculum
  // order (wrapping to the earliest one); if everything is complete, say so.
  let current: ContinueLesson | null = start;
  if (hydrated && isComplete(start.slug)) {
    const from = lessons.indexOf(start);
    const ordered = [...lessons.slice(from + 1), ...lessons.slice(0, from)];
    current = ordered.find((l) => !isComplete(l.slug)) ?? null;
  }

  if (!current) {
    return (
      <section aria-labelledby="continue-title" className="rounded-card bg-accent-soft p-5 md:p-6">
        <p className={EYEBROW_CLASS}>Continue</p>
        <h2 id="continue-title" className="mt-1 text-xl font-bold text-fg-strong md:text-2xl">
          You&apos;ve completed the curriculum
        </h2>
        <p className="mt-1 text-sm text-fg-muted">
          All {lessons.length} lessons are marked complete. Revisit any of them from the curriculum.
        </p>
        <Link href="/curriculum" className={`${buttonClasses("primary", "md")} mt-4 max-w-full`}>
          <span className="min-w-0 truncate">Review the curriculum</span>
          <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
        </Link>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="continue-title"
      data-hydrated={hydrated ? "true" : "false"}
      className="rounded-card bg-accent-soft p-5 md:p-6"
    >
      <p className={EYEBROW_CLASS}>Continue</p>
      <h2
        id="continue-title"
        className="mt-1 text-xl font-bold text-fg-strong md:text-2xl [overflow-wrap:anywhere]"
      >
        {current.title}
      </h2>
      <p className="mt-1 text-sm text-fg-muted">
        L{current.level} · {current.levelTitle} · {current.minutes} min
      </p>
      {/* Before hydration the target may still change (the stored last-viewed lesson is unknown), so the link is inert
          and says so: nobody can follow a wrong default. The href stays so the server HTML is still a real link. */}
      <Link
        href={`/lessons/${current.slug}`}
        aria-disabled={hydrated ? undefined : true}
        tabIndex={hydrated ? undefined : -1}
        className={`${buttonClasses("primary", "md")} mt-4 max-w-full ${
          hydrated ? "" : "pointer-events-none opacity-70"
        }`}
      >
        <span className="min-w-0 truncate">{hydrated ? `Continue: ${current.title}` : "Loading your progress…"}</span>
        <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
      </Link>
    </section>
  );
}
