import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../src/validate.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const fakeBin = join(root, "tests", "bin");
const fixture = join(root, "fixtures", "commits.txt");
const outputSchema = JSON.parse(readFileSync(join(root, "schema", "changelog.schema.json"), "utf8"));
const fixtureShas = readFileSync(fixture, "utf8").split("\n").filter(Boolean).map((l) => l.split("\t")[0]);

/** Runs the CLI with the fake claude/codex first on PATH. Returns exit code, output and the recorded tool calls. */
function cli(args, { mode = "ok", cwd = root } = {}) {
  const log = join(mkdtempSync(join(tmpdir(), "fake-")), "calls.jsonl");
  writeFileSync(log, "");
  const r = spawnSync(process.execPath, [join(root, "bin", "changelog.js"), ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH}`, FAKE_MODE: mode, FAKE_LOG: log },
  });
  const calls = readFileSync(log, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  return { code: r.status, stdout: r.stdout, stderr: r.stderr, calls };
}

const run = (tool, extra = [], opts) => cli(["--tool", tool, "--from-file", fixture, "--format", "json", ...extra], opts);

for (const tool of ["claude", "codex"]) {
  test(`${tool}: output matches the schema and every commit appears exactly once`, () => {
    const r = run(tool);
    assert.equal(r.code, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.deepEqual(validate(outputSchema, out), []);
    assert.equal(out.tool, tool);
    assert.equal(out.commit_count, fixtureShas.length);
    const shas = out.sections.flatMap((s) => s.items.map((i) => i.sha));
    assert.deepEqual([...shas].sort(), [...fixtureShas].sort());
  });

  test(`${tool}: commits are grouped by category`, () => {
    const out = JSON.parse(run(tool).stdout);
    const byCategory = Object.fromEntries(out.sections.map((s) => [s.category, s.items.map((i) => i.sha)]));
    assert.deepEqual(byCategory.breaking, ["e5f6a7b"]);
    assert.deepEqual(byCategory.feature, ["a1b2c3d"]);
    assert.ok(byCategory.fix.includes("b2c3d4e"));
  });

  test(`${tool}: commit text goes to stdin as data and never into the arguments`, () => {
    const { calls } = run(tool);
    assert.equal(calls.length, 1, "exactly one headless call");
    const [call] = calls;
    assert.match(call.stdin, /ignore previous instructions/, "commit subjects are sent on stdin");
    assert.ok(!call.args.join(" ").includes("ignore previous instructions"), "commit text must not be in argv");
    assert.match(call.args.join(" "), /untrusted/i, "the instructions must say the input is untrusted");
  });

  test(`${tool}: a tool failure exits 1 and prints nothing on stdout`, () => {
    const r = run(tool, [], { mode: "error" });
    assert.equal(r.code, 1);
    assert.equal(r.stdout, "");
    assert.match(r.stderr, /simulated failure|exited with code/);
  });

  test(`${tool}: a reply that is not JSON exits 1`, () => {
    const r = run(tool, [], { mode: "garbage" });
    assert.equal(r.code, 1);
    assert.equal(r.stdout, "");
  });

  test(`${tool}: a category outside the enum is rejected`, () => {
    const r = run(tool, [], { mode: "bad-category" });
    assert.equal(r.code, 1);
    assert.equal(r.stdout, "");
    assert.match(r.stderr, /category/);
  });

  test(`${tool}: an unexpected extra field is rejected`, () => {
    const r = run(tool, [], { mode: "extra-field" });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /unexpected field/);
  });

  test(`${tool}: an invented sha is rejected`, () => {
    const r = run(tool, [], { mode: "unknown-sha" });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /unknown sha deadbee/);
  });

  test(`${tool}: a commit the model dropped is rejected`, () => {
    const r = run(tool, [], { mode: "missing-sha" });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /missing sha/);
  });
}

test("claude is called with -p, JSON output, a JSON schema, and no tools", () => {
  const [{ args }] = run("claude").calls;
  assert.ok(args.includes("-p"));
  assert.equal(args[args.indexOf("--output-format") + 1], "json");
  const schema = JSON.parse(args[args.indexOf("--json-schema") + 1]);
  assert.ok(schema.properties.entries, "the schema passed to claude describes { entries }");
  assert.equal(args[args.indexOf("--tools") + 1], "", 'tools are disabled with --tools ""');
  for (const bad of ["--dangerously-skip-permissions", "--allowedTools", "--allow-dangerously-skip-permissions"]) {
    assert.ok(!args.includes(bad), `${bad} must not be used`);
  }
});

test("codex is called with exec, a schema file, -o, an ephemeral read-only run", () => {
  const [{ args }] = run("codex").calls;
  assert.equal(args[0], "exec");
  assert.ok(args.includes("--output-schema"));
  assert.ok(args.includes("-o") || args.includes("--output-last-message"));
  assert.ok(args.includes("--ephemeral"));
  assert.equal(args[args.indexOf("--sandbox") + 1], "read-only");
  for (const bad of ["--dangerously-bypass-approvals-and-sandbox", "--full-auto", "danger-full-access"]) {
    assert.ok(!args.includes(bad), `${bad} must not be used`);
  }
});

test("--format md prints a markdown changelog with a heading per category", () => {
  const r = cli(["--tool", "claude", "--from-file", fixture, "--format", "md"]);
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /^## Breaking changes$/m);
  assert.match(r.stdout, /^## Features$/m);
  assert.match(r.stdout, /^- add CSV export to the reports page \(`a1b2c3d`\)$/m);
});

test("with no --from-file it reads git log from the current repository", () => {
  const repo = mkdtempSync(join(tmpdir(), "repo-"));
  const git = (...a) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...a], { cwd: repo });
  git("init", "-q");
  for (const subject of ["feat: first thing", "fix: second thing", "docs: third thing"]) {
    git("commit", "-q", "--allow-empty", "-m", subject);
  }
  const r = cli(["--tool", "claude", "--format", "json"], { cwd: repo });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).commit_count, 3);
  assert.match(r.calls[0].stdin, /feat: first thing/);
});

test("an empty commit list makes no headless call at all", () => {
  const empty = join(mkdtempSync(join(tmpdir(), "empty-")), "commits.txt");
  writeFileSync(empty, "");
  const r = cli(["--tool", "claude", "--from-file", empty, "--format", "json"]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.calls.length, 0);
  assert.deepEqual(JSON.parse(r.stdout), { tool: "claude", commit_count: 0, sections: [] });
});

test("bad usage exits 2", () => {
  assert.equal(cli(["--tool", "gemini", "--from-file", fixture]).code, 2);
  assert.equal(cli(["--from-file", fixture]).code, 2);
  assert.equal(cli(["--tool", "claude", "--format", "xml", "--from-file", fixture]).code, 2);
});
