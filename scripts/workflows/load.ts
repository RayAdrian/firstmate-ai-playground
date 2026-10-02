// Read content/workflows/ from disk: structure checks, taxonomy, lesson index, takedown list, then parse every file with the
// one shared parser (parse.ts). Both `workflows:validate` and `npm run seed` come through `loadWorkflows` (PRD §16.7 WF-2).
// Never touches the database.
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { WORKFLOWS_DIR, WORKFLOW_CONFIG_FILES, type WorkflowValidationContext } from "../../src/lib/contracts";
import { mediaManifestSchema } from "../../src/lib/contracts/media";
import type { SeedIssue } from "../seed/lib/issues";
import { manilaDate, normalizeText } from "../seed/lib/text";
import { parseYamlSafe } from "../seed/lib/yaml";
import { parseWorkflowFile, type ParsedWorkflow } from "./parse";

/** `<path>: <field>: <reason>`. This exact shape is what W3's share CLI parses from `workflows:validate`. */
export function formatWorkflowIssue(i: SeedIssue): string {
  return `${i.file}: ${i.field}: ${i.reason}`;
}

const IGNORED = new Set([".DS_Store"]);
/** Seed attribution override (PRD §16.8). Not in the frozen contract's WORKFLOW_CONFIG_FILES, so it is allowed here. */
export const SEED_AUTHORS_FILE = "_seed-authors.txt";
export const SEED_AUTHOR_NAME = "First Mate";
const CONFIG_FILES: readonly string[] = [...WORKFLOW_CONFIG_FILES, SEED_AUTHORS_FILE];
const isConfig = (name: string): boolean => CONFIG_FILES.includes(name);

function workflowsDirOf(contentDir: string): string {
  return path.join(contentDir, path.basename(WORKFLOWS_DIR));
}
/** Display path: `content/workflows/<name>` (the folder name of CONTENT_DIR is kept, so a sandbox prints the same way). */
function display(contentDir: string, name: string): string {
  return [path.basename(contentDir), path.basename(WORKFLOWS_DIR), name].join("/");
}

/** Absolute paths of the regular `*.md` workflow files (no `_` config files, no symlinks), sorted. */
export function listWorkflowFiles(contentDir: string): string[] {
  const dir = workflowsDirOf(contentDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .sort()
    .filter((n) => n.endsWith(".md") && !n.startsWith("_") && lstatSync(path.join(dir, n)).isFile())
    .map((n) => path.join(dir, n));
}

// ---------------------------------------------------------------- lessons

/** Slug to level number for every lesson file in content/lessons/l<n>/. A lesson that is not in the tree counts as archived. */
export function readLessonIndex(contentDir: string): Map<string, number> {
  const index = new Map<string, number>();
  const root = path.join(contentDir, "lessons");
  if (!existsSync(root)) return index;
  for (const folder of readdirSync(root).sort()) {
    const level = /^l(\d+)$/.exec(folder)?.[1];
    const dir = path.join(root, folder);
    if (!level || !lstatSync(dir).isDirectory()) continue;
    for (const name of readdirSync(dir).sort()) {
      if (!name.endsWith(".md")) continue;
      const text = normalizeText(readFileSync(path.join(dir, name), "utf8"));
      if (!text.startsWith("---\n")) continue;
      const end = text.split("\n").findIndex((l, i) => i > 0 && l.trimEnd() === "---");
      if (end === -1) continue;
      const y = parseYamlSafe(text.split("\n").slice(1, end).join("\n"), 2);
      const slug = typeof y.data === "object" && y.data !== null && "slug" in y.data ? y.data.slug : null;
      if (typeof slug === "string") index.set(slug, Number(level));
    }
  }
  return index;
}

// ---------------------------------------------------------------- media (for `watch`, PRD §17.3)

/**
 * Where lesson media lives for a content dir: `public/media/lessons` beside `content/`, else the repo's own (the fixture seed
 * runs in a temp content dir with no `public/`).
 */
export function mediaRootOf(contentDir: string): string {
  const beside = path.join(path.dirname(contentDir), "public", "media", "lessons");
  return existsSync(beside) ? beside : path.resolve(process.cwd(), "public", "media", "lessons");
}

/**
 * `<lesson-slug>/<media-id>` of every media manifest that passes the §15.2 contract (folder = lesson_slug, file = id) on a lesson
 * in `lessonSlugs`. A `watch` must be in this list; an invalid manifest or an unknown lesson is simply not resolvable.
 */
export function readMediaIds(mediaRoot: string, lessonSlugs: ReadonlySet<string>): string[] {
  const ids: string[] = [];
  if (!existsSync(mediaRoot)) return ids;
  for (const lesson of readdirSync(mediaRoot).sort()) {
    const dir = path.join(mediaRoot, lesson);
    if (!lessonSlugs.has(lesson) || !lstatSync(dir).isDirectory()) continue;
    for (const name of readdirSync(dir).sort()) {
      if (!name.endsWith(".media.json")) continue;
      try {
        const m = mediaManifestSchema.parse(JSON.parse(readFileSync(path.join(dir, name), "utf8")));
        // kind "tldr" belongs to the lesson TL;DR card, never to a `watch` link (PRD §19, TL-16)
        if (m.kind !== "tldr" && m.lesson_slug === lesson && name === `${m.id}.media.json`) ids.push(`${lesson}/${m.id}`);
      } catch {
        // an invalid manifest is not resolvable
      }
    }
  }
  return ids;
}

// ---------------------------------------------------------------- taxonomy

const taxonomyValue = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "expected a kebab-case value");
const taxonomySchema = z.object({
  use_cases: z.array(taxonomyValue).min(1),
  stacks: z.array(taxonomyValue).min(1),
});

function readTaxonomy(contentDir: string): { useCases: string[]; stacks: string[] } | { issues: SeedIssue[] } {
  const rel = display(contentDir, "_taxonomy.yaml");
  const file = path.join(workflowsDirOf(contentDir), "_taxonomy.yaml");
  if (!existsSync(file)) return { issues: [{ file: rel, field: "taxonomy", reason: "file is missing; it lists the allowed use_cases and stacks" }] };
  const y = parseYamlSafe(normalizeText(readFileSync(file, "utf8")), 1);
  if (y.errors.length > 0) return { issues: y.errors.map((e) => ({ file: rel, line: e.line, field: "taxonomy", reason: e.message })) };
  const parsed = taxonomySchema.safeParse(y.data);
  if (!parsed.success) {
    return {
      issues: parsed.error.issues.map((i) => {
        const p = i.path.filter((x): x is string | number => typeof x !== "symbol");
        return { file: rel, line: y.lineOf(p), field: `taxonomy.${p.join(".")}`.replace(/\.$/, ""), reason: i.message };
      }),
    };
  }
  return { useCases: parsed.data.use_cases, stacks: parsed.data.stacks };
}

// ---------------------------------------------------------------- takedowns

/** SHA-256 hashes listed in `_takedowns.txt` (WF-43): one per line, `#` comments and blank lines ignored. Bad lines warn. */
export function readTakedownHashes(contentDir: string): { hashes: Set<string>; warnings: string[] } {
  const hashes = new Set<string>();
  const warnings: string[] = [];
  const file = path.join(workflowsDirOf(contentDir), "_takedowns.txt");
  if (!existsSync(file)) return { hashes, warnings };
  normalizeText(readFileSync(file, "utf8"))
    .split("\n")
    .forEach((raw, i) => {
      const line = raw.trim();
      if (line === "" || line.startsWith("#")) return;
      if (/^[0-9a-fA-F]{64}$/.test(line)) hashes.add(line.toLowerCase());
      else warnings.push(`${display(contentDir, "_takedowns.txt")}:${i + 1}: not a sha-256 hash (64 hex characters); ignored`);
    });
  return { hashes, warnings };
}

// ---------------------------------------------------------------- seed authors

/**
 * Slugs listed in `_seed-authors.txt` (one per line, `#` comments and blank lines ignored). Each is credited to "First Mate"
 * instead of the git author. A slug with no matching workflow file is an issue. A missing file means no overrides.
 */
export function readSeedAuthors(contentDir: string, presentSlugs: Set<string>): { slugs: Set<string>; issues: SeedIssue[] } {
  const slugs = new Set<string>();
  const issues: SeedIssue[] = [];
  const file = path.join(workflowsDirOf(contentDir), SEED_AUTHORS_FILE);
  if (!existsSync(file) || !lstatSync(file).isFile()) return { slugs, issues };
  normalizeText(readFileSync(file, "utf8"))
    .split("\n")
    .forEach((raw, i) => {
      const line = raw.trim();
      if (line === "" || line.startsWith("#")) return;
      if (presentSlugs.has(line)) slugs.add(line);
      else issues.push({ file: display(contentDir, SEED_AUTHORS_FILE), line: i + 1, field: "seed-authors", reason: `unknown workflow slug '${line}'; no content/workflows/${line}.md` });
    });
  return { slugs, issues };
}

// ---------------------------------------------------------------- the whole folder

export interface WorkflowLoadOptions {
  contentDir: string;
  now: Date;
}

export interface LoadedWorkflows {
  workflows: ParsedWorkflow[];
  issues: SeedIssue[];
  warnings: SeedIssue[];
  /** Slugs of every `*.md` file in the folder, valid or not. A row whose slug is here is never marked removed. */
  presentSlugs: Set<string>;
  /** Lesson slug to level, for copying `level` at seed time. */
  levelBySlug: Map<string, number>;
  /** Slugs credited to SEED_AUTHOR_NAME by `_seed-authors.txt`. */
  seedAuthorSlugs: Set<string>;
}

export function loadWorkflows(opts: WorkflowLoadOptions): LoadedWorkflows {
  const { contentDir, now } = opts;
  const dir = workflowsDirOf(contentDir);
  const out: LoadedWorkflows = { workflows: [], issues: [], warnings: [], presentSlugs: new Set(), levelBySlug: new Map(), seedAuthorSlugs: new Set() };
  if (!existsSync(dir)) return out;

  const candidates: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (IGNORED.has(name)) continue;
    const rel = display(contentDir, name);
    const st = lstatSync(path.join(dir, name));
    const structure = (reason: string) => out.issues.push({ file: rel, field: "structure", reason });
    if (st.isSymbolicLink()) structure("symlinks are not allowed in content/workflows/");
    else if (st.isDirectory()) structure("subfolders are not allowed in content/workflows/");
    else if (!st.isFile()) structure("only regular files are allowed in content/workflows/");
    else if (name.startsWith("_")) {
      if (!isConfig(name)) structure(`'${name}' is not a known config file (allowed: ${CONFIG_FILES.join(", ")})`);
    } else if (name.endsWith(".md")) {
      candidates.push(name);
      out.presentSlugs.add(name.slice(0, -3));
    } else {
      structure(`only .md workflow files and ${CONFIG_FILES.join(", ")} are allowed in content/workflows/`);
    }
  }
  const seedAuthors = readSeedAuthors(contentDir, out.presentSlugs);
  out.seedAuthorSlugs = seedAuthors.slugs;
  out.issues.push(...seedAuthors.issues);
  if (candidates.length === 0) return out;

  const taxonomy = readTaxonomy(contentDir);
  if ("issues" in taxonomy) {
    out.issues.push(...taxonomy.issues);
    return out;
  }
  out.levelBySlug = readLessonIndex(contentDir);
  const ctx: WorkflowValidationContext = {
    useCases: taxonomy.useCases,
    stacks: taxonomy.stacks,
    lessonSlugs: [...out.levelBySlug.keys()],
    mediaIds: readMediaIds(mediaRootOf(contentDir), new Set(out.levelBySlug.keys())),
    today: manilaDate(now),
  };
  for (const name of candidates) {
    const r = parseWorkflowFile(readFileSync(path.join(dir, name), "utf8"), display(contentDir, name), ctx);
    out.issues.push(...r.issues);
    out.warnings.push(...r.warnings);
    if (r.value) out.workflows.push(r.value);
  }
  return out;
}

/** Validate explicit files (for example `_TEMPLATE.md`) with the same context as the folder. Paths are reported as given. */
export function validateWorkflowFiles(files: string[], opts: WorkflowLoadOptions): { issues: SeedIssue[]; warnings: SeedIssue[] } {
  const taxonomy = readTaxonomy(opts.contentDir);
  if ("issues" in taxonomy) return { issues: taxonomy.issues, warnings: [] };
  const lessons = readLessonIndex(opts.contentDir);
  const ctx: WorkflowValidationContext = { useCases: taxonomy.useCases, stacks: taxonomy.stacks, lessonSlugs: [...lessons.keys()], mediaIds: readMediaIds(mediaRootOf(opts.contentDir), new Set(lessons.keys())), today: manilaDate(opts.now) };
  const issues: SeedIssue[] = [];
  const warnings: SeedIssue[] = [];
  for (const f of files) {
    if (!existsSync(f)) {
      issues.push({ file: f, field: "file", reason: "no such file" });
      continue;
    }
    const r = parseWorkflowFile(readFileSync(f, "utf8"), f, ctx);
    issues.push(...r.issues);
    warnings.push(...r.warnings);
  }
  return { issues, warnings };
}
