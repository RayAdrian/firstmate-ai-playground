/**
 * Pure helpers for the `workflows:share` CLI (PRD §16 WF-16): path denial, redaction, answers
 * schema, draft rendering, git plan. No I/O here, so every function is unit-testable.
 */
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import {
  WORKFLOW_SETUP_KINDS,
  WORKFLOW_TOOLS,
  WORKFLOWS_DIR,
  hasSentenceBreak,
  setupPathSchema,
  workflowSlugSchema,
} from "../../src/lib/contracts/workflow";

/* ---------------------------------------------------------------- denied paths */

export interface DeniedResult {
  denied: boolean;
  reason?: string;
}

/** Expand a leading `~` to `home` and resolve against `cwd`. */
export function resolveUserPath(p: string, cwd = process.cwd(), home = os.homedir()): string {
  const expanded = p === "~" ? home : p.startsWith("~/") ? path.join(home, p.slice(2)) : p;
  return path.resolve(cwd, expanded);
}

/**
 * Setup files are read only through `share read`; these are never readable (WF-16):
 * `.env*`, anything under ~/.ssh or ~/.aws, `*.pem`, `*.key`, and basenames containing
 * `secret` or `credential` (case-insensitive).
 */
export function isDeniedPath(p: string, opts: { cwd?: string; home?: string } = {}): DeniedResult {
  const home = opts.home ?? os.homedir();
  const abs = resolveUserPath(p, opts.cwd, home);
  const base = path.basename(abs);
  const lower = base.toLowerCase();
  if (lower.startsWith(".env")) return { denied: true, reason: "environment files (.env*) may hold secrets" };
  if (lower.endsWith(".pem")) return { denied: true, reason: "*.pem files are key material" };
  if (lower.endsWith(".key")) return { denied: true, reason: "*.key files are key material" };
  if (lower.includes("secret")) return { denied: true, reason: "file name contains 'secret'" };
  if (lower.includes("credential")) return { denied: true, reason: "file name contains 'credential'" };
  for (const dir of [".ssh", ".aws"]) {
    const root = path.join(home, dir);
    if (abs === root || abs.startsWith(root + path.sep)) {
      return { denied: true, reason: `anything under ~/${dir}/ is denied` };
    }
  }
  return { denied: false };
}

/* ------------------------------------------------------------------- redaction */

export interface Redaction {
  rule: "email" | "hostname" | "home-path" | "ipv4";
  from: string;
  to: string;
}

const ALLOWED_HOSTS = [
  "github.com",
  "npmjs.com",
  "example.com",
  "anthropic.com",
  "claude.com",
  "claude.ai",
  "openai.com",
  "nodejs.org",
];
// Only well-known TLDs, so file names like settings.json or README.md are never mistaken for hosts.
const HOST_TLDS = "com|net|org|io|dev|app|ai|co|internal|local|corp|lan|intranet|cloud|xyz|tech|cc|us|uk|ph";
const hostRe = new RegExp(`\\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+(?:${HOST_TLDS})\\b`, "gi");
const emailRe = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const homePathRe = /(?:\/Users|\/home)\/[^/\s"'`]+\//g;
const ipv4Re = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;

function hostAllowed(host: string): boolean {
  const h = host.toLowerCase();
  return ALLOWED_HOSTS.some((a) => h === a || h.endsWith("." + a));
}

/**
 * Deterministic redactions (WF-16), applied in this order: emails, home paths, IPv4, hostnames.
 * Every replacement is returned so the contributor sees what changed.
 */
export function redactText(input: string): { text: string; redactions: Redaction[] } {
  const redactions: Redaction[] = [];
  let text = input.replace(emailRe, (m) => {
    if (m.toLowerCase().endsWith("@example.com")) return m;
    redactions.push({ rule: "email", from: m, to: "user@example.com" });
    return "user@example.com";
  });
  text = text.replace(homePathRe, (m) => {
    redactions.push({ rule: "home-path", from: m, to: "~/" });
    return "~/";
  });
  text = text.replace(ipv4Re, (m) => {
    if (m.startsWith("203.0.113.")) return m;
    redactions.push({ rule: "ipv4", from: m, to: "203.0.113.10" });
    return "203.0.113.10";
  });
  text = text.replace(hostRe, (m) => {
    if (hostAllowed(m)) return m;
    redactions.push({ rule: "hostname", from: m, to: "example.com" });
    return "example.com";
  });
  return { text, redactions };
}

/* ------------------------------------------------------------- answers + draft */

const setupInput = z.object({
  lang: z.string().min(1),
  path: z.string().min(1),
  kind: z.enum(WORKFLOW_SETUP_KINDS),
  tool: z.enum(WORKFLOW_TOOLS).nullish(),
  code: z.string(),
});

/** The answers file for `draft --answers` (the three answers plus the model's proposal). */
export const answersSchema = z.object({
  answers: z.object({
    problem: z.string(),
    change: z.string(),
    files: z.array(z.string()),
  }),
  workflow: z.object({
    slug: workflowSlugSchema.optional(),
    title: z.string(),
    problem: z.string(),
    tools: z.array(z.enum(WORKFLOW_TOOLS)).min(1),
    use_cases: z.array(z.string()).min(1),
    stacks: z.array(z.string()).min(1),
    related_lesson: z.string().optional(),
    tool_versions: z.object({ claude_code: z.string().optional(), codex_cli: z.string().optional() }),
    verified_on: z.string(),
    before: z.string(),
    after: z.string(),
    setup: z.array(setupInput),
    prompt: z.object({ shared: z.string().optional(), claude: z.string().optional(), codex: z.string().optional() }),
    steps: z.array(z.string()),
    why: z.string(),
  }),
});
export type Answers = z.infer<typeof answersSchema>;
export type WorkflowDraft = Answers["workflow"];

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

/** Apply `redactText` to every free-text field of a draft. Returns the redacted draft and a report. */
export function redactDraft(d: WorkflowDraft): { draft: WorkflowDraft; redactions: (Redaction & { field: string })[] } {
  const all: (Redaction & { field: string })[] = [];
  const r = (field: string, s: string) => {
    const out = redactText(s);
    for (const x of out.redactions) all.push({ field, ...x });
    return out.text;
  };
  const draft: WorkflowDraft = {
    ...d,
    title: r("title", d.title),
    problem: r("problem", d.problem),
    before: r("before", d.before),
    after: r("after", d.after),
    why: r("why", d.why),
    steps: d.steps.map((s, i) => r(`steps[${i}]`, s)),
    setup: d.setup.map((b, i) => ({ ...b, path: r(`setup[${i}].path`, b.path), code: r(`setup[${i}].code`, b.code) })),
    prompt: {
      ...(d.prompt.shared !== undefined ? { shared: r("prompt.shared", d.prompt.shared) } : {}),
      ...(d.prompt.claude !== undefined ? { claude: r("prompt.claude", d.prompt.claude) } : {}),
      ...(d.prompt.codex !== undefined ? { codex: r("prompt.codex", d.prompt.codex) } : {}),
    },
  };
  return { draft, redactions: all };
}

function fence(code: string, info: string): string {
  const runs = code.match(/`{3,}/g) ?? [];
  const n = Math.max(3, ...runs.map((x) => x.length + 1));
  const ticks = "`".repeat(n);
  return `${ticks}${info}\n${code.replace(/\n$/, "")}\n${ticks}`;
}

/** Render the markdown file WITHOUT `client_safe` (only `confirm` writes it). */
export function renderDraft(d: WorkflowDraft): string {
  const q = JSON.stringify;
  const fm = [
    "---",
    `title: ${q(d.title)}`,
    `problem: ${q(d.problem)}`,
    `tools: ${q(d.tools)}`,
    `use_cases: ${q(d.use_cases)}`,
    `stacks: ${q(d.stacks)}`,
    ...(d.related_lesson ? [`related_lesson: ${q(d.related_lesson)}`] : []),
    "tool_versions:",
    ...(d.tool_versions.claude_code ? [`  claude_code: ${q(d.tool_versions.claude_code)}`] : []),
    ...(d.tool_versions.codex_cli ? [`  codex_cli: ${q(d.tool_versions.codex_cli)}`] : []),
    `verified_on: ${q(d.verified_on)}`,
    "---",
  ];
  const setup = d.setup.length
    ? d.setup
        .map((b) => fence(b.code, `${b.lang} path=${b.path} kind=${b.kind}${b.tool ? ` tool=${b.tool}` : ""}`))
        .join("\n\n")
    : "No setup files.";
  const p = d.prompt;
  let prompt: string;
  if (p.shared !== undefined) prompt = fence(p.shared, "text");
  else {
    const parts: string[] = [];
    if (p.claude !== undefined) parts.push(`### Claude Code\n\n${fence(p.claude, "text")}`);
    if (p.codex !== undefined) parts.push(`### Codex CLI\n\n${fence(p.codex, "text")}`);
    prompt = parts.join("\n\n");
  }
  const body = [
    "## Result",
    `### Before\n\n${d.before.trim()}`,
    `### After\n\n${d.after.trim()}`,
    `## Setup\n\n${setup}`,
    `## Prompt\n\n${prompt}`,
    `## Steps\n\n${d.steps.map((s, i) => `${i + 1}. ${s.trim()}`).join("\n")}`,
    `## Why it works\n\n${d.why.trim()}`,
  ];
  return `${fm.join("\n")}\n\n${body[0]}\n\n${body[1]}\n\n${body[2]}\n\n${body.slice(3).join("\n\n")}\n`;
}

/** Cheap shape checks used before writing, so a bad answers file fails with a clear message. */
export function answersProblems(d: WorkflowDraft): string[] {
  const out: string[] = [];
  if (hasSentenceBreak(d.problem)) out.push("problem: must be one sentence");
  d.setup.forEach((b, i) => {
    const res = setupPathSchema.safeParse(b.path);
    if (!res.success) out.push(`setup[${i}].path: ${res.error.issues[0]?.message ?? "invalid"}`);
  });
  return out;
}

const FM_RE = /^---\n([\s\S]*?)\n---\n/;

/** Insert `client_safe: confirmed` as the last frontmatter line. Throws if already present. */
export function withClientSafe(content: string): string {
  const m = FM_RE.exec(content);
  if (!m) throw new Error("no frontmatter");
  if (/^client_safe:/m.test(m[1])) throw new Error("client_safe already present");
  return `---\n${m[1]}\nclient_safe: confirmed\n---\n${content.slice(m[0].length)}`;
}

export function hasClientSafeConfirmed(content: string): boolean {
  const m = FM_RE.exec(content);
  return !!m && /^client_safe: ["']?confirmed["']?\s*$/m.test(m[1]);
}

/** Read `title:` from frontmatter (the draft writes it JSON-quoted). */
export function readTitle(content: string): string | null {
  const m = FM_RE.exec(content);
  const t = m && /^title:\s*(.+)$/m.exec(m[1]);
  if (!t) return null;
  try {
    return JSON.parse(t[1]) as string;
  } catch {
    return t[1].replace(/^["']|["']$/g, "");
  }
}

/* -------------------------------------------------------------------- git plan */

export interface PlanStep {
  cmd: "git" | "gh";
  args: string[];
}

export const PR_BODY_FILE = ".github/PULL_REQUEST_TEMPLATE/workflow.md";

/** The exact commands `open-pr` runs, in order (WF-16). Executed with execFile, never a shell. */
export function buildGitPlan(slug: string, title: string): PlanStep[] {
  const file = `${WORKFLOWS_DIR}/${slug}.md`;
  return [
    { cmd: "git", args: ["switch", "-c", `workflow/${slug}`, "origin/main"] },
    { cmd: "git", args: ["add", "--", file] },
    { cmd: "git", args: ["commit", "-m", `workflow: ${title}`] },
    { cmd: "git", args: ["push", "-u", "origin", `workflow/${slug}`] },
    {
      cmd: "gh",
      args: ["pr", "create", "--title", `Workflow: ${title}`, "--body-file", PR_BODY_FILE, "--label", "workflow"],
    },
  ];
}

/** True if `url` is the canonical repo (https or ssh form, optional .git, case-insensitive). */
export function originMatches(url: string, repoUrl: string): boolean {
  const norm = (u: string) =>
    u
      .trim()
      .replace(/^git@github\.com:/i, "https://github.com/")
      .replace(/^ssh:\/\/git@github\.com\//i, "https://github.com/")
      .replace(/\.git$/i, "")
      .replace(/\/+$/, "")
      .toLowerCase();
  return norm(url) === norm(repoUrl);
}
