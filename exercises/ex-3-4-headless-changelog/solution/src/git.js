import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** Parses "<sha><TAB><subject>" lines into commit objects. Blank lines are skipped. */
export function parseLog(text) {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const [sha, ...rest] = line.split("\t");
      return { sha: sha.trim(), subject: rest.join("\t").trim() };
    });
}

/** Reads commits from a file in that format, or from `git log` (optionally over a range). */
export function readCommits({ fromFile, range, cwd = process.cwd() } = {}) {
  if (fromFile) return parseLog(readFileSync(fromFile, "utf8"));
  const args = ["log", "--pretty=format:%h%x09%s", ...(range ? [range] : ["-n", "50"])];
  return parseLog(execFileSync("git", args, { cwd, encoding: "utf8" }));
}
