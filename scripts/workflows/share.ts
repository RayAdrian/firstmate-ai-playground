/**
 * `npm run workflows:share -- <command>`: the deterministic half of /share-workflow (PRD §16 WF-16).
 * Commands: preflight | read <path>... | draft --answers <file> [--dry-run] | confirm <slug> [--phrase <text>] | open-pr <slug>
 * The skill is the conversation; this CLI is the control. Only `confirm` writes `client_safe: confirmed`.
 *
 * Validation and scanning are W1's CLIs (`workflows:validate`, `workflows:scan`), called as subprocesses
 * so this file depends only on their documented output (`<path>: <field>: <reason>` lines, and
 * `<line>: <rule-id>` lines, non-zero exit on problems).
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { parseArgs } from "node:util";
import { REPO_URL, WORKFLOWS_DIR, workflowSlugSchema } from "../../src/lib/contracts/workflow";
import {
  answersProblems,
  answersSchema,
  buildCommitPlan,
  buildPublishPlan,
  checkReadable,
  hasClientSafeConfirmed,
  originMatches,
  readTitle,
  redactDraft,
  renderDraft,
  slugify,
  withClientSafe,
  type PlanStep,
} from "./share-lib";

export const CONFIRM_PHRASE = "client-safe";

export interface Deps {
  /** Validation problems for one workflow file (`<path>: <field>: <reason>` lines). Empty = valid. */
  validate(file: string, cwd: string, env: NodeJS.ProcessEnv): Promise<string[]>;
  /** Scan findings for one file (`<line>: <rule-id>` lines). Empty = clean. */
  scan(file: string, cwd: string, env: NodeJS.ProcessEnv): Promise<string[]>;
}

export interface Ctx {
  cwd: string;
  env: NodeJS.ProcessEnv;
  deps: Deps;
  out: (s: string) => void;
  err: (s: string) => void;
  /** Interactive stdin for `confirm` without --phrase. */
  prompt?: (question: string) => Promise<string>;
}

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

function run(cmd: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): Promise<Run> {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd, env, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      const code = error ? (typeof error.code === "number" ? error.code : 127) : 0;
      resolve({ code, stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

const lines = (s: string) => s.split("\n").map((l) => l.trimEnd()).filter(Boolean);

/** Default deps: shell out to W1's npm scripts. */
export const defaultDeps: Deps = {
  async validate(file, cwd, env) {
    const r = await run("npm", ["run", "--silent", "workflows:validate"], cwd, env);
    if (r.code === 0) return [];
    const all = lines(r.stdout + "\n" + r.stderr);
    const mine = all.filter((l) => l.startsWith(file + ":"));
    if (mine.length) return mine;
    const formatted = all.some((l) => /^\S.*?: .+: .+/.test(l));
    // Failures about other files are not this draft's problem; an unparseable failure is.
    return formatted ? [] : [`${file}: validator: workflows:validate failed: ${all[0] ?? "no output"}`];
  },
  async scan(file, cwd, env) {
    const r = await run("npm", ["run", "--silent", "workflows:scan", "--", file], cwd, env);
    if (r.code === 0) return [];
    const found = lines(r.stdout + "\n" + r.stderr).filter((l) => /^\d+: \S+/.test(l));
    return found.length ? found : [`0: scan-failed (workflows:scan exited ${r.code}: ${lines(r.stderr)[0] ?? "no output"})`];
  },
};

/** Validation with the draft-stage excuse: `client_safe` problems are ignored until `confirm`. */
const excuseClientSafe = (probs: string[]) => probs.filter((l) => !/:\s*client_safe\s*:/.test(l));

const fileFor = (slug: string) => `${WORKFLOWS_DIR}/${slug}.md`;

async function isTracked(rel: string, ctx: Ctx): Promise<boolean> {
  const r = await run("git", ["ls-files", "--error-unmatch", "--", rel], ctx.cwd, ctx.env);
  return r.code === 0;
}

function checkSlug(slug: string | undefined, ctx: Ctx): slug is string {
  const ok = !!slug && workflowSlugSchema.safeParse(slug).success;
  if (!ok) ctx.err(`invalid slug "${slug ?? ""}": expected kebab-case, at most 60 chars`);
  return ok;
}

/* ------------------------------------------------------------------ commands */

async function preflight(ctx: Ctx): Promise<number> {
  const problems: string[] = [];
  const origin = await run("git", ["config", "--get", "remote.origin.url"], ctx.cwd, ctx.env);
  if (origin.code !== 0 || !originMatches(origin.stdout, REPO_URL)) {
    problems.push(`origin is not ${REPO_URL}. Run /share-workflow from a checkout of that repo, e.g. git clone ${REPO_URL}.git`);
  }
  const status = await run("git", ["status", "--porcelain"], ctx.cwd, ctx.env);
  if (status.code !== 0 || status.stdout.trim() !== "") {
    problems.push("the working tree is not clean. Commit or stash first: git stash push -u -m before-share-workflow");
  }
  const auth = await run("gh", ["auth", "status"], ctx.cwd, ctx.env);
  if (auth.code !== 0) problems.push("gh is not signed in. Run: gh auth login");
  const fetch = await run("git", ["fetch", "origin", "main"], ctx.cwd, ctx.env);
  if (fetch.code !== 0) problems.push("cannot fetch origin/main. Check your network and access, then run: git fetch origin main");
  if (problems.length) {
    for (const p of problems) ctx.err(`preflight: ${p}`);
    return 1;
  }
  ctx.out("preflight ok");
  return 0;
}

async function readCmd(paths: string[], ctx: Ctx): Promise<number> {
  if (!paths.length) {
    ctx.err("usage: read <path>...");
    return 1;
  }
  const home = ctx.env.HOME ?? os.homedir();
  let repoRoot = ctx.cwd;
  const top = await run("git", ["rev-parse", "--show-toplevel"], ctx.cwd, ctx.env);
  if (top.code === 0 && top.stdout.trim()) repoRoot = top.stdout.trim();
  let refused = 0;
  for (const p of paths) {
    // realpath first, deny list (case-insensitive) on the requested and resolved path, then the allow rule.
    const r = checkReadable(p, { cwd: ctx.cwd, home, repoRoot });
    if (r.denied || !r.real) {
      refused++;
      ctx.err(`DENIED ${p}: ${r.reason ?? "refused"}`);
      continue;
    }
    ctx.out(`=== ${p} ===`);
    ctx.out(fs.readFileSync(r.real, "utf8"));
  }
  return refused ? 2 : 0;
}

async function draft(args: string[], ctx: Ctx): Promise<number> {
  const { values } = parseArgs({
    args,
    options: { answers: { type: "string" }, "dry-run": { type: "boolean", default: false } },
    strict: true,
  });
  if (!values.answers) {
    ctx.err("usage: draft --answers <file.json> [--dry-run]");
    return 1;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(path.resolve(ctx.cwd, values.answers), "utf8"));
  } catch (e) {
    ctx.err(`cannot read answers file: ${(e as Error).message}`);
    return 1;
  }
  const parsed = answersSchema.safeParse(raw);
  if (!parsed.success) {
    for (const i of parsed.error.issues) ctx.err(`answers: ${i.path.join(".")}: ${i.message}`);
    return 1;
  }
  const slug = parsed.data.workflow.slug ?? slugify(parsed.data.workflow.title);
  if (!checkSlug(slug, ctx)) return 1;
  const rel = fileFor(slug);
  if (await isTracked(rel, ctx)) {
    ctx.err(`${rel} already exists in git. Pick a different slug, or edit that workflow with a normal PR.`);
    return 1;
  }

  const { draft: redacted, redactions } = redactDraft(parsed.data.workflow);
  const shape = answersProblems(redacted).map((p) => `${rel}: ${p}`);
  fs.mkdirSync(path.join(ctx.cwd, WORKFLOWS_DIR), { recursive: true });
  fs.writeFileSync(path.join(ctx.cwd, rel), renderDraft(redacted));

  const validation = [...shape, ...excuseClientSafe(await ctx.deps.validate(rel, ctx.cwd, ctx.env))];
  const findings = await ctx.deps.scan(rel, ctx.cwd, ctx.env);
  const report = { slug, file: rel, dryRun: !!values["dry-run"], findings, validation, redactions };
  ctx.out(JSON.stringify(report, null, 2));
  // `draft` never creates a branch, commit or network call, with or without --dry-run.
  return findings.length || validation.length ? 1 : 0;
}

async function confirm(args: string[], ctx: Ctx): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    options: { phrase: { type: "string" } },
    allowPositionals: true,
    strict: true,
  });
  const slug = positionals[0];
  if (!checkSlug(slug, ctx)) return 1;
  const rel = fileFor(slug);
  const abs = path.join(ctx.cwd, rel);
  if (!fs.existsSync(abs)) {
    ctx.err(`${rel} does not exist; run draft first`);
    return 1;
  }
  let phrase = values.phrase;
  if (phrase === undefined) {
    phrase = ctx.prompt ? await ctx.prompt(`Type ${CONFIRM_PHRASE} to confirm this workflow is client-safe: `) : "";
  }
  if (phrase !== CONFIRM_PHRASE) {
    if (!(await isTracked(rel, ctx))) fs.rmSync(abs, { force: true });
    ctx.err(`not confirmed (expected exactly "${CONFIRM_PHRASE}"). The draft was deleted; nothing was committed or pushed.`);
    return 3;
  }
  try {
    fs.writeFileSync(abs, withClientSafe(fs.readFileSync(abs, "utf8")));
  } catch (e) {
    ctx.err(`${rel}: ${(e as Error).message}`);
    return 1;
  }
  ctx.out(`client_safe: confirmed written to ${rel}`);
  return 0;
}

const shellQuote = (s: string) => (/^[A-Za-z0-9_@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`);
const show = (s: PlanStep) => [s.cmd, ...s.args].map(shellQuote).join(" ");

async function openPr(args: string[], ctx: Ctx): Promise<number> {
  const slug = args[0];
  if (!checkSlug(slug, ctx)) return 1;
  const rel = fileFor(slug);
  const abs = path.join(ctx.cwd, rel);
  if (!fs.existsSync(abs)) {
    ctx.err(`${rel} does not exist`);
    return 1;
  }
  const content = fs.readFileSync(abs, "utf8");
  if (!hasClientSafeConfirmed(content)) {
    ctx.err(`${rel}: client_safe: not confirmed. Run: npm run workflows:share -- confirm ${slug}`);
    return 1;
  }
  const title = readTitle(content);
  if (!title) {
    ctx.err(`${rel}: title: missing`);
    return 1;
  }
  // Re-run here; never trust an earlier result.
  const validation = await ctx.deps.validate(rel, ctx.cwd, ctx.env);
  const findings = await ctx.deps.scan(rel, ctx.cwd, ctx.env);
  if (validation.length || findings.length) {
    for (const v of validation) ctx.err(v);
    for (const f of findings) ctx.err(`${rel}:${f}`);
    ctx.err("open-pr refused: fix the problems above and run draft again");
    return 1;
  }

  // Build the commit in a temporary index so the user's index and tree are never touched (review B2).
  const base = await run("git", ["rev-parse", "--verify", "origin/main^{commit}"], ctx.cwd, ctx.env);
  if (base.code !== 0) {
    ctx.err("cannot resolve origin/main. Run: git fetch origin main");
    return 1;
  }
  const baseSha = base.stdout.trim();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "share-index-"));
  const env = { ...ctx.env, GIT_INDEX_FILE: path.join(tmpDir, "index") };
  let commit = "";
  try {
    let tree = "";
    for (const step of buildCommitPlan(slug, title, baseSha)) {
      const args2 = step.args[0] === "commit-tree" ? buildCommitPlan(slug, title, baseSha, tree)[3].args : step.args;
      const r = await run(step.cmd, args2, ctx.cwd, env);
      if (r.code !== 0) {
        ctx.err(`${show(step)} failed (exit ${r.code}): ${lines(r.stderr)[0] ?? ""}`);
        return 1;
      }
      if (step.args[0] === "write-tree") tree = r.stdout.trim();
      if (step.args[0] === "commit-tree") commit = r.stdout.trim();
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  // Verify before anything leaves the machine: the commit differs from origin/main by exactly this one added file.
  const diff = await run("git", ["diff", "--name-status", "--no-renames", baseSha, commit], ctx.cwd, ctx.env);
  const changed = lines(diff.stdout);
  if (diff.code !== 0 || changed.length !== 1 || changed[0] !== `A\t${rel}`) {
    ctx.err(`refusing to push: the commit must add exactly ${rel}, but it changes: ${changed.join("; ") || "(unknown)"}`);
    return 1;
  }

  const plan = buildPublishPlan(slug, title, commit);
  let url = "";
  for (let i = 0; i < plan.length; i++) {
    const step = plan[i];
    const r = await run(step.cmd, step.args, ctx.cwd, ctx.env);
    if (r.code !== 0) {
      ctx.err(`${show(step)} failed (exit ${r.code}): ${lines(r.stderr)[0] ?? ""}`);
      ctx.err(
        i >= 1
          ? `The branch and commit are kept. To finish: ${i === 1 ? `${show(plan[1])} && ` : ""}${show(plan[2])}`
          : `Nothing was pushed. Fix the cause, then re-run: npm run workflows:share -- open-pr ${slug}`,
      );
      return 1;
    }
    if (step.cmd === "gh") url = lines(r.stdout).pop() ?? "";
  }
  ctx.out(url || "PR created");
  return 0;
}

/* ---------------------------------------------------------------------- main */

export async function main(argv: string[], ctx: Ctx): Promise<number> {
  const [cmd, ...rest] = argv;
  try {
    switch (cmd) {
      case "preflight":
        return await preflight(ctx);
      case "read":
        return await readCmd(rest, ctx);
      case "draft":
        return await draft(rest, ctx);
      case "confirm":
        return await confirm(rest, ctx);
      case "open-pr":
        return await openPr(rest, ctx);
      default:
        ctx.err("usage: workflows:share -- <preflight | read <path>... | draft --answers <file> [--dry-run] | confirm <slug> [--phrase <text>] | open-pr <slug>>");
        return 1;
    }
  } catch (e) {
    ctx.err(`error: ${(e as Error).message}`);
    return 1;
  }
}

if (process.argv[1] && /share\.ts$/.test(process.argv[1])) {
  const rl = () => readline.createInterface({ input: process.stdin, output: process.stderr });
  main(process.argv.slice(2), {
    cwd: process.cwd(),
    env: process.env,
    deps: defaultDeps,
    out: (s) => console.log(s),
    err: (s) => console.error(s),
    prompt: process.stdin.isTTY
      ? (q) =>
          new Promise((resolve) => {
            const i = rl();
            i.question(q, (a) => {
              i.close();
              resolve(a);
            });
          })
      : undefined,
  }).then((code) => process.exit(code));
}
