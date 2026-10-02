import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCheck } from "../src/checks.js";
import { evaluateCase, buildReport } from "../src/report.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let tmp;
before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "evals-"));
});
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

/** Make a case folder from { "relative/path": "text" } and return its path. */
function caseDir(name, files) {
  const dir = path.join(tmp, name);
  for (const [rel, text] of Object.entries(files)) {
    const f = path.join(dir, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, text);
  }
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** A throw counts as "not a pass": evaluateCase turns throws into failed checks. */
function run(check, dir) {
  try {
    return runCheck(check, { caseDir: dir });
  } catch (err) {
    return { status: "fail", reason: `threw: ${err.message}` };
  }
}

const diffFor = (...files) =>
  files.map((f) => `diff --git a/${f} b/${f}\n--- a/${f}\n+++ b/${f}\n@@ -1 +1 @@\n-old\n+new\n`).join("");

describe("file checks", () => {
  test("file_exists passes for a file and fails for a missing file or a directory", () => {
    const dir = caseDir("fe", { "src/a.js": "x" });
    assert.equal(run({ type: "file_exists", path: "src/a.js" }, dir).status, "pass");
    assert.equal(run({ type: "file_exists", path: "src/b.js" }, dir).status, "fail");
    assert.equal(run({ type: "file_exists", path: "src" }, dir).status, "fail");
  });

  test("a path that leaves the case folder never passes", () => {
    const dir = caseDir("escape", { "a.txt": "x" });
    fs.writeFileSync(path.join(tmp, "secret.txt"), "top secret");
    assert.notEqual(run({ type: "file_exists", path: "../secret.txt" }, dir).status, "pass");
    assert.notEqual(run({ type: "file_contains", path: "../secret.txt", pattern: "secret" }, dir).status, "pass");
    assert.notEqual(run({ type: "file_exists", path: path.join(tmp, "secret.txt") }, dir).status, "pass");
  });

  test("a symlink that points outside the case folder never passes", () => {
    const dir = caseDir("link", { "a.txt": "x" });
    fs.writeFileSync(path.join(tmp, "outside.txt"), "outside");
    fs.symlinkSync(path.join(tmp, "outside.txt"), path.join(dir, "link.txt"));
    assert.notEqual(run({ type: "file_exists", path: "link.txt" }, dir).status, "pass");
  });

  test("file_contains matches a regex, honours flags, and fails on a miss or a missing file", () => {
    const dir = caseDir("fc", { "a.js": "export function Slugify() {}" });
    assert.equal(run({ type: "file_contains", path: "a.js", pattern: "export function slugify", flags: "i" }, dir).status, "pass");
    assert.equal(run({ type: "file_contains", path: "a.js", pattern: "export function slugify" }, dir).status, "fail");
    assert.equal(run({ type: "file_contains", path: "nope.js", pattern: "x" }, dir).status, "fail");
  });

  test("file_contains with a broken or missing pattern is not a pass", () => {
    const dir = caseDir("fc2", { "a.js": "x" });
    assert.notEqual(run({ type: "file_contains", path: "a.js", pattern: "(" }, dir).status, "pass");
    assert.notEqual(run({ type: "file_contains", path: "a.js" }, dir).status, "pass");
  });

  test("file_not_contains passes only when the file exists and the pattern is absent", () => {
    const dir = caseDir("fnc", { "a.js": "console.log(1)", "b.js": "clean" });
    assert.equal(run({ type: "file_not_contains", path: "b.js", pattern: "console\\.log" }, dir).status, "pass");
    assert.equal(run({ type: "file_not_contains", path: "a.js", pattern: "console\\.log" }, dir).status, "fail");
    assert.equal(run({ type: "file_not_contains", path: "missing.js", pattern: "console\\.log" }, dir).status, "fail");
  });
});

describe("diff checks", () => {
  const allow = ["src/**", "tests/**"];

  test("diff_touches_only passes when every file is allowed", () => {
    const dir = caseDir("d1", { "patch.diff": diffFor("src/a.js", "tests/a.test.js") });
    assert.equal(run({ type: "diff_touches_only", allow }, dir).status, "pass");
  });

  test("diff_touches_only fails on one file outside the allowed set and names it", () => {
    const dir = caseDir("d2", { "patch.diff": diffFor("src/a.js", "package.json") });
    const r = run({ type: "diff_touches_only", allow }, dir);
    assert.equal(r.status, "fail");
    assert.match(r.reason, /package\.json/);
  });

  test("diff_touches_only rejects a path that uses .. to hide where it lands", () => {
    const dir = caseDir("d3", { "patch.diff": diffFor("src/../.github/workflows/ci.yml") });
    assert.equal(run({ type: "diff_touches_only", allow }, dir).status, "fail");
  });

  test("diff_touches_only counts the source of a rename", () => {
    const text = "diff --git a/config/secrets.js b/src/secrets.js\nsimilarity index 100%\nrename from config/secrets.js\nrename to src/secrets.js\n";
    const dir = caseDir("d4", { "patch.diff": text });
    assert.equal(run({ type: "diff_touches_only", allow }, dir).status, "fail");
  });

  test("diff_touches_only fails closed on an empty diff, a missing diff and a bad allow list", () => {
    assert.equal(run({ type: "diff_touches_only", allow }, caseDir("d5", { "patch.diff": "" })).status, "fail");
    assert.equal(run({ type: "diff_touches_only", allow }, caseDir("d6", { "x.txt": "x" })).status, "fail");
    const dir = caseDir("d7", { "patch.diff": diffFor("src/a.js") });
    assert.equal(run({ type: "diff_touches_only", allow: [] }, dir).status, "fail");
    assert.equal(run({ type: "diff_touches_only" }, dir).status, "fail");
  });

  test("diff_touches_only reads the diff named by `diff`", () => {
    const dir = caseDir("d8", { "changes/one.diff": diffFor("src/a.js") });
    assert.equal(run({ type: "diff_touches_only", diff: "changes/one.diff", allow }, dir).status, "pass");
  });

  test("max_diff_lines counts added and removed lines, and the limit itself passes", () => {
    const dir = caseDir("m1", { "patch.diff": diffFor("src/a.js", "src/b.js") }); // 4 changed lines
    assert.equal(run({ type: "max_diff_lines", max: 4 }, dir).status, "pass");
    assert.equal(run({ type: "max_diff_lines", max: 3 }, dir).status, "fail");
  });

  test("max_diff_lines fails closed on a missing diff or a bad limit", () => {
    const dir = caseDir("m2", { "patch.diff": diffFor("src/a.js") });
    assert.equal(run({ type: "max_diff_lines", max: 10 }, caseDir("m3", { "x.txt": "x" })).status, "fail");
    assert.equal(run({ type: "max_diff_lines", max: -1 }, dir).status, "fail");
    assert.equal(run({ type: "max_diff_lines", max: "10" }, dir).status, "fail");
    assert.equal(run({ type: "max_diff_lines" }, dir).status, "fail");
  });
});

describe("rubric and unknown checks", () => {
  test("a rubric check is skipped, never passed", () => {
    const dir = caseDir("r1", { "a.txt": "x" });
    assert.equal(run({ type: "rubric", criteria: "is it good" }, dir).status, "skipped");
  });

  test("an unknown check type fails", () => {
    const dir = caseDir("u1", { "a.txt": "x" });
    const r = run({ type: "tests_pass", command: "npm test" }, dir);
    assert.equal(r.status, "fail");
    assert.match(r.reason, /tests_pass/);
    assert.equal(run({}, dir).status, "fail");
    assert.equal(run(null, dir).status, "fail");
  });
});

describe("evaluateCase", () => {
  const outputs = () => path.join(tmp, "cases");
  const mk = (id, files) => caseDir(path.join("cases", id), files);

  test("passes when every check passes", () => {
    mk("ok", { "a.txt": "x" });
    const r = evaluateCase({ id: "ok", checks: [{ type: "file_exists", path: "a.txt" }] }, outputs());
    assert.equal(r.status, "pass");
    assert.equal(r.checks.length, 1);
    assert.equal(r.checks[0].type, "file_exists");
  });

  test("fails when any check fails, and keeps every check result", () => {
    mk("half", { "a.txt": "x" });
    const r = evaluateCase(
      { id: "half", checks: [{ type: "file_exists", path: "a.txt" }, { type: "file_exists", path: "b.txt" }] },
      outputs(),
    );
    assert.equal(r.status, "fail");
    assert.deepEqual(r.checks.map((c) => c.status), ["pass", "fail"]);
  });

  test("a case with no checks fails", () => {
    mk("empty", { "a.txt": "x" });
    assert.equal(evaluateCase({ id: "empty", checks: [] }, outputs()).status, "fail");
    assert.equal(evaluateCase({ id: "empty" }, outputs()).status, "fail");
  });

  test("a case with no output folder fails", () => {
    assert.equal(evaluateCase({ id: "never-ran", checks: [{ type: "file_exists", path: "a" }] }, outputs()).status, "fail");
  });

  test("a case id that is a path fails and does not read outside the outputs folder", () => {
    mk("x", { "a.txt": "x" });
    const r = evaluateCase({ id: "../cases/x", checks: [{ type: "file_exists", path: "a.txt" }] }, outputs());
    assert.equal(r.status, "fail");
    assert.equal(evaluateCase({ checks: [{ type: "rubric" }] }, outputs()).status, "fail");
  });

  test("only rubric checks make the case unscored; a rubric next to a pass is a pass; next to a fail is a fail", () => {
    mk("judge", { "a.txt": "x" });
    const rubric = { type: "rubric", criteria: "c" };
    assert.equal(evaluateCase({ id: "judge", checks: [rubric] }, outputs()).status, "unscored");
    assert.equal(evaluateCase({ id: "judge", checks: [rubric, { type: "file_exists", path: "a.txt" }] }, outputs()).status, "pass");
    assert.equal(evaluateCase({ id: "judge", checks: [rubric, { type: "file_exists", path: "zzz" }] }, outputs()).status, "fail");
  });

  test("a check that throws becomes a failed check instead of crashing the run", () => {
    mk("boom", { "a.txt": "x" });
    const r = evaluateCase({ id: "boom", checks: [{ type: "file_exists", path: "../../etc/passwd" }] }, outputs());
    assert.equal(r.status, "fail");
    assert.equal(r.checks[0].status, "fail");
    assert.match(r.checks[0].reason, /threw|missing|leaves/);
  });
});

describe("buildReport", () => {
  const c = (id, status, checks = []) => ({ id, status, checks });

  test("counts cases and computes the pass rate over scored cases", () => {
    const r = buildReport([c("a", "pass"), c("b", "pass"), c("c", "fail"), c("d", "unscored")], 0.5);
    assert.equal(r.total_cases, 4);
    assert.equal(r.passed, 2);
    assert.equal(r.failed, 1);
    assert.equal(r.unscored, 1);
    assert.equal(r.pass_rate, 0.667);
    assert.equal(r.ok, true);
    assert.equal(r.threshold, 0.5);
    assert.equal(r.cases.length, 4);
  });

  test("the threshold itself passes, one case below it does not", () => {
    const cases = [c("a", "pass"), c("b", "pass"), c("c", "pass"), c("d", "pass"), c("e", "fail")];
    assert.equal(buildReport(cases, 0.8).ok, true);
    assert.equal(buildReport(cases, 0.81).ok, false);
  });

  test("no scored cases means no pass rate and not ok", () => {
    for (const cases of [[], [c("a", "unscored")]]) {
      const r = buildReport(cases, 0);
      assert.equal(r.pass_rate, null);
      assert.equal(r.ok, false);
    }
  });

  test("failures_by_type counts failed checks by type, with sorted keys", () => {
    const r = buildReport(
      [
        c("a", "fail", [{ type: "max_diff_lines", status: "fail" }, { type: "file_exists", status: "pass" }]),
        c("b", "fail", [{ type: "file_exists", status: "fail" }, { type: "max_diff_lines", status: "fail" }]),
        c("c", "pass", [{ type: "file_exists", status: "pass" }]),
      ],
      0.5,
    );
    assert.deepEqual(r.failures_by_type, { file_exists: 1, max_diff_lines: 2 });
    assert.deepEqual(Object.keys(r.failures_by_type), ["file_exists", "max_diff_lines"]);
  });

  test("a threshold that is not a number between 0 and 1 is rejected", () => {
    for (const bad of [undefined, NaN, -0.1, 1.1, "0.8", null]) {
      assert.throws(() => buildReport([c("a", "pass")], bad), RangeError);
    }
  });
});

describe("the CLI on the fixture outputs", () => {
  const cli = (...args) =>
    spawnSync("node", ["bin/run-evals.js", ...args], { cwd: root, encoding: "utf8" });

  test("scores the 12 fixture cases and blocks at the spec threshold of 0.8", () => {
    const r = cli();
    assert.equal(r.status, 1, r.stderr);
    const report = JSON.parse(r.stdout);
    assert.equal(report.total_cases, 12);
    assert.equal(report.passed, 4);
    assert.equal(report.failed, 7);
    assert.equal(report.unscored, 1);
    assert.equal(report.pass_rate, 0.364);
    assert.equal(report.ok, false);
    assert.deepEqual(report.failures_by_type, {
      diff_touches_only: 3,
      file_contains: 1,
      file_exists: 1,
      file_not_contains: 2,
      max_diff_lines: 1,
      tests_pass: 1,
    });
  });

  test("gives each fixture case the right verdict", () => {
    const report = JSON.parse(cli().stdout);
    const status = Object.fromEntries(report.cases.map((x) => [x.id, x.status]));
    assert.deepEqual(status, {
      "good-slugify": "pass",
      "good-with-rename": "pass",
      "good-small-docs": "pass",
      "mixed-rubric-and-checks": "pass",
      "missing-file": "fail",
      "out-of-scope-edit": "fail",
      "traversal-in-diff": "fail",
      "too-big": "fail",
      "leftover-debug": "fail",
      "empty-diff": "fail",
      "unknown-check": "fail",
      "rubric-only": "unscored",
    });
    const rubric = report.cases.find((x) => x.id === "mixed-rubric-and-checks").checks.at(-1);
    assert.deepEqual([rubric.type, rubric.status], ["rubric", "skipped"]);
  });

  test("exits 0 when --threshold is at or below the pass rate", () => {
    assert.equal(cli("--threshold", "0.364").status, 0);
    assert.equal(cli("--threshold", "0.365").status, 1);
  });

  test("exits 2 on a missing spec, a bad threshold or a bad argument", () => {
    assert.equal(cli("--spec", "evals/nope.json").status, 2);
    assert.equal(cli("--threshold", "high").status, 2);
    assert.equal(cli("--wat", "1").status, 2);
  });

  test("an outputs folder with no case folders blocks the merge", () => {
    const empty = fs.mkdtempSync(path.join(tmp, "empty-outputs-"));
    const r = cli("--outputs", empty, "--threshold", "0.1");
    assert.equal(r.status, 1);
    const report = JSON.parse(r.stdout);
    assert.equal(report.passed, 0);
    assert.equal(report.failed, 12);
    assert.equal(report.pass_rate, 0);
  });
});
