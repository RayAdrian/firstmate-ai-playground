import fs from "node:fs";
import path from "node:path";
import { matchesAny } from "./glob.js";
import { parseDiff } from "./diff.js";

// Check types a case can use (see evals/spec.json):
//   file_exists        { path }
//   file_contains      { path, pattern, flags? }       regex over the file's text
//   file_not_contains  { path, pattern, flags? }
//   diff_touches_only  { diff?, allow: [glob, ...] }   every file in the diff matches an allow glob (diff defaults to patch.diff)
//   max_diff_lines     { diff?, max }                  added + removed lines <= max
//   rubric             { criteria }                    needs a judge model; this harness skips it
//
// A check returns { status: "pass" | "fail" | "skipped", reason } and may throw. All paths are relative to ctx.caseDir.
//
// TODO: this naive version passes everything. Implement each check, and make every doubtful situation a failure:
//   a missing file, a path that leaves the case folder, an empty or missing diff, a ".." segment in a diff path,
//   a bad regex, a bad limit, an unknown check type. `rubric` is "skipped", never "pass".
//   Helpers `fs`, `path`, `matchesAny` and `parseDiff` are imported for you.
void fs;
void path;
void matchesAny;
void parseDiff;

export function runCheck(check, ctx) {
  void check;
  void ctx;
  return { status: "pass", reason: "TODO" };
}
