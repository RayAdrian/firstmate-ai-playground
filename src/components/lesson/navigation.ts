// Ordering, numbering and previous/next across levels (L-6.1).

export type NavLesson = { slug: string; title: string; level: number; sort: number };

export type PrevNext = {
  previous: { slug: string; title: string; number: string } | null;
  next: { slug: string; title: string; number: string } | { kind: "back-to-curriculum" };
};

export function compareLessons(a: NavLesson, b: NavLesson): number {
  return a.level - b.level || a.sort - b.sort;
}

/** Flat reading order of active lessons, with "level.position" numbers ("2.1"). */
export function orderLessons(lessons: readonly NavLesson[]): (NavLesson & { number: string })[] {
  const sorted = [...lessons].sort(compareLessons);
  const perLevel = new Map<number, number>();
  return sorted.map((l) => {
    const position = (perLevel.get(l.level) ?? 0) + 1;
    perLevel.set(l.level, position);
    return { ...l, number: `${l.level}.${position}` };
  });
}

/** Neighbours of `slug` in reading order; the last lesson links back to the curriculum. null if unknown. */
export function computePrevNext(lessons: readonly NavLesson[], slug: string): PrevNext | null {
  const ordered = orderLessons(lessons);
  const i = ordered.findIndex((l) => l.slug === slug);
  if (i === -1) return null;
  const prev = ordered[i - 1];
  const next = ordered[i + 1];
  return {
    previous: prev ? { slug: prev.slug, title: prev.title, number: prev.number } : null,
    next: next
      ? { slug: next.slug, title: next.title, number: next.number }
      : { kind: "back-to-curriculum" },
  };
}
