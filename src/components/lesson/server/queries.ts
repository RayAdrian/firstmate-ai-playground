import "server-only";
import { cache } from "react";
import { lessonTldrSchema, type ExerciseRow, type LessonRow, type LessonTldr, type LevelRow } from "@/lib/contracts";
import { dbRead } from "@/lib/db";
import { getReadClient } from "@/lib/db/server";
import { getNow, manilaDate } from "@/lib/time/now";
import { orderLessons } from "../navigation";
import { applyRouteHooks } from "./test-hooks";

/**
 * A stored `tldr` that fails the contract is read as null and logged with the slug (PRD §19, TL-3), so a bad row
 * costs one lesson its card and never its page.
 */
export function parseStoredTldr(slug: string, raw: unknown): LessonTldr | null {
  if (raw === null || raw === undefined) return null;
  const parsed = lessonTldrSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  console.error(`[lessons] ignoring invalid tldr for ${slug}: ${parsed.error.issues[0]?.message ?? "invalid"}`);
  return null;
}

export type CurriculumLesson = Pick<
  LessonRow,
  "id" | "level_id" | "slug" | "sort" | "title" | "objective" | "est_minutes" | "tool_versions" | "last_verified_on"
> & { number: string; tldr: LessonTldr | null };

export type CurriculumLevel = Pick<LevelRow, "id" | "number" | "slug" | "title" | "summary"> & {
  lessons: CurriculumLesson[];
};

export type Curriculum = { levels: CurriculumLevel[]; today: string };

const LESSON_LIST_COLUMNS =
  "id, level_id, slug, sort, title, objective, est_minutes, tool_versions, last_verified_on, tldr";

/** Active levels with their active lessons, in reading order. Archived rows never appear (C-1.3). */
export const getCurriculum = cache(async (): Promise<Curriculum> => {
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
        .map((l) => ({ ...l, tldr: parseStoredTldr(l.slug, l.tldr), number: numberBySlug.get(l.slug) ?? "" })),
    })),
  };
});

/**
 * Cheap existence check for the lesson layout: one indexed row, no body. It runs above the loading.tsx
 * boundary (a real 404 needs it), so it must stay light or the skeleton never gets a chance to show.
 */
export const lessonExists = cache(async (slug: string): Promise<boolean> => {
  const db = getReadClient();
  const lesson = await dbRead<{ level_id: string } | null>(
    db.from("lessons").select("level_id").eq("slug", slug).is("archived_at", null).maybeSingle(),
  );
  if (!lesson) return false;
  // A lesson under an archived level is not in the curriculum either (getCurriculum drops it), so it must 404 too.
  const level = await dbRead<{ id: string } | null>(
    db.from("levels").select("id").eq("id", lesson.level_id).is("archived_at", null).maybeSingle(),
  );
  return level !== null;
});

export type LessonPageData = {
  lesson: LessonRow;
  level: CurriculumLevel;
  number: string;
  /** The lesson's TL;DR, or null when absent or invalid (TL-3). */
  tldr: LessonTldr | null;
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
    tldr: level.lessons.find((l) => l.slug === slug)?.tldr ?? null,
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
  repoPath: string;
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
        .select("slug, title, lesson_id, verify_cmd, repo_path, checklist")
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
          repoPath: ex.repo_path,
          itemIds: ex.checklist.map((c) => c.id),
        });
      }
    }
  }
  return items;
});
