import fs from "node:fs";
import path from "node:path";
import { matchesAny } from "./glob.js";
import { parseDiff } from "./diff.js";

const pass = (reason = "") => ({ status: "pass", reason });
const fail = (reason) => ({ status: "fail", reason });

/**
 * Resolve `rel` inside `caseDir`. Throws when the path would leave the folder (`..`, absolute paths, symlinks that
 * point outside). Returns null when the file does not exist or is not a regular file.
 */
function resolveInside(caseDir, rel) {
  if (typeof rel !== "string" || rel === "") throw new Error("path must be a non-empty string");
  const root = path.resolve(caseDir);
  const full = path.resolve(root, rel);
  if (full !== root && !full.startsWith(root + path.sep)) throw new Error(`path leaves the case folder: ${rel}`);
  if (!fs.existsSync(full)) return null;
  const real = fs.realpathSync(full);
  const realRoot = fs.realpathSync(root);
  if (real !== realRoot && !real.startsWith(realRoot + path.sep)) throw new Error(`path leaves the case folder: ${rel}`);
  return fs.statSync(real).isFile() ? real : null;
}

function readText(caseDir, rel) {
  const file = resolveInside(caseDir, rel);
  return file === null ? null : fs.readFileSync(file, "utf8");
}

function compile(check) {
  if (typeof check.pattern !== "string" || check.pattern === "") throw new Error("pattern must be a non-empty string");
  return new RegExp(check.pattern, typeof check.flags === "string" ? check.flags : "");
}

function hasDotDot(file) {
  return file.split("/").includes("..");
}

/** Run one check against one case folder. Returns { status: "pass" | "fail" | "skipped", reason }. May throw. */
export function runCheck(check, ctx) {
  const dir = ctx.caseDir;
  switch (check?.type) {
    case "file_exists":
      return resolveInside(dir, check.path) === null ? fail(`missing file: ${check.path}`) : pass();

    case "file_contains": {
      const text = readText(dir, check.path);
      if (text === null) return fail(`missing file: ${check.path}`);
      return compile(check).test(text) ? pass() : fail(`${check.path} does not match /${check.pattern}/`);
    }

    case "file_not_contains": {
      // A missing file cannot prove the pattern is absent, so it fails too.
      const text = readText(dir, check.path);
      if (text === null) return fail(`missing file: ${check.path}`);
      return compile(check).test(text) ? fail(`${check.path} matches forbidden /${check.pattern}/`) : pass();
    }

    case "diff_touches_only": {
      if (!Array.isArray(check.allow) || check.allow.length === 0 || check.allow.some((g) => typeof g !== "string")) {
        return fail("allow must be a non-empty list of globs");
      }
      const text = readText(dir, check.diff ?? "patch.diff");
      if (text === null) return fail("no diff file");
      const { files } = parseDiff(text);
      if (files.length === 0) return fail("empty diff: the agent changed nothing");
      const bad = files.filter((f) => f.startsWith("/") || hasDotDot(f) || !matchesAny(f, check.allow));
      return bad.length === 0 ? pass() : fail(`touches paths outside the allowed set: ${bad.slice(0, 5).join(", ")}`);
    }

    case "max_diff_lines": {
      if (!Number.isInteger(check.max) || check.max < 0) return fail("max must be a non-negative integer");
      const text = readText(dir, check.diff ?? "patch.diff");
      if (text === null) return fail("no diff file");
      const { added, removed } = parseDiff(text);
      const changed = added + removed;
      return changed <= check.max ? pass(`${changed} lines changed`) : fail(`${changed} lines changed, limit is ${check.max}`);
    }

    case "rubric":
      // Needs a judge model. This harness makes no model calls, so it reports the check as skipped, never as a pass.
      return { status: "skipped", reason: "needs a judge; not run by this harness" };

    default:
      return fail(`unknown check type: ${String(check?.type)}`);
  }
}
