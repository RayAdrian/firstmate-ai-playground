import "server-only";
import { cache } from "react";
import type { ExerciseRow, LessonRow, LevelRow } from "@/lib/contracts";
import { dbRead } from "@/lib/db";
import { getReadClient } from "@/lib/db/server";
import { getNow, manilaDate } from "@/lib/time/now";
import { orderLessons } from "../navigation";
import { applyRouteHooks } from "./test-hooks";

export type CurriculumLesson = Pick<
  LessonRow,
  "id" | "level_id" | "slug" | "sort" | "title" | "objective" | "est_minutes" | "tool_versions" | "last_verified_on"
> & { number: string };

export type CurriculumLevel = Pick<LevelRow, "id" | "number" | "slug" | "title" | "summary"> & {
  lessons: CurriculumLesson[];
};

export type Curriculum = { levels: CurriculumLevel[]; today: string };

const LESSON_LIST_COLUMNS =
  "id, level_id, slug, sort, title, objective, est_minutes, tool_versions, last_verified_on";

/** Active levels with their active lessons, in reading order. Archived rows never appear (C-1.3). */
export const getCurriculum = cache(async (): Promise<Curriculum> => {
  await applyRouteHooks("curriculum");
  const db = getReadClient();
  const [levelRows, lessonRows, now] = await Promise.all([
    dbRead(db.from("levels").select("id, number, slug, title, summary").is("archived_at", null)),
    dbRead(db.from("lessons").select(LESSON_LIST_COLUMNS).is("archived_at", null)),
    getNow(),
  ]);
  const levels = [...levelRows].sort((a, b) => a.number - b.number);
  const levelById = new Map(levels.map((l) => [l.id, l]));
  const active = lessonRows.filter((l) => levelById.has(l.level_id));
  const numbered = orderLessons(
    active.map((l) => ({
      slug: l.slug,
      title: l.title,
      level: levelById.get(l.level_id)?.number ?? 0,
      sort: l.sort,
    })),
  );
  const numberBySlug = new Map(numbered.map((n) => [n.slug, n.number]));
  return {
    today: manilaDate(now),
    levels: levels.map((level) => ({
      ...level,
      lessons: active
        .filter((l) => l.level_id === level.id)
        .sort((a, b) => a.sort - b.sort)
        .map((l) => ({ ...l, number: numberBySlug.get(l.slug) ?? "" })),
    })),
  };
});

export type LessonPageData = {
  lesson: LessonRow;
  level: CurriculumLevel;
  number: string;
  exercise: ExerciseRow | null;
  navLessons: { slug: string; title: string; level: number; sort: number }[];
  today: string;
};

/** One active lesson with its level, exercise and reading order. null for unknown or archived slugs. */
export const getLessonPage = cache(async (slug: string): Promise<LessonPageData | null> => {
  const db = getReadClient();
  const lesson = await dbRead<LessonRow | null>(
    db.from("lessons").select("*").eq("slug", slug).is("archived_at", null).maybeSingle(),
  );
  if (!lesson) return null;
  const [curriculum, exercise] = await Promise.all([
    getCurriculum(),
    dbRead<ExerciseRow | null>(
      db.from("exercises").select("*").eq("lesson_id", lesson.id).is("archived_at", null).maybeSingle(),
    ),
  ]);
  const level = curriculum.levels.find((l) => l.id === lesson.level_id);
  if (!level) return null;
  return {
    lesson,
    level,
    number: level.lessons.find((l) => l.slug === slug)?.number ?? "",
    exercise,
    navLessons: curriculum.levels.flatMap((lv) =>
      lv.lessons.map((l) => ({ slug: l.slug, title: l.title, level: lv.number, sort: l.sort })),
    ),
    today: curriculum.today,
  };
});

export type ExerciseListItem = {
  slug: string;
  title: string;
  level: number;
  lessonSlug: string;
  lessonTitle: string;
  lessonNumber: string;
  automated: boolean;
  itemIds: string[];
};

/** Active exercises whose lesson is active, ordered by level then lesson (E-5). */
export const getExerciseList = cache(async (): Promise<ExerciseListItem[]> => {
  await applyRouteHooks("exercises");
  const [curriculum, rows] = await Promise.all([
    getCurriculum(),
    dbRead(
      getReadClient()
        .from("exercises")
        .select("slug, title, lesson_id, verify_cmd, checklist")
        .is("archived_at", null),
    ),
  ]);
  const items: ExerciseListItem[] = [];
  for (const level of curriculum.levels) {
    for (const lesson of level.lessons) {
      for (const ex of rows.filter((r) => r.lesson_id === lesson.id)) {
        items.push({
          slug: ex.slug,
          title: ex.title,
          level: level.number,
          lessonSlug: lesson.slug,
          lessonTitle: lesson.title,
          lessonNumber: lesson.number,
          automated: ex.verify_cmd !== null,
          itemIds: ex.checklist.map((c) => c.id),
        });
      }
    }
  }
  return items;
});
