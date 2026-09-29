import type { ZodError } from "zod";
import { lessonFrontmatterSchema } from "../../../src/lib/contracts";
import type { SeedIssue } from "./issues";
import { isRealDate, manilaDate, normalizeText, sha256 } from "./text";
import { parseYamlSafe } from "./yaml";

/** Lesson frontmatter. `exercise` is optional here: not every lesson has an exercise (PRD S-1 fixtures). */
const frontmatterSchema = lessonFrontmatterSchema.partial({ exercise: true });

const KNOWN_KEYS = new Set(Object.keys(lessonFrontmatterSchema.shape));
const SEMVER = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

export type SectionKey = "concept" | "claude" | "codex";
const HEADINGS: Record<string, SectionKey> = {
  Concept: "concept",
  "Claude Code": "claude",
  "Codex CLI": "codex",
};
const HEADING_TEXT: Record<SectionKey, string> = { concept: "Concept", claude: "Claude Code", codex: "Codex CLI" };

export interface ParsedLesson {
  file: string;
  slug: string;
  levelNumber: number;
  sort: number;
  title: string;
  objective: string;
  est_minutes: number;
  concept_md: string;
  claude_md: string | null;
  codex_md: string | null;
  claude_no_equivalent: boolean;
  codex_no_equivalent: boolean;
  claude_workaround_md: string | null;
  codex_workaround_md: string | null;
  differences: string[];
  tool_versions: { claude_code: string; codex_cli: string };
  last_verified_on: string;
  content_hash: string;
  exerciseSlug: string | null;
  /** File lines used to point later cross-file errors at the right place. */
  lines: { slug: number; sort: number; exercise: number };
}

export interface LessonParseResult {
  value?: ParsedLesson;
  issues: SeedIssue[];
  warnings: SeedIssue[];
}

/** Split a markdown body into the three fixed sections. Headings are matched by text, outside code fences. */
export function parseSections(
  body: string,
  startLine: number,
  file = "",
): { sections: Partial<Record<SectionKey, string>>; issues: SeedIssue[]; warnings: SeedIssue[] } {
  const issues: SeedIssue[] = [];
  const warnings: SeedIssue[] = [];
  const buffers: Partial<Record<SectionKey, string[]>> = {};
  let current: SectionKey | null = null;
  let seenHeading = false;
  let fence: { char: string; len: number; lang: string } | null = null;

  const lines = body.split("\n");
  lines.forEach((line, i) => {
    const lineNo = startLine + i;
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})\s*([\w-]*)/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1] ?? "";
      if (!fence) {
        fence = { char: marker[0] ?? "`", len: marker.length, lang: (fenceMatch[2] ?? "").toLowerCase() };
      } else if (marker[0] === fence.char && marker.length >= fence.len && line.trim() === marker) {
        fence = null;
      }
    } else if (fence && /^(bash|sh|shell|zsh)$/.test(fence.lang) && /^\$ /.test(line)) {
      warnings.push({
        file,
        line: lineNo,
        field: "body",
        reason: "shell block line starts with a $ prompt; remove it so the copy button copies a runnable command",
      });
    }

    const heading = !fence ? /^## (.+?)\s*$/.exec(line) : null;
    if (heading) {
      seenHeading = true;
      const name = heading[1] ?? "";
      const key = HEADINGS[name];
      if (!key) {
        issues.push({
          file,
          line: lineNo,
          field: "body",
          reason: `unknown section '${name}' (allowed: ## Concept, ## Claude Code, ## Codex CLI)`,
        });
        current = null;
        return;
      }
      if (buffers[key]) {
        issues.push({ file, line: lineNo, field: "body", reason: `duplicate section '${name}'` });
        current = null;
        return;
      }
      buffers[key] = [];
      current = key;
      return;
    }
    if (current) buffers[current]?.push(line);
    else if (!seenHeading && line.trim() !== "") {
      issues.push({ file, line: lineNo, field: "body", reason: "text before the first ## section would be dropped" });
    }
  });

  const sections: Partial<Record<SectionKey, string>> = {};
  for (const key of Object.keys(buffers) as SectionKey[]) sections[key] = (buffers[key] ?? []).join("\n").trim();
  return { sections, issues, warnings };
}

function splitFrontmatter(text: string): { fm: string; body: string; bodyStartLine: number } | null {
  if (!text.startsWith("---\n")) return null;
  const lines = text.split("\n");
  const end = lines.findIndex((l, i) => i > 0 && l.trimEnd() === "---");
  if (end === -1) return null;
  return { fm: lines.slice(1, end).join("\n"), body: lines.slice(end + 1).join("\n"), bodyStartLine: end + 2 };
}

function zodToIssues(error: ZodError, file: string, lineOf: (p: (string | number)[]) => number): SeedIssue[] {
  return error.issues.map((i) => {
    const path = i.path.filter((p): p is string | number => typeof p !== "symbol");
    return { file, line: lineOf(path), field: path.join(".") || "frontmatter", reason: i.message };
  });
}

export function parseLessonFile(raw: string, file: string, opts: { now: Date }): LessonParseResult {
  const text = normalizeText(raw);
  const issues: SeedIssue[] = [];
  const warnings: SeedIssue[] = [];

  const parts = splitFrontmatter(text);
  if (!parts) {
    return {
      issues: [{ file, line: 1, field: "frontmatter", reason: "file must start with a --- YAML frontmatter block closed by ---" }],
      warnings,
    };
  }

  const yaml = parseYamlSafe(parts.fm, 2);
  if (yaml.errors.length > 0) {
    return {
      issues: yaml.errors.map((e) => ({ file, line: e.line, field: "frontmatter", reason: e.message })),
      warnings,
    };
  }
  if (typeof yaml.data !== "object" || yaml.data === null || Array.isArray(yaml.data)) {
    return { issues: [{ file, line: 2, field: "frontmatter", reason: "frontmatter must be a YAML mapping" }], warnings };
  }

  for (const key of Object.keys(yaml.data)) {
    if (!KNOWN_KEYS.has(key)) {
      warnings.push({ file, line: yaml.lineOf([key]), field: key, reason: "unknown frontmatter key (ignored)" });
    }
  }

  const parsed = frontmatterSchema.safeParse(yaml.data);
  if (!parsed.success) {
    issues.push(...zodToIssues(parsed.error, file, yaml.lineOf));
  }
  const fm = parsed.success ? parsed.data : null;

  if (fm) {
    if (fm.slug.length > 100) {
      issues.push({ file, line: yaml.lineOf(["slug"]), field: "slug", reason: "slug is longer than 100 characters" });
    }
    if (!isRealDate(fm.last_verified_on)) {
      issues.push({ file, line: yaml.lineOf(["last_verified_on"]), field: "last_verified_on", reason: "not a real calendar date" });
    } else if (fm.last_verified_on > manilaDate(opts.now)) {
      issues.push({ file, line: yaml.lineOf(["last_verified_on"]), field: "last_verified_on", reason: "date is in the future" });
    }
    for (const tool of ["claude_code", "codex_cli"] as const) {
      if (!SEMVER.test(fm.tool_versions[tool])) {
        issues.push({
          file,
          line: yaml.lineOf(["tool_versions", tool]),
          field: `tool_versions.${tool}`,
          reason: `'${fm.tool_versions[tool]}' is not a semver version like 2.1.0`,
        });
      }
    }
    const folder = /(?:^|\/)lessons\/([^/]+)\/[^/]+$/.exec(file)?.[1];
    if (folder !== undefined && folder !== `l${fm.level}`) {
      issues.push({
        file,
        line: yaml.lineOf(["level"]),
        field: "level",
        reason: `folder '${folder}' does not match frontmatter level ${fm.level} (expected folder 'l${fm.level}')`,
      });
    }
  }

  const { sections, issues: sectionIssues, warnings: sectionWarnings } = parseSections(parts.body, parts.bodyStartLine, file);
  issues.push(...sectionIssues);
  warnings.push(...sectionWarnings);

  if (fm) {
    if (!sections.concept) {
      issues.push({ file, line: parts.bodyStartLine, field: "body", reason: "missing ## Concept section" });
    }
    if (fm.claude_no_equivalent && fm.codex_no_equivalent) {
      issues.push({
        file,
        line: yaml.lineOf(["claude_no_equivalent"]),
        field: "claude_no_equivalent",
        reason: "both tools are marked no-equivalent: a lesson must teach at least one tool (no tool at all)",
      });
    }
    for (const [tool, key, flag] of [
      ["claude", "claude_no_equivalent", fm.claude_no_equivalent],
      ["codex", "codex_no_equivalent", fm.codex_no_equivalent],
    ] as const) {
      const body = sections[tool];
      if (!body) {
        issues.push(
          flag
            ? {
                file,
                line: yaml.lineOf([key]),
                field: key,
                reason: `no-equivalent marker needs workaround text under ## ${HEADING_TEXT[tool]}`,
              }
            : {
                file,
                line: parts.bodyStartLine,
                field: "body",
                reason: `missing ## ${HEADING_TEXT[tool]} section and no no-equivalent marker (set ${key}: true with a workaround, or write the section)`,
              },
        );
      }
    }
  }

  if (!fm || issues.length > 0) return { issues, warnings };

  const claudeBody = sections.claude ?? "";
  const codexBody = sections.codex ?? "";
  const value: ParsedLesson = {
    file,
    slug: fm.slug,
    levelNumber: fm.level,
    sort: fm.sort,
    title: fm.title.normalize("NFC"),
    objective: fm.objective.normalize("NFC"),
    est_minutes: fm.est_minutes,
    concept_md: sections.concept ?? "",
    claude_md: fm.claude_no_equivalent ? null : claudeBody,
    codex_md: fm.codex_no_equivalent ? null : codexBody,
    claude_no_equivalent: fm.claude_no_equivalent,
    codex_no_equivalent: fm.codex_no_equivalent,
    claude_workaround_md: fm.claude_no_equivalent ? claudeBody : null,
    codex_workaround_md: fm.codex_no_equivalent ? codexBody : null,
    differences: fm.differences,
    tool_versions: fm.tool_versions,
    last_verified_on: fm.last_verified_on,
    content_hash: "",
    exerciseSlug: fm.exercise ?? null,
    lines: { slug: yaml.lineOf(["slug"]), sort: yaml.lineOf(["sort"]), exercise: yaml.lineOf(["exercise"]) },
  };
  value.content_hash = hashLesson(value);
  return { value, issues, warnings };
}

/** Hash of every seeded content field (not the file path, not the exercise link), so unchanged lessons are skipped. */
export function hashLesson(l: ParsedLesson): string {
  return sha256(
    JSON.stringify([
      l.slug,
      l.levelNumber,
      l.sort,
      l.title,
      l.objective,
      l.est_minutes,
      l.concept_md,
      l.claude_md,
      l.codex_md,
      l.claude_no_equivalent,
      l.codex_no_equivalent,
      l.claude_workaround_md,
      l.codex_workaround_md,
      l.differences,
      [l.tool_versions.claude_code, l.tool_versions.codex_cli],
      l.last_verified_on,
    ]),
  );
}
