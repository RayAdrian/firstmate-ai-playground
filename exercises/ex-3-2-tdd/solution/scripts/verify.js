// npm run verify: (1) tests are unchanged since tests.lock, (2) the tests are substantial, (3) they pass.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const fail = (msg) => {
  console.error(`verify: FAIL - ${msg}`);
  process.exit(1);
};

// 1. Guard: the test files must match the recorded hash.
const lock = spawnSync(process.execPath, [join(root, "scripts/tests-lock.js"), "--check"], { stdio: "inherit" });
if (lock.status !== 0) process.exit(1);

// 2. Coverage floor: enough tests, one for each rule, no skipped or focused tests.
const files = readdirSync(join(root, "tests")).filter((f) => f.endsWith(".test.js"));
const source = files.map((f) => readFileSync(join(root, "tests", f), "utf8")).join("\n");
const titles = [...source.matchAll(/\b(?:test|it)\(\s*(["'`])(.+?)\1/g)].map((m) => m[2].toLowerCase());
if (titles.length < 12) fail(`found ${titles.length} tests, need at least 12`);
if (/\.(skip|todo|only)\b|\{\s*(?:skip|todo|only)\s*:/.test(source)) {
  fail("tests must not use skip, todo or only");
}
for (const rule of ["subtotal", "volume", "gold", "coupon", "shipping", "vat", "empty", "invalid"]) {
  if (!titles.some((t) => t.includes(rule))) fail(`no test title mentions "${rule}"`);
}

// 3. The tests pass.
const run = spawnSync(process.execPath, ["--test", "tests/*.test.js"], { cwd: root, stdio: "inherit" });
if (run.status !== 0) fail("tests are failing");
console.log(`verify: OK - ${titles.length} tests, unchanged since tests.lock, all passing`);
