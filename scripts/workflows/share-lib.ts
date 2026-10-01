/**
 * Pure helpers for the `workflows:share` CLI (PRD §16 WF-16): path denial, redaction, answers
 * schema, draft rendering, git plan. No I/O here, so every function is unit-testable.
 */
import fs from "node:fs";
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

/** Home-relative locations that hold credentials. Compared case-insensitively (APFS and NTFS are). */
const DENIED_HOME_DIRS = [".ssh", ".aws", ".gnupg", ".config/gh", ".docker", "library/keychains"];
const DENIED_HOME_FILES = [".codex/auth.json", ".npmrc", ".netrc", ".git-credentials", ".pgpass"];

const lc = (p: string) => p.toLowerCase();

/**
 * Setup files are read only through `share read`; these are never readable (WF-16 plus review B1):
 * `.env*`, `*.pem`, `*.key`, `id_*`, keychains, basenames containing `secret` or `credential`, and
 * credential locations under the home directory (~/.ssh, ~/.aws, ~/.gnupg, ~/.config/gh, ~/.docker,
 * ~/.claude/.credentials*, ~/.codex/auth.json, ~/.npmrc, ~/.netrc). All comparisons are case-insensitive.
 * Pass an already-realpath'd path (see `checkReadable`); `homes` may list extra spellings of the home dir.
 */
export function isDeniedPath(p: string, opts: { cwd?: string; home?: string; homes?: string[] } = {}): DeniedResult {
  const home = opts.home ?? os.homedir();
  const abs = resolveUserPath(p, opts.cwd, home);
  const lower = lc(path.basename(abs));
  if (lower.startsWith(".env")) return { denied: true, reason: "environment files (.env*) may hold secrets" };
  if (lower.endsWith(".pem")) return { denied: true, reason: "*.pem files are key material" };
  if (lower.endsWith(".key")) return { denied: true, reason: "*.key files are key material" };
  if (lower.startsWith("id_")) return { denied: true, reason: "id_* files are SSH keys" };
  if (lower.endsWith(".keychain") || lower.endsWith(".keychain-db")) return { denied: true, reason: "keychain files are denied" };
  if (lower.includes("secret")) return { denied: true, reason: "file name contains 'secret'" };
  if (lower.includes("credential")) return { denied: true, reason: "file name contains 'credential'" };
  const absLc = lc(abs);
  for (const h of [home, ...(opts.homes ?? [])]) {
    const hl = lc(h);
    const rel = absLc === hl ? "" : absLc.startsWith(hl + path.sep) ? absLc.slice(hl.length + 1).split(path.sep).join("/") : null;
    if (rel === null) continue;
    for (const d of DENIED_HOME_DIRS) {
      if (rel === d || rel.startsWith(d + "/")) return { denied: true, reason: `anything under ~/${d}/ is denied` };
    }
    for (const f of DENIED_HOME_FILES) {
      if (rel === f) return { denied: true, reason: `~/${f} holds credentials` };
    }
    if (rel.startsWith(".claude/.credentials")) return { denied: true, reason: "~/.claude/.credentials* holds credentials" };
  }
  return { denied: false };
}

/** Agent-config locations outside the repo that setup files may live in (allow rule). */
const ALLOWED_HOME_PREFIXES = [
  ".claude/skills",
  ".claude/agents",
  ".claude/commands",
  ".claude/hooks",
  ".claude/claude.md",
  ".claude/settings.json",
  ".agents/skills",
  ".codex/agents.md",
  ".codex/config.toml",
  ".codex/skills",
  ".codex/prompts",
];

export interface ReadableResult extends DeniedResult {
  real?: string;
}

/**
 * Decide whether `share read` may print `p`. Order: realpath first (follows symlinks, native on-disk case),
 * then the deny list on BOTH the requested and the resolved path, then the allow rule: the resolved file must
 * be inside `repoRoot` or one of the agent-config locations under home. `..` is normalised before any check.
 */
export function checkReadable(
  p: string,
  opts: { cwd: string; home: string; repoRoot: string },
  realpath: (x: string) => string = (x) => fs.realpathSync.native(x),
): ReadableResult {
  const requested = resolveUserPath(p, opts.cwd, opts.home);
  let real: string;
  try {
    real = realpath(requested);
  } catch {
    return { denied: true, reason: "not found" };
  }
  const safe = (x: string) => {
    try {
      return realpath(x);
    } catch {
      return x;
    }
  };
  const homes = [safe(opts.home)];
  const denyOpts = { cwd: opts.cwd, home: opts.home, homes };
  for (const candidate of [requested, real]) {
    const d = isDeniedPath(candidate, denyOpts);
    if (d.denied) return { ...d, real };
  }
  const realLc = lc(real);
  const roots = [safe(opts.repoRoot), opts.repoRoot].map(lc);
  if (roots.some((r) => realLc === r || realLc.startsWith(r + path.sep))) return { denied: false, real };
  for (const h of [opts.home, ...homes]) {
    const hl = lc(h);
    if (!realLc.startsWith(hl + path.sep)) continue;
    const rel = realLc.slice(hl.length + 1).split(path.sep).join("/");
    if (ALLOWED_HOME_PREFIXES.some((a) => rel === a || rel.startsWith(a + "/"))) return { denied: false, real };
  }
  return { denied: true, reason: "outside the repo and the agent-config locations (~/.claude, ~/.codex, ~/.agents)", real };
}

/* ------------------------------------------------------------------- redaction */

export interface Redaction {
  rule: "email" | "hostname" | "home-path" | "ipv4" | "ipv6";
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
  "socket.io",
  "vercel.com",
  "supabase.com",
  "nextjs.org",
  "react.dev",
  "vitest.dev",
  "playwright.dev",
  "tailwindcss.com",
  "typescriptlang.org",
  "python.org",
  "mozilla.org",
  "w3.org",
  "google.com",
  "microsoft.com",
  "stackoverflow.com",
];
// Only well-known TLDs, so file names like settings.json or README.md are never mistaken for hosts.
const HOST_TLDS =
  "com|net|org|io|dev|app|ai|co|internal|local|corp|lan|intranet|cloud|xyz|tech|cc|us|uk|ph|de|sg|nl|fr|jp|au|ca|in|eu|me|biz|info|test|home|private|intra|[a-z0-9-]+-internal";
// The lookahead keeps file names (settings.local.json, CLAUDE.local.md) from being read as hosts.
const hostRe = new RegExp(`\\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+(?:${HOST_TLDS})\\b(?![.\\w-]*\\w)`, "gi");
const emailRe = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const homePathRe = /(?:\/Users|\/home)\/[\w.-]+(\/?)/g;
const winHomeRe = /[A-Za-z]:\\Users\\[\w.-]+(\\?)/g;
const ipv4Re = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;
const ipv6Re = /\b(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}\b/gi;

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
  const home = (m: string, slash: string) => {
    const to = slash ? "~" + slash : "~";
    redactions.push({ rule: "home-path", from: m, to });
    return to;
  };
  text = text.replace(homePathRe, home).replace(winHomeRe, (m, slash: string) => home(m, slash));
  text = text.replace(ipv6Re, (m) => {
    redactions.push({ rule: "ipv6", from: m, to: "2001:db8::1" });
    return "2001:db8::1";
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

/** Newlines and other control characters (they would reach the PR title, commit message or frontmatter). */
export const hasControlChars = (s: string) => /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(s);

/** Cheap shape checks used before writing, so a bad answers file fails with a clear message. */
export function answersProblems(d: WorkflowDraft): string[] {
  const out: string[] = [];
  if (hasControlChars(d.title)) out.push("title: newlines and control characters are not allowed");
  if (hasControlChars(d.problem)) out.push("problem: newlines and control characters are not allowed");
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

/**
 * Step 1 of `open-pr` (review B2): build the commit in a TEMPORARY index (run with GIT_INDEX_FILE set), so the
 * user's own index and working tree are never touched and nothing they staged can ride along. The index starts
 * from `base` (origin/main) and gains only the drafted file.
 */
export function buildCommitPlan(slug: string, title: string, base: string, tree?: string): PlanStep[] {
  const file = `${WORKFLOWS_DIR}/${slug}.md`;
  return [
    { cmd: "git", args: ["read-tree", base] },
    { cmd: "git", args: ["add", "--", file] },
    { cmd: "git", args: ["write-tree"] },
    { cmd: "git", args: ["commit-tree", tree ?? "<tree>", "-p", base, "-m", `workflow: ${title}`] },
  ];
}

/** Step 2 of `open-pr`: branch at the new commit (no checkout), push it, open the PR. Run with execFile, never a shell. */
export function buildPublishPlan(slug: string, title: string, commit: string): PlanStep[] {
  return [
    { cmd: "git", args: ["branch", `workflow/${slug}`, commit] },
    { cmd: "git", args: ["push", "-u", "origin", `workflow/${slug}`] },
    {
      cmd: "gh",
      args: ["pr", "create", "--head", `workflow/${slug}`, "--title", `Workflow: ${title}`, "--body-file", PR_BODY_FILE, "--label", "workflow"],
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
