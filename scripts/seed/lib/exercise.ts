import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { ChecklistItem } from "../../../src/lib/contracts";
import { exerciseJsonSchema } from "../../../src/lib/contracts";
import { parseChecklist } from "./checklist";
import type { SeedIssue } from "./issues";
import { normalizeText } from "./text";
import { parseYamlSafe } from "./yaml";

/** exercise.json is strict: an unknown key (e.g. a smuggled API-key requirement) is an error. */
const strictSchema = exerciseJsonSchema.strict();

export interface ParsedExercise {
  file: string;
  /** Folder name; equals the exercise.json slug when valid. */
  slug: string;
  title: string;
  goal: string;
  repo_path: string;
  setup_cmd: string;
  verify_cmd: string | null;
  starter_prompts: { claude?: string; codex?: string };
  checklist: ChecklistItem[];
  solution_notes: string[];
  required_tool_features: string[];
}

function isDir(p: string): boolean {
  return existsSync(p) && statSync(p).isDirectory();
}

function readmeSummary(readme: string): { title?: string; goal?: string } {
  const lines = normalizeText(readme).split("\n");
  const h = lines.findIndex((l) => /^# \S/.test(l));
  if (h === -1) return {};
  const title = (lines[h] ?? "").replace(/^# /, "").trim();
  const rest: string[] = [];
  for (const l of lines.slice(h + 1)) {
    if (l.trim() === "") {
      if (rest.length > 0) break;
      continue;
    }
    if (/^#{1,6} /.test(l)) break;
    rest.push(l.trim());
  }
  return { title, goal: rest.join(" ") || undefined };
}

/** Validate one exercises/<slug>/ directory. `dirRel` is the display path (e.g. exercises/ex-1-1-x). */
export function parseExerciseDir(dirAbs: string, dirRel: string): { value?: ParsedExercise; issues: SeedIssue[] } {
  const folder = path.basename(dirAbs);
  const issues: SeedIssue[] = [];
  const jsonRel = `${dirRel}/exercise.json`;

  for (const need of ["README.md", "CHECKLIST.md", "exercise.json"]) {
    if (!existsSync(path.join(dirAbs, need))) {
      issues.push({ file: `${dirRel}/${need}`, field: "files", reason: `missing ${need} (every exercise needs it, PRD E-4)` });
    }
  }
  for (const need of ["starter", "solution"]) {
    if (!isDir(path.join(dirAbs, need))) {
      issues.push({ file: `${dirRel}/${need}`, field: "files", reason: `missing ${need}/ directory (PRD E-4)` });
    }
  }

  const jsonPath = path.join(dirAbs, "exercise.json");
  if (!existsSync(jsonPath)) return { issues };

  const jsonText = normalizeText(readFileSync(jsonPath, "utf8"));
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid JSON";
    const line = /line (\d+)/.exec(message)?.[1];
    issues.push({ file: jsonRel, line: line ? Number(line) : undefined, field: "exercise.json", reason: `invalid JSON: ${message}` });
    return { issues };
  }
  const lineOf = parseYamlSafe(jsonText, 1).lineOf;

  const parsed = strictSchema.safeParse(raw);
  if (!parsed.success) {
    for (const i of parsed.error.issues) {
      const p = i.path.filter((x): x is string | number => typeof x !== "symbol");
      const keyPath = i.code === "unrecognized_keys" ? [] : p;
      issues.push({ file: jsonRel, line: lineOf(keyPath), field: p.join(".") || "exercise.json", reason: i.message });
    }
    return { issues };
  }
  const json = parsed.data;

  if (json.slug !== folder) {
    issues.push({ file: jsonRel, line: lineOf(["slug"]), field: "slug", reason: `slug '${json.slug}' does not match folder '${folder}'` });
  }
  if (json.verify !== "manual" && json.verify.trim().toLowerCase() === "manual") {
    issues.push({ file: jsonRel, line: lineOf(["verify"]), field: "verify", reason: `'${json.verify}' must be exactly "manual" (lowercase) for manual verification` });
  }

  const readmePath = path.join(dirAbs, "README.md");
  const summary = existsSync(readmePath) ? readmeSummary(readFileSync(readmePath, "utf8")) : {};
  const title = json.title ?? summary.title;
  if (!title) {
    issues.push({ file: jsonRel, field: "title", reason: "no title in exercise.json and README.md has no '# ' heading to derive it from" });
  }

  let checklist: ChecklistItem[] = [];
  const checklistPath = path.join(dirAbs, "CHECKLIST.md");
  if (existsSync(checklistPath)) {
    const c = parseChecklist(readFileSync(checklistPath, "utf8"), `${dirRel}/CHECKLIST.md`);
    checklist = c.items;
    issues.push(...c.issues);
  }

  if (issues.length > 0 || !title) return { issues };

  return {
    issues,
    value: {
      file: jsonRel,
      slug: folder,
      title,
      goal: json.goal ?? summary.goal ?? "",
      repo_path: `exercises/${folder}/starter`,
      setup_cmd: json.setup_cmd ?? `cp -r exercises/${folder}/starter ~/fm-ex/${folder} && cd ~/fm-ex/${folder} && npm i`,
      verify_cmd: json.verify === "manual" ? null : json.verify,
      starter_prompts: json.starter_prompts ?? {},
      checklist,
      solution_notes: json.solution_notes ?? [],
      required_tool_features: json.required_tool_features,
    },
  };
}
