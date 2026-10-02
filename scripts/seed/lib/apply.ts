import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../src/lib/db/types";
import type { LoadedContent } from "./load";
import { planUnique } from "./plan";

export interface ApplyCounts {
  inserted: number;
  updated: number;
  archived: number;
  restored: number;
}

export interface ApplyResult {
  levels: ApplyCounts;
  lessons: ApplyCounts;
  exercises: ApplyCounts;
}

type Db = SupabaseClient<Database>;

const zero = (): ApplyCounts => ({ inserted: 0, updated: 0, archived: 0, restored: 0 });

/** JSON with sorted object keys, so jsonb round-trips compare equal regardless of key order. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function fail(what: string, message: string): never {
  throw new Error(`database error while ${what}: ${message}`);
}

/**
 * Upsert content by slug, archive what disappeared, and clear archived_at on what came back.
 * Rows whose content is unchanged are not written, so a second run is a no-op (PRD S-2).
 *
 * PostgREST has no multi-statement transactions, so atomicity comes from validating and planning
 * everything BEFORE the first write (loadContent + planUnique reject unique-key conflicts up front).
 * Renamed levels/exercises are reused in place, and archived rows are moved off keys that live rows need.
 */
export async function applyContent(db: Db, content: LoadedContent, now: Date): Promise<ApplyResult> {
  const nowIso = now.toISOString();
  const result: ApplyResult = { levels: zero(), lessons: zero(), exercises: zero() };

  // ---- read everything, then plan everything BEFORE the first write
  const { data: existingLevels, error: levelsErr } = await db.from("levels").select("*");
  if (levelsErr) fail("reading levels", levelsErr.message);
  const { data: existingLessons, error: lessonsErr } = await db.from("lessons").select("id, slug, level_id, content_hash, archived_at");
  if (lessonsErr) fail("reading lessons", lessonsErr.message);
  const { data: existingExercises, error: exErr } = await db.from("exercises").select("*");
  if (exErr) fail("reading exercises", exErr.message);

  const levelPlan = planUnique(
    existingLevels.map((l) => ({ id: l.id, slug: l.slug, key: l.number, archived: l.archived_at !== null })),
    content.levels.map((l) => ({ slug: l.slug, key: l.number })),
    { reuseByKey: true, freeKeys: [1, 2, 3, 4, 5] },
  );
  if (levelPlan.error) throw new Error(`cannot apply levels: ${levelPlan.error}`);

  // A lesson that does not exist yet has no id; give it a placeholder key that cannot collide.
  const lessonIdBySlugNow = new Map(existingLessons.map((l) => [l.slug, l.id]));
  const lessonKey = (slug: string) => lessonIdBySlugNow.get(slug) ?? `pending:${slug}`;
  const exercisePlan = planUnique(
    existingExercises.map((e) => ({ id: e.id, slug: e.slug, key: e.lesson_id, archived: e.archived_at !== null })),
    content.exercises.map((e) => ({ slug: e.slug, key: lessonKey(e.lessonSlug) })),
    { reuseByKey: true },
  );
  if (exercisePlan.error) throw new Error(`cannot apply exercises: ${exercisePlan.error}`);

  // ---- levels
  const levelById = new Map(existingLevels.map((l) => [l.id, l]));
  const levelByWant = new Map(content.levels.map((l) => [l.slug, l]));
  for (const rel of levelPlan.releases) {
    const row = levelById.get(rel.id);
    const { error } = await db.from("levels").update({ number: rel.key, ...(row?.archived_at === null ? { archived_at: nowIso } : {}) }).eq("id", rel.id);
    if (error) fail("moving an archived level off its number", error.message);
    if (row?.archived_at === null) result.levels.archived++;
  }
  const archivedNow = new Set(levelPlan.releases.map((r) => r.id));
  for (const { want, id } of levelPlan.matched) {
    const l = levelByWant.get(want.slug);
    if (!l) continue;
    const payload = { number: l.number, slug: l.slug, title: l.title, summary: l.summary, sort: l.sort, archived_at: null };
    const row = id ? levelById.get(id) : undefined;
    if (!row) {
      const { error } = await db.from("levels").insert(payload);
      if (error) fail(`inserting level ${l.slug}`, error.message);
      result.levels.inserted++;
    } else if (row.slug !== l.slug || row.number !== l.number || row.title !== l.title || row.summary !== l.summary || row.sort !== l.sort || row.archived_at !== null) {
      const { error } = await db.from("levels").update(payload).eq("id", row.id);
      if (error) fail(`updating level ${l.slug}`, error.message);
      if (row.archived_at !== null) result.levels.restored++;
      else result.levels.updated++;
    }
  }
  for (const id of levelPlan.archive) {
    if (archivedNow.has(id)) continue;
    const { error } = await db.from("levels").update({ archived_at: nowIso }).eq("id", id);
    if (error) fail("archiving a level", error.message);
    result.levels.archived++;
  }

  const { data: levelsNow, error: levelsNowErr } = await db.from("levels").select("id, number");
  if (levelsNowErr) fail("reading levels", levelsNowErr.message);
  const levelIdByNumber = new Map(levelsNow.map((l) => [l.number, l.id]));

  // ---- lessons
  const lessonBySlug = new Map(existingLessons.map((l) => [l.slug, l]));
  const wantedLessonSlugs = new Set(content.lessons.map((l) => l.slug));

  for (const l of content.lessons) {
    const levelId = levelIdByNumber.get(l.levelNumber);
    if (!levelId) fail(`resolving level for lesson ${l.slug}`, `level ${l.levelNumber} is missing`);
    const row = lessonBySlug.get(l.slug);
    const payload = {
      level_id: levelId,
      slug: l.slug,
      sort: l.sort,
      title: l.title,
      objective: l.objective,
      est_minutes: l.est_minutes,
      concept_md: l.concept_md,
      claude_md: l.claude_md,
      codex_md: l.codex_md,
      claude_no_equivalent: l.claude_no_equivalent,
      codex_no_equivalent: l.codex_no_equivalent,
      claude_workaround_md: l.claude_workaround_md,
      codex_workaround_md: l.codex_workaround_md,
      differences: l.differences,
      tool_versions: l.tool_versions,
      tldr: l.tldr,
      last_verified_on: l.last_verified_on,
      content_hash: l.content_hash,
      archived_at: null,
      updated_at: nowIso,
    };
    if (!row) {
      const { error } = await db.from("lessons").insert(payload);
      if (error) fail(`inserting lesson ${l.slug}`, error.message);
      result.lessons.inserted++;
    } else if (row.content_hash !== l.content_hash || row.level_id !== levelId || row.archived_at !== null) {
      const { error } = await db.from("lessons").update(payload).eq("id", row.id);
      if (error) fail(`updating lesson ${l.slug}`, error.message);
      if (row.archived_at !== null) result.lessons.restored++;
      else result.lessons.updated++;
    }
  }
  for (const row of existingLessons) {
    if (!wantedLessonSlugs.has(row.slug) && row.archived_at === null) {
      const { error } = await db.from("lessons").update({ archived_at: nowIso, updated_at: nowIso }).eq("id", row.id);
      if (error) fail(`archiving lesson ${row.slug}`, error.message);
      result.lessons.archived++;
    }
  }

  const { data: lessonsNow, error: lessonsNowErr } = await db.from("lessons").select("id, slug");
  if (lessonsNowErr) fail("reading lessons", lessonsNowErr.message);
  const lessonIdBySlug = new Map(lessonsNow.map((l) => [l.slug, l.id]));

  // ---- exercises (matched rows are reused in place, so a lesson's unique exercise slot never collides)
  const exerciseById = new Map(existingExercises.map((e) => [e.id, e]));
  const exerciseByWant = new Map(content.exercises.map((e) => [e.slug, e]));
  for (const { want, id } of exercisePlan.matched) {
    const e = exerciseByWant.get(want.slug);
    if (!e) continue;
    const lessonId = lessonIdBySlug.get(e.lessonSlug);
    if (!lessonId) fail(`resolving lesson for exercise ${e.slug}`, `lesson ${e.lessonSlug} is missing`);
    const payload = {
      lesson_id: lessonId,
      slug: e.slug,
      title: e.title,
      goal: e.goal,
      repo_path: e.repo_path,
      setup_cmd: e.setup_cmd,
      verify_cmd: e.verify_cmd,
      starter_prompts: e.starter_prompts,
      checklist: e.checklist,
      solution_notes: e.solution_notes,
      archived_at: null,
    };
    const row = id ? exerciseById.get(id) : undefined;
    if (!row) {
      const { error } = await db.from("exercises").insert(payload);
      if (error) fail(`inserting exercise ${e.slug}`, error.message);
      result.exercises.inserted++;
    } else {
      const { id: rowId, ...current } = row;
      void rowId;
      if (stable({ ...current }) !== stable(payload)) {
        const { error } = await db.from("exercises").update(payload).eq("id", row.id);
        if (error) fail(`updating exercise ${e.slug}`, error.message);
        if (row.archived_at !== null) result.exercises.restored++;
        else result.exercises.updated++;
      }
    }
  }
  for (const id of exercisePlan.archive) {
    const { error } = await db.from("exercises").update({ archived_at: nowIso }).eq("id", id);
    if (error) fail("archiving an exercise", error.message);
    result.exercises.archived++;
  }

  return result;
}

export function sumCounts(r: ApplyResult): ApplyCounts {
  const total = zero();
  for (const c of [r.levels, r.lessons, r.exercises]) {
    total.inserted += c.inserted;
    total.updated += c.updated;
    total.archived += c.archived;
    total.restored += c.restored;
  }
  return total;
}
