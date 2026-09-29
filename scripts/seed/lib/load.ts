import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { ZodError } from "zod";
import { levelsFileSchema } from "../../../src/lib/contracts";
import { parseExerciseDir, type ParsedExercise } from "./exercise";
import type { SeedIssue } from "./issues";
import { parseLessonFile, type ParsedLesson } from "./lesson";
import { normalizeText } from "./text";
import { parseYamlSafe } from "./yaml";

export interface LevelPayload {
  number: number;
  slug: string;
  title: string;
  summary: string;
  sort: number;
}

export type ExercisePayload = ParsedExercise & { lessonSlug: string };

export interface LoadedContent {
  levels: LevelPayload[];
  lessons: ParsedLesson[];
  exercises: ExercisePayload[];
  issues: SeedIssue[];
  warnings: SeedIssue[];
}

export interface LoadOptions {
  contentDir: string;
  exercisesDir: string;
  now: Date;
}

function isDir(p: string): boolean {
  return existsSync(p) && statSync(p).isDirectory();
}

function sortedEntries(dir: string): string[] {
  return readdirSync(dir).sort();
}

/** Display path relative to the directory that contains `root` (so a sandbox `content/` prints as content/...). */
function display(root: string, ...rest: string[]): string {
  return [path.basename(root), ...rest].join("/");
}

function zodIssues(error: ZodError, file: string, lineOf: (p: (string | number)[]) => number): SeedIssue[] {
  return error.issues.map((i) => {
    const p = i.path.filter((x): x is string | number => typeof x !== "symbol");
    return { file, line: lineOf(p), field: p.join(".") || "levels", reason: i.message };
  });
}

/**
 * Read and validate content/ and exercises/. Never touches the database and tolerates missing directories.
 * Every fault is collected so an author sees them all at once.
 */
export function loadContent(opts: LoadOptions): LoadedContent {
  const issues: SeedIssue[] = [];
  const warnings: SeedIssue[] = [];

  // ---- levels.yaml
  const levels: LevelPayload[] = [];
  const levelsRel = display(opts.contentDir, "levels.yaml");
  const levelsPath = path.join(opts.contentDir, "levels.yaml");
  if (existsSync(levelsPath)) {
    const y = parseYamlSafe(normalizeText(readFileSync(levelsPath, "utf8")), 1);
    if (y.errors.length > 0) {
      for (const e of y.errors) issues.push({ file: levelsRel, line: e.line, field: "levels", reason: e.message });
    } else {
      const parsed = levelsFileSchema.safeParse(y.data);
      if (!parsed.success) {
        issues.push(...zodIssues(parsed.error, levelsRel, y.lineOf));
      } else {
        const seenNum = new Set<number>();
        const seenSlug = new Set<string>();
        parsed.data.levels.forEach((l, idx) => {
          if (seenNum.has(l.number) || seenSlug.has(l.slug)) {
            issues.push({ file: levelsRel, line: y.lineOf(["levels", idx]), field: "levels", reason: `duplicate level number ${l.number} or slug '${l.slug}'` });
            return;
          }
          seenNum.add(l.number);
          seenSlug.add(l.slug);
          levels.push({ number: l.number, slug: l.slug, title: l.title.normalize("NFC"), summary: l.summary.normalize("NFC"), sort: l.number });
        });
      }
    }
  }

  // ---- lessons
  const lessons: ParsedLesson[] = [];
  const lessonsRoot = path.join(opts.contentDir, "lessons");
  if (isDir(lessonsRoot)) {
    for (const folder of sortedEntries(lessonsRoot)) {
      const folderPath = path.join(lessonsRoot, folder);
      if (!isDir(folderPath)) continue;
      for (const name of sortedEntries(folderPath)) {
        if (!name.endsWith(".md")) continue;
        const rel = display(opts.contentDir, "lessons", folder, name);
        const r = parseLessonFile(readFileSync(path.join(folderPath, name), "utf8"), rel, { now: opts.now });
        issues.push(...r.issues);
        warnings.push(...r.warnings);
        if (r.value) lessons.push(r.value);
      }
    }
  }

  const levelNumbers = new Set(levels.map((l) => l.number));
  const bySlug = new Map<string, ParsedLesson>();
  const bySort = new Map<string, ParsedLesson>();
  const validLessons: ParsedLesson[] = [];
  for (const l of lessons) {
    let ok = true;
    const dupSlug = bySlug.get(l.slug);
    if (dupSlug) {
      issues.push({ file: l.file, line: l.lines.slug, field: "slug", reason: `duplicate slug '${l.slug}' also defined in ${dupSlug.file}` });
      ok = false;
    } else {
      bySlug.set(l.slug, l);
    }
    const sortKey = `${l.levelNumber}:${l.sort}`;
    const dupSort = bySort.get(sortKey);
    if (dupSort) {
      issues.push({ file: l.file, line: l.lines.sort, field: "sort", reason: `duplicate sort ${l.sort} in level ${l.levelNumber} also used by ${dupSort.file}` });
      ok = false;
    } else {
      bySort.set(sortKey, l);
    }
    if (!levelNumbers.has(l.levelNumber)) {
      issues.push({ file: l.file, line: l.lines.slug, field: "level", reason: `no level ${l.levelNumber} in ${levelsRel}` });
      ok = false;
    }
    if (ok) validLessons.push(l);
  }

  // ---- exercises
  const exercises = new Map<string, ParsedExercise>();
  if (isDir(opts.exercisesDir)) {
    for (const folder of sortedEntries(opts.exercisesDir)) {
      const dirAbs = path.join(opts.exercisesDir, folder);
      if (!isDir(dirAbs) || folder.startsWith(".")) continue;
      const r = parseExerciseDir(dirAbs, display(opts.exercisesDir, folder));
      issues.push(...r.issues);
      if (r.value) exercises.set(folder, r.value);
      else if (r.issues.some((i) => i.field === "slug")) exercises.set(folder, { slug: folder } as ParsedExercise);
    }
  }

  // ---- lesson <-> exercise links
  const linked = new Map<string, ParsedLesson>();
  const exercisePayloads: ExercisePayload[] = [];
  for (const l of lessons) {
    if (!l.exerciseSlug) continue;
    if (!exercises.has(l.exerciseSlug)) {
      issues.push({ file: l.file, line: l.lines.exercise, field: "exercise", reason: `unknown exercise '${l.exerciseSlug}' (no ${display(opts.exercisesDir, l.exerciseSlug, "exercise.json")})` });
      continue;
    }
    const other = linked.get(l.exerciseSlug);
    if (other) {
      issues.push({ file: l.file, line: l.lines.exercise, field: "exercise", reason: `exercise already linked to ${other.slug} (${other.file}); each exercise belongs to one lesson` });
      continue;
    }
    linked.set(l.exerciseSlug, l);
  }
  for (const [slug, ex] of exercises) {
    const lesson = linked.get(slug);
    if (!lesson) {
      warnings.push({ file: display(opts.exercisesDir, slug, "exercise.json"), field: "exercise", reason: "no lesson references this exercise; it will not be seeded" });
      continue;
    }
    if (ex.title !== undefined) exercisePayloads.push({ ...ex, lessonSlug: lesson.slug });
  }

  return { levels, lessons: validLessons, exercises: exercisePayloads, issues, warnings };
}
