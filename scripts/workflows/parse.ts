// Parse and validate one workflow file (PRD §16.6). Pure: no file or database access. `workflows:validate` and
// `npm run seed` both call `parseWorkflowFile`, so they cannot disagree (WF-2).
import path from "node:path";
import type { ZodError } from "zod";
import {
  WORKFLOW_LIMITS,
  WORKFLOW_MAX_BYTES,
  WORKFLOW_SECTIONS,
  WORKFLOW_SETUP_KINDS,
  buildWorkflowFrontmatterSchema,
  workflowSetupBlockSchema,
  workflowSlugSchema,
  type WorkflowPrompt,
  type WorkflowSection,
  type WorkflowSetupBlock,
  type WorkflowSetupKind,
  type WorkflowTool,
  type WorkflowValidationContext,
} from "../../src/lib/contracts";
import type { SeedIssue } from "../seed/lib/issues";
import { isRealDate, normalizeText, sha256 } from "../seed/lib/text";
import { parseYamlSafe } from "../seed/lib/yaml";

export interface ParsedWorkflow {
  file: string;
  slug: string;
  title: string;
  problem: string;
  tools: WorkflowTool[];
  use_cases: string[];
  stacks: string[];
  related_lesson_slug: string | null;
  tool_versions: { claude_code?: string; codex_cli?: string };
  verified_on: string;
  setup: WorkflowSetupBlock[];
  setup_kinds: WorkflowSetupKind[];
  prompt: WorkflowPrompt;
  result_before: string;
  result_after: string;
  steps: string[];
  why_md: string;
  /** sha-256 of the LF-normalised file text: equal to `git show <rev>:<path> | shasum -a 256` for an LF-committed file (WF-43). */
  content_hash: string;
}

export interface WorkflowParseResult {
  value?: ParsedWorkflow;
  issues: SeedIssue[];
  warnings: SeedIssue[];
}

export interface ParseOptions {
  /** Draft stage only (W3's `share draft`): a missing `client_safe` is not an error. A wrong value still is. */
  excuseClientSafe?: boolean;
}

const KNOWN_KEYS = new Set(["title", "problem", "tools", "use_cases", "stacks", "related_lesson", "tool_versions", "verified_on", "client_safe", "author"]);
const SETUP_ATTRS = new Set(["path", "kind", "tool"]);
const PROMPT_HEADINGS: Record<string, WorkflowTool> = { "Claude Code": "claude-code", "Codex CLI": "codex" };

const RISKY: { re: RegExp; what: string }[] = [
  { re: /--dangerously-skip-permissions/, what: "--dangerously-skip-permissions" },
  { re: /--yolo\b/, what: "--yolo" },
  { re: /danger-full-access/, what: "danger-full-access" },
  { re: /\bcurl\b[^\n|]*\|\s*(?:sudo\s+)?(?:ba|z|da)?sh\b/, what: "a curl pipe into a shell" },
];

// ---------------------------------------------------------------- line classification

interface Line {
  kind: "text" | "open" | "code" | "close";
  text: string;
  /** Info string of an opening fence. */
  info: string;
  /** 1-based file line. */
  no: number;
}

/** Mark each line as prose, a fence opener, fenced code, or a fence closer. A `##` inside a fence is code, not a heading. */
function classify(lines: string[], firstLine: number): { lines: Line[]; unclosed: number | null } {
  let fence: { char: string; len: number; line: number } | null = null;
  const out = lines.map((text, i): Line => {
    const no = firstLine + i;
    if (!fence) {
      const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(text);
      const marker = m?.[1];
      if (m && marker && !(marker.startsWith("`") && (m[2] ?? "").includes("`"))) {
        fence = { char: marker.charAt(0), len: marker.length, line: no };
        return { kind: "open", text, info: (m[2] ?? "").trim(), no };
      }
      return { kind: "text", text, info: "", no };
    }
    const m = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(text);
    const marker = m?.[1];
    if (marker && marker.charAt(0) === fence.char && marker.length >= fence.len) {
      fence = null;
      return { kind: "close", text, info: "", no };
    }
    return { kind: "code", text, info: "", no };
  });
  return { lines: out, unclosed: (fence as { line: number } | null)?.line ?? null };
}

interface Fenced {
  info: string;
  code: string;
  line: number;
}

function fences(lines: Line[]): Fenced[] {
  const out: Fenced[] = [];
  let cur: { info: string; code: string[]; line: number } | null = null;
  for (const l of lines) {
    if (l.kind === "open") cur = { info: l.info, code: [], line: l.no };
    else if (l.kind === "code" && cur) cur.code.push(l.text);
    else if (l.kind === "close" && cur) {
      out.push({ info: cur.info, code: cur.code.join("\n"), line: cur.line });
      cur = null;
    }
  }
  return out;
}

const proseOf = (lines: Line[]): string => lines.filter((l) => l.kind === "text").map((l) => l.text).join("\n").trim();
const textOf = (lines: Line[]): string => lines.map((l) => l.text).join("\n").trim();

interface Section {
  name: string;
  line: number;
  lines: Line[];
}

// ---------------------------------------------------------------- frontmatter

function splitFrontmatter(text: string): { fm: string; body: string; bodyStartLine: number } | null {
  if (!text.startsWith("---\n")) return null;
  const lines = text.split("\n");
  const end = lines.findIndex((l, i) => i > 0 && l.trimEnd() === "---");
  if (end === -1) return null;
  return { fm: lines.slice(1, end).join("\n"), body: lines.slice(end + 1).join("\n"), bodyStartLine: end + 2 };
}

function zodToIssues(error: ZodError, file: string, lineOf: (p: (string | number)[]) => number): SeedIssue[] {
  return error.issues.map((i) => {
    const p = i.path.filter((x): x is string | number => typeof x !== "symbol");
    return { file, line: lineOf(p), field: p.join(".") || "frontmatter", reason: i.message };
  });
}

// ---------------------------------------------------------------- body

function splitSections(lines: Line[], file: string, issues: SeedIssue[]): Map<WorkflowSection, Section> {
  const found = new Map<WorkflowSection, Section>();
  let current: Section | null = null;
  let seenHeading = false;
  let lastIndex = -1;
  for (const l of lines) {
    const heading = l.kind === "text" ? /^## (.+?)\s*$/.exec(l.text) : null;
    if (heading) {
      seenHeading = true;
      const name = heading[1] ?? "";
      const known = WORKFLOW_SECTIONS.find((s) => s === name);
      if (!known) {
        issues.push({ file, line: l.no, field: "body", reason: `unknown section '${name}' (allowed, in this order: ${WORKFLOW_SECTIONS.map((s) => `## ${s}`).join(", ")})` });
        current = null;
        continue;
      }
      if (found.has(known)) {
        issues.push({ file, line: l.no, field: "body", reason: `duplicate section '${name}'` });
        current = null;
        continue;
      }
      const index = WORKFLOW_SECTIONS.indexOf(known);
      if (index < lastIndex) {
        issues.push({ file, line: l.no, field: "body", reason: `section '${name}' is out of order (required order: ${WORKFLOW_SECTIONS.join(", ")})` });
      }
      lastIndex = Math.max(lastIndex, index);
      current = { name, line: l.no, lines: [] };
      found.set(known, current);
    } else if (current) {
      current.lines.push(l);
    } else if (!seenHeading && l.text.trim() !== "") {
      issues.push({ file, line: l.no, field: "body", reason: "text before the first ## section would be dropped" });
    }
  }
  return found;
}

/** Split a section into `### ` subsections (headings only count outside fences). `preface` is what comes before the first one. */
function subsections(lines: Line[]): { preface: Line[]; subs: { name: string; line: number; lines: Line[] }[] } {
  const preface: Line[] = [];
  const subs: { name: string; line: number; lines: Line[] }[] = [];
  for (const l of lines) {
    const h = l.kind === "text" ? /^### (.+?)\s*$/.exec(l.text) : null;
    if (h) subs.push({ name: h[1] ?? "", line: l.no, lines: [] });
    else (subs[subs.length - 1]?.lines ?? preface).push(l);
  }
  return { preface, subs };
}

function parseResult(sec: Section, file: string, issues: SeedIssue[]): { before: string; after: string } {
  const { preface, subs } = subsections(sec.lines);
  const bad = (line: number, reason: string) => issues.push({ file, line, field: "Result", reason });
  if (proseOf(preface) !== "") bad(sec.line, "put text under ### Before or ### After, not directly under ## Result");
  const out: Record<string, string> = {};
  for (const s of subs) {
    if (s.name !== "Before" && s.name !== "After") {
      bad(s.line, `unknown subsection '### ${s.name}' (allowed: ### Before, ### After)`);
      continue;
    }
    if (s.name in out) {
      bad(s.line, `duplicate subsection '### ${s.name}'`);
      continue;
    }
    const text = textOf(s.lines);
    const { min, max } = WORKFLOW_LIMITS.resultChars;
    if (text.length < min || text.length > max) bad(s.line, `### ${s.name} must be ${min}-${max} characters (it is ${text.length})`);
    out[s.name] = text;
  }
  for (const need of ["Before", "After"]) if (!(need in out)) bad(sec.line, `missing ### ${need} under ## Result`);
  return { before: out["Before"] ?? "", after: out["After"] ?? "" };
}

function parseSetup(sec: Section, file: string, tools: readonly string[] | null, issues: SeedIssue[]): WorkflowSetupBlock[] {
  const bad = (line: number, reason: string) => issues.push({ file, line, field: "Setup", reason });
  const blocks = fences(sec.lines);
  const { min, max } = WORKFLOW_LIMITS.setupBlocks;
  if (blocks.length > max) bad(sec.line, `at most ${max} setup blocks (found ${blocks.length})`);
  if (blocks.length === min && proseOf(sec.lines) === "") bad(sec.line, "with no setup blocks, say so in prose (for example: No setup files.)");

  const out: WorkflowSetupBlock[] = [];
  for (const b of blocks) {
    const tokens = b.info.split(/\s+/).filter(Boolean);
    const first = tokens[0];
    const lang = first && !first.includes("=") ? first : "";
    const attrs = new Map<string, string>();
    let ok = true;
    for (const t of tokens.slice(lang ? 1 : 0)) {
      const eq = t.indexOf("=");
      const key = eq === -1 ? t : t.slice(0, eq);
      if (eq === -1 || !SETUP_ATTRS.has(key)) {
        bad(b.line, `unknown setup attribute '${key}' (allowed: path=, kind=, tool=)`);
        ok = false;
      } else if (attrs.has(key)) {
        bad(b.line, `duplicate setup attribute '${key}'`);
        ok = false;
      } else attrs.set(key, t.slice(eq + 1));
    }
    if (!lang) {
      bad(b.line, "setup block needs a language, for example ```bash path=<path> kind=<kind>");
      ok = false;
    }
    if (!attrs.has("path")) {
      bad(b.line, "setup block needs path=<path>");
      ok = false;
    }
    if (!attrs.has("kind")) {
      bad(b.line, `setup block needs kind=<kind> (one of: ${WORKFLOW_SETUP_KINDS.join(", ")})`);
      ok = false;
    }
    if (!ok) continue;
    const parsed = workflowSetupBlockSchema.safeParse({ lang, path: attrs.get("path"), kind: attrs.get("kind"), tool: attrs.get("tool") ?? null, code: b.code });
    if (!parsed.success) {
      for (const i of parsed.error.issues) bad(b.line, `${i.path.map(String).join(".") || "block"}: ${i.message}`);
      continue;
    }
    if (parsed.data.tool && tools && !tools.includes(parsed.data.tool)) bad(b.line, `tool=${parsed.data.tool} but tools does not include ${parsed.data.tool}`);
    out.push(parsed.data);
  }
  return out;
}

function parsePrompt(sec: Section, file: string, tools: readonly string[] | null, issues: SeedIssue[]): WorkflowPrompt {
  const bad = (line: number, reason: string) => issues.push({ file, line, field: "Prompt", reason });
  const { preface, subs } = subsections(sec.lines);
  if (subs.length === 0) {
    if (fences(sec.lines).length === 0) bad(sec.line, "needs at least one fenced code block");
    return { shared: textOf(sec.lines) };
  }
  if (proseOf(preface) !== "" || fences(preface).length > 0) bad(sec.line, "use either one shared prompt or ### subsections, not both");
  const prompt: WorkflowPrompt = {};
  for (const s of subs) {
    const tool = PROMPT_HEADINGS[s.name];
    if (!tool) {
      bad(s.line, `unknown subsection '### ${s.name}' (allowed: ### Claude Code, ### Codex CLI)`);
      continue;
    }
    const key = tool === "claude-code" ? "claude" : "codex";
    if (prompt[key] !== undefined) {
      bad(s.line, `duplicate subsection '### ${s.name}'`);
      continue;
    }
    if (tools && !tools.includes(tool)) bad(s.line, `'### ${s.name}' but tools does not include ${tool}`);
    if (fences(s.lines).length === 0) bad(s.line, `'### ${s.name}' needs at least one fenced code block`);
    prompt[key] = textOf(s.lines);
  }
  if (tools) {
    for (const [tool, name, key] of [["claude-code", "Claude Code", "claude"], ["codex", "Codex CLI", "codex"]] as const) {
      if (tools.includes(tool) && prompt[key] === undefined) bad(sec.line, `tools includes ${tool} but there is no '### ${name}' prompt`);
    }
  }
  return prompt;
}

function parseSteps(sec: Section, file: string, issues: SeedIssue[]): string[] {
  const bad = (line: number, reason: string) => issues.push({ file, line, field: "Steps", reason });
  const items: string[][] = [];
  let strayReported = false;
  for (const l of sec.lines) {
    const start = l.kind === "text" ? /^(\d+)[.)]\s+(.*)$/.exec(l.text) : null;
    if (start) {
      items.push([start[2] ?? ""]);
      continue;
    }
    const cur = items[items.length - 1];
    if (l.kind === "text" && l.text.trim() === "") {
      if (cur) cur.push("");
      continue;
    }
    if (cur && (l.kind !== "text" || /^\s/.test(l.text))) {
      cur.push(l.text.replace(/^ {1,3}/, ""));
      continue;
    }
    if (!strayReported) bad(l.no, "must be one ordered list (1. 2. 3.) and nothing else");
    strayReported = true;
  }
  const steps = items.map((i) => i.join("\n").trim());
  const { min, max } = WORKFLOW_LIMITS.steps;
  if (steps.length < min || steps.length > max) bad(sec.line, `must have ${min}-${max} steps (found ${steps.length})`);
  if (steps.some((s) => s === "")) bad(sec.line, "a step is empty");
  return steps;
}

// ---------------------------------------------------------------- the file

export function parseWorkflowFile(raw: string, file: string, ctx: WorkflowValidationContext, opts: ParseOptions = {}): WorkflowParseResult {
  const issues: SeedIssue[] = [];
  const warnings: SeedIssue[] = [];
  const text = normalizeText(raw);

  const slug = path.basename(file, ".md");
  const slugCheck = workflowSlugSchema.safeParse(slug);
  if (!slugCheck.success) {
    issues.push({ file, line: 1, field: "slug", reason: `file name '${slug}' must be kebab-case (a-z, 0-9, -), at most 60 characters` });
  }
  if (Buffer.byteLength(raw, "utf8") > WORKFLOW_MAX_BYTES) {
    issues.push({ file, line: 1, field: "file", reason: `larger than ${WORKFLOW_MAX_BYTES / 1024} KB` });
  }

  const parts = splitFrontmatter(text);
  if (!parts) {
    return { issues: [...issues, { file, line: 1, field: "frontmatter", reason: "file must start with a --- YAML frontmatter block closed by ---" }], warnings };
  }
  const yaml = parseYamlSafe(parts.fm, 2);
  if (yaml.errors.length > 0) {
    return { issues: [...issues, ...yaml.errors.map((e) => ({ file, line: e.line, field: "frontmatter", reason: e.message }))], warnings };
  }
  if (typeof yaml.data !== "object" || yaml.data === null || Array.isArray(yaml.data)) {
    return { issues: [...issues, { file, line: 2, field: "frontmatter", reason: "frontmatter must be a YAML mapping" }], warnings };
  }
  for (const key of Object.keys(yaml.data)) {
    if (!KNOWN_KEYS.has(key)) warnings.push({ file, line: yaml.lineOf([key]), field: key, reason: "unknown frontmatter key (ignored)" });
  }

  const data: Record<string, unknown> = { ...yaml.data };
  if (opts.excuseClientSafe && !("client_safe" in data)) data["client_safe"] = "confirmed";
  const parsed = buildWorkflowFrontmatterSchema(ctx).safeParse(data);
  if (!parsed.success) issues.push(...zodToIssues(parsed.error, file, yaml.lineOf));
  const fm = parsed.success ? parsed.data : null;
  if (fm && !isRealDate(fm.verified_on)) {
    issues.push({ file, line: yaml.lineOf(["verified_on"]), field: "verified_on", reason: "not a real calendar date" });
  }

  // Body. The tool list may be unusable when the frontmatter failed; then the cross-checks against it are skipped.
  const toolsKnown = Array.isArray(data["tools"]) && data["tools"].every((t) => typeof t === "string") ? (data["tools"] as string[]) : null;
  const { lines: body, unclosed } = classify(parts.body.split("\n"), parts.bodyStartLine);
  if (unclosed !== null) issues.push({ file, line: unclosed, field: "body", reason: "code fence is never closed" });
  const sections = splitSections(body, file, issues);
  for (const name of WORKFLOW_SECTIONS) {
    if (!sections.has(name)) issues.push({ file, line: parts.bodyStartLine, field: name, reason: `missing ## ${name} section` });
  }

  const result = sections.get("Result");
  const setupSec = sections.get("Setup");
  const promptSec = sections.get("Prompt");
  const stepsSec = sections.get("Steps");
  const whySec = sections.get("Why it works");

  const r = result ? parseResult(result, file, issues) : { before: "", after: "" };
  const setup = setupSec ? parseSetup(setupSec, file, toolsKnown, issues) : [];
  const prompt = promptSec ? parsePrompt(promptSec, file, toolsKnown, issues) : {};
  const steps = stepsSec ? parseSteps(stepsSec, file, issues) : [];
  const why = whySec ? textOf(whySec.lines) : "";
  if (whySec) {
    const { min, max } = WORKFLOW_LIMITS.whyChars;
    if (why.length < min || why.length > max) {
      issues.push({ file, line: whySec.line, field: "Why it works", reason: `must be ${min}-${max} characters (it is ${why.length})` });
    }
  }

  // WF-3: a risky command in Setup or Prompt needs a `Warning:` line under Why it works.
  const codeToCheck = [...(setupSec ? fences(setupSec.lines) : []), ...(promptSec ? fences(promptSec.lines) : [])].map((f) => f.code).join("\n");
  const hasWarning = why.split("\n").some((l) => /^Warning:\s*\S/.test(l));
  if (!hasWarning) {
    for (const risky of RISKY) {
      if (risky.re.test(codeToCheck)) {
        issues.push({ file, line: whySec?.line ?? parts.bodyStartLine, field: "Why it works", reason: `a Setup or Prompt block uses ${risky.what}; add a line starting 'Warning:' that explains the risk` });
      }
    }
  }

  if (!fm || issues.length > 0) return { issues, warnings };

  const kindsPresent = new Set(setup.map((s) => s.kind));
  return {
    issues,
    warnings,
    value: {
      file,
      slug,
      title: fm.title.normalize("NFC"),
      problem: fm.problem.normalize("NFC"),
      tools: fm.tools,
      use_cases: fm.use_cases,
      stacks: fm.stacks,
      related_lesson_slug: fm.related_lesson ?? null,
      tool_versions: fm.tool_versions,
      verified_on: fm.verified_on,
      setup,
      setup_kinds: WORKFLOW_SETUP_KINDS.filter((k) => kindsPresent.has(k)),
      prompt,
      result_before: r.before,
      result_after: r.after,
      steps,
      why_md: why,
      content_hash: sha256(text),
    },
  };
}
