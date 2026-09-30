"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { buttonClasses } from "@/components/ui";
import { EYEBROW_CLASS } from "@/components/lesson/inline-text";
import { useLastViewed } from "@/lib/progress";

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
  const bySlug = useMemo(() => new Map(lessons.map((l) => [l.slug, l])), [lessons]);
  const fallback = bySlug.get(defaultSlug) ?? lessons[0];
  const current = (hydrated && lastViewed ? bySlug.get(lastViewed.slug) : undefined) ?? fallback;
  if (!current) return null;

  return (
    <section
      aria-labelledby="continue-title"
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
      <Link
        href={`/lessons/${current.slug}`}
        className={`${buttonClasses("primary", "md")} mt-4 max-w-full`}
      >
        <span className="min-w-0 truncate">Continue: {current.title}</span>
        <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
      </Link>
    </section>
  );
}
