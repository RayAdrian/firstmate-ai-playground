import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { exerciseJsonSchema } from "../../src/lib/contracts";

export const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
export const TOTAL_EXERCISES = 18;
export const MIN_AUTOMATED = 12;

type RunOutcome = "pass" | "fail" | "timeout";

export interface ExerciseResult {
  slug: string;
  status: "ok" | "manual" | "error";
  starter?: RunOutcome;
  solution?: RunOutcome;
}

export interface VerifyReport {
  ok: boolean;
  results: ExerciseResult[];
  lines: string[];
}

export interface VerifyOptions {
  exercisesDir: string;
  timeoutMs: number;
  /** Limit to these exercise slugs. */
  only?: string[];
  env?: NodeJS.ProcessEnv;
}

interface CmdResult {
  outcome: RunOutcome;
  output: string;
}

/** Environment for verify commands: inherited, minus any *_API_KEY (verification must never need a paid key). */
function cleanEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out = { ...env };
  for (const k of Object.keys(out)) if (/_API_KEY$/.test(k)) delete out[k];
  return out;
}

function run(cmd: string, cwd: string, timeoutMs: number, env: NodeJS.ProcessEnv): Promise<CmdResult> {
  return new Promise((resolve) => {
    const child = spawn("sh", ["-c", cmd], { cwd, env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let timedOut = false;
    child.stdout.on("data", (d: Buffer) => (output += d.toString()));
    child.stderr.on("data", (d: Buffer) => (output += d.toString()));
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        if (child.pid) process.kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    }, timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ outcome: timedOut ? "timeout" : code === 0 ? "pass" : "fail", output });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ outcome: "fail", output: err.message });
    });
  });
}

function tail(output: string, n = 20): string {
  return output.trimEnd().split("\n").slice(-n).map((l) => `      ${l}`).join("\n");
}

function hasDeps(dir: string): boolean {
  const pkg = path.join(dir, "package.json");
  if (!existsSync(pkg)) return false;
  try {
    const json = JSON.parse(readFileSync(pkg, "utf8")) as { dependencies?: object; devDependencies?: object };
    return Object.keys(json.dependencies ?? {}).length + Object.keys(json.devDependencies ?? {}).length > 0;
  } catch {
    return false;
  }
}

/** Run `verifyCmd` in a throwaway copy of `src` so the repo tree is never modified (no node_modules, no lockfile churn). */
async function runInCopy(src: string, verifyCmd: string, timeoutMs: number, env: NodeJS.ProcessEnv): Promise<CmdResult> {
  const tmp = mkdtempSync(path.join(tmpdir(), "fm-verify-"));
  try {
    cpSync(src, tmp, { recursive: true, filter: (s) => path.basename(s) !== "node_modules" });
    if (hasDeps(tmp)) {
      const install = await run("npm install --no-audit --no-fund --prefer-offline", tmp, timeoutMs, env);
      if (install.outcome !== "pass") return { outcome: install.outcome, output: `npm install failed\n${install.output}` };
    }
    return await run(verifyCmd, tmp, timeoutMs, env);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** E-4.3: at least 12 of the 18 exercises must use an automated verify command. Enforced once all 18 exist. */
export function automationCoverage(verifies: string[]): { ok: boolean; enforced: boolean; automated: number; total: number; message: string } {
  const total = verifies.length;
  const automated = verifies.filter((v) => v !== "manual").length;
  const enforced = total >= TOTAL_EXERCISES;
  const ok = !enforced || automated >= MIN_AUTOMATED;
  const message = enforced
    ? `automated verify: ${automated} of ${total} (need at least ${MIN_AUTOMATED})`
    : `automated verify: ${automated} of ${total} so far (enforced once all ${TOTAL_EXERCISES} exist; need at least ${MIN_AUTOMATED})`;
  return { ok, enforced, automated, total, message };
}

export async function verifyExercises(opts: VerifyOptions): Promise<VerifyReport> {
  const env = cleanEnv(opts.env ?? process.env);
  const results: ExerciseResult[] = [];
  const lines: string[] = [];
  const verifies: string[] = [];

  const folders = existsSync(opts.exercisesDir)
    ? readdirSync(opts.exercisesDir)
        .sort()
        .filter((f) => !f.startsWith(".") && statSync(path.join(opts.exercisesDir, f)).isDirectory())
    : [];

  for (const slug of folders) {
    if (opts.only && !opts.only.includes(slug)) continue;
    const dir = path.join(opts.exercisesDir, slug);
    const jsonPath = path.join(dir, "exercise.json");
    if (!existsSync(jsonPath)) {
      results.push({ slug, status: "error" });
      lines.push(`${slug}: ERROR missing exercise.json`);
      continue;
    }
    let verify: string;
    try {
      const parsed = exerciseJsonSchema.parse(JSON.parse(readFileSync(jsonPath, "utf8")));
      verify = parsed.verify;
    } catch (err) {
      results.push({ slug, status: "error" });
      lines.push(`${slug}: ERROR invalid exercise.json (${err instanceof Error ? err.message.split("\n")[0] : "unreadable"})`);
      continue;
    }
    verifies.push(verify);
    if (verify === "manual") {
      results.push({ slug, status: "manual" });
      lines.push(`${slug}: manual (skipped)`);
      continue;
    }

    const starter = await runInCopy(path.join(dir, "starter"), verify, opts.timeoutMs, env);
    const solution = await runInCopy(path.join(dir, "solution"), verify, opts.timeoutMs, env);
    const problems: string[] = [];
    if (starter.outcome === "timeout") problems.push(`${slug}: starter timed out after ${opts.timeoutMs}ms (\`${verify}\`)`);
    else if (starter.outcome === "pass") problems.push(`${slug}: starter exited 0 but must fail (\`${verify}\`)`);
    if (solution.outcome === "timeout") problems.push(`${slug}: solution timed out after ${opts.timeoutMs}ms (\`${verify}\`)`);
    else if (solution.outcome === "fail") problems.push(`${slug}: solution failed but must pass (\`${verify}\`), last 20 lines:\n${tail(solution.output)}`);

    if (problems.length === 0) {
      results.push({ slug, status: "ok", starter: starter.outcome, solution: solution.outcome });
      lines.push(`${slug}: starter FAIL (expected), solution PASS`);
    } else {
      results.push({ slug, status: "error", starter: starter.outcome, solution: solution.outcome });
      lines.push(...problems);
    }
  }

  return { ok: results.every((r) => r.status !== "error"), results, lines };
}
