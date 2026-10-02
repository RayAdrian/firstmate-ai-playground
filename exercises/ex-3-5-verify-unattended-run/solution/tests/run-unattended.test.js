// Tests for run-unattended.sh. No model is called: the "agent" is one of the small fake
// scripts in tests/agents/, and `git`/`gh` are shims (tests/bin) that record what the script calls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const realGit = execFileSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).trim();
for (const shim of ["git", "gh"]) chmodSync(join(root, "tests/bin", shim), 0o755);

const identity = {
  GIT_AUTHOR_NAME: "fm",
  GIT_AUTHOR_EMAIL: "fm@example.com",
  GIT_COMMITTER_NAME: "fm",
  GIT_COMMITTER_EMAIL: "fm@example.com",
};

function cleanEnv() {
  const env = { ...process.env, ...identity };
  // `node --test` inside this `node --test` must behave like a fresh run.
  for (const key of ["NODE_OPTIONS", "NODE_TEST_CONTEXT", "VITEST", "VITEST_WORKER_ID", "VITEST_POOL_ID"]) delete env[key];
  for (const key of Object.keys(env)) if (/_API_KEY$/.test(key)) delete env[key];
  return env;
}

/** A fresh copy of the sample app as a git repo on `main`, plus a place for the run's evidence. */
function setup() {
  const tmp = mkdtempSync(join(tmpdir(), "fm-unattended-"));
  const work = join(tmp, "app");
  cpSync(join(root, "fixtures/app"), work, { recursive: true });
  const git = (...args) => execFileSync(realGit, args, { cwd: work, env: cleanEnv(), encoding: "utf8" }).trim();
  git("init", "-q", "-b", "main");
  git("add", "-A");
  git("commit", "-qm", "baseline");
  return { tmp, work, git, runDir: join(tmp, "run-1"), gitLog: join(tmp, "git-calls.log"), mainBefore: git("rev-parse", "main") };
}

function run(ctx, agent, extra = {}) {
  const started = Date.now();
  const result = spawnSync("bash", [join(root, "run-unattended.sh")], {
    cwd: root,
    encoding: "utf8",
    timeout: 15_000,
    env: {
      ...cleanEnv(),
      PATH: `${join(root, "tests/bin")}:${process.env.PATH}`,
      FM_REAL_GIT: realGit,
      FM_GIT_LOG: ctx.gitLog,
      WORKDIR: ctx.work,
      RUN_DIR: ctx.runDir,
      TASK_FILE: join(root, "task.md"),
      AGENT_CMD: `exec bash "${join(root, "tests/agents", agent + ".sh")}"`,
      TEST_CMD: "node --test test/",
      MAX_SECONDS: "2",
      ...extra,
    },
  });
  return { ...result, seconds: (Date.now() - started) / 1000 };
}

const read = (ctx, name) => (existsSync(join(ctx.runDir, name)) ? readFileSync(join(ctx.runDir, name), "utf8") : "");

/** The one rule for every outcome: nothing was merged, pushed, pulled or sent to GitHub. */
function assertNothingShipped(ctx) {
  assert.equal(ctx.git("rev-parse", "main"), ctx.mainBefore, "main must not move: the run never merges");
  const calls = existsSync(ctx.gitLog) ? readFileSync(ctx.gitLog, "utf8").split("\n") : [];
  const shipped = calls.filter((line) => /^(push|merge|pull|rebase|cherry-pick|reset)\b/.test(line));
  assert.deepEqual(shipped, [], "the script must not push, merge, pull, rebase, cherry-pick or reset");
  assert.equal(existsSync(`${ctx.gitLog}.gh`), false, "the script must not call the GitHub CLI");
}

function cleanup(ctx) {
  rmSync(ctx.tmp, { recursive: true, force: true });
}

test("passes only when the agent's change makes the tests pass", (t) => {
  const ctx = setup();
  t.after(() => cleanup(ctx));
  const r = run(ctx, "good");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(read(ctx, "verdict").trim(), "PASS");
  assert.match(read(ctx, "run.log"), /TEST_EXIT=0/, "run.log records the test gate's exit code");
  assert.match(read(ctx, "agent.log"), /I changed src\/slugify\.js/, "agent.log keeps the agent's output");
  assert.match(read(ctx, "diff.stat"), /slugify\.js/, "diff.stat is a summary of what changed");
  assert.match(read(ctx, "diff.patch"), /\+.*replace/, "diff.patch has the full diff");
  const branch = `agent/${basename(ctx.runDir)}`;
  assert.equal(ctx.git("rev-list", "--count", `main..${branch}`), "1", "the work waits on a branch, one commit ahead of main");
  assertNothingShipped(ctx);
});

test("the test gate runs the tests itself: an agent that claims success does not get a PASS", (t) => {
  const ctx = setup();
  t.after(() => cleanup(ctx));
  const r = run(ctx, "lies");
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(read(ctx, "verdict"), /^FAIL/);
  assert.match(read(ctx, "run.log"), /TEST_EXIT=[1-9]/);
  assert.doesNotMatch(r.stdout, /VERDICT: PASS|Run finished/, "stdout must not announce success");
  assertNothingShipped(ctx);
});

test("editing a protected path (the tests) is a failure even when the tests go green", (t) => {
  const ctx = setup();
  t.after(() => cleanup(ctx));
  const r = run(ctx, "cheats");
  assert.equal(r.status, 5, r.stdout + r.stderr);
  assert.match(read(ctx, "verdict"), /^FAIL: .*protected/i);
  assertNothingShipped(ctx);
});

test("an agent that changes nothing is a failure, not a quiet success", (t) => {
  const ctx = setup();
  t.after(() => cleanup(ctx));
  const r = run(ctx, "noop");
  assert.equal(r.status, 4, r.stdout + r.stderr);
  assert.match(read(ctx, "verdict"), /^FAIL: .*nothing/i);
  assertNothingShipped(ctx);
});

test("a non-zero agent exit is a failure even if the work looks fine", (t) => {
  const ctx = setup();
  t.after(() => cleanup(ctx));
  const r = run(ctx, "crash");
  assert.equal(r.status, 3, r.stdout + r.stderr);
  assert.match(read(ctx, "verdict"), /^FAIL: .*exit/i);
  assertNothingShipped(ctx);
});

test("the stop condition ends a hung agent after MAX_SECONDS", (t) => {
  const ctx = setup();
  t.after(() => cleanup(ctx));
  const r = run(ctx, "hangs");
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.ok(r.seconds < 12, `stopped after ${r.seconds}s, expected about 2s`);
  assert.match(read(ctx, "verdict"), /^FAIL: .*stopped/i);
  assertNothingShipped(ctx);
});

test("every run leaves its evidence in RUN_DIR", (t) => {
  const ctx = setup();
  t.after(() => cleanup(ctx));
  run(ctx, "lies");
  const files = readdirSync(ctx.runDir);
  for (const name of ["run.log", "agent.log", "tests.log", "diff.stat", "diff.patch", "verdict"]) {
    assert.ok(files.includes(name), `missing ${name} in RUN_DIR (found: ${files.join(", ") || "nothing"})`);
  }
});
