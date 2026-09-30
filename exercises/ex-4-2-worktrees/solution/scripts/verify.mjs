// Verifies the merged result. Run with: node scripts/verify.mjs (or npm run verify).
// 1. Both features' tests pass together.
// 2. No merge-conflict markers were left behind.
// 3. CHANGELOG.md has an entry for each feature.
// 4. If this directory is its own git repo, at least one merge commit exists
//    (create it with `git merge --no-ff <branch>`).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];

const tests = spawnSync(process.execPath, ["--test"], { cwd: root, stdio: "inherit" });
if (tests.status !== 0) problems.push("tests fail on this checkout (are both features merged?)");

const markers = /^(<{7}|={7}|>{7})( |$)/m;
function scan(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) scan(path);
    else if (name !== "verify.mjs" && markers.test(readFileSync(path, "utf8"))) {
      problems.push(`conflict markers left in ${path.slice(root.length + 1)}`);
    }
  }
}
scan(root);

const changelog = existsSync(join(root, "CHANGELOG.md")) ? readFileSync(join(root, "CHANGELOG.md"), "utf8") : "";
if (!/format-?price/i.test(changelog)) problems.push("CHANGELOG.md has no entry for formatPrice");
if (!/parse-?duration/i.test(changelog)) problems.push("CHANGELOG.md has no entry for parseDuration");

if (existsSync(join(root, ".git"))) {
  const log = spawnSync("git", ["log", "--merges", "--oneline"], { cwd: root, encoding: "utf8" });
  if (log.status === 0 && log.stdout.trim() === "") {
    problems.push("no merge commit found: merge each feature branch with `git merge --no-ff`");
  }
}

if (problems.length > 0) {
  console.error("\nverify failed:\n  - " + problems.join("\n  - "));
  process.exit(1);
}
console.log("\nverify passed: both features are merged and tested.");
