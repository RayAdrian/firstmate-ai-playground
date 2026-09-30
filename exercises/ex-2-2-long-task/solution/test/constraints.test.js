// The constraints. These pass on the starter and must still pass at the end, after
// two sessions and a handoff. If your agent "forgets" one, this file fails.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { generateReport } from "../src/report.js";

const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");

test("C1: generateReport(csv) output is byte-identical (golden file)", () => {
  const csv = readFileSync("test/fixtures/sales.csv", "utf8");
  assert.equal(generateReport(csv), readFileSync("test/fixtures/expected.txt", "utf8"));
});

test("C2: the golden fixtures were not edited to make tests pass", () => {
  assert.equal(sha("test/fixtures/expected.txt"), "7d2aa3f02d30adbb8a723262cee0f3a7c7d76d7d9239cb9295461aaf6a7426c2");
  assert.equal(sha("test/fixtures/sales.csv"), "a4e0a9099e21d45aa281f49d7444852db6bb2ae34bb228fdc76aa93a6d82f57b");
});

test("C3: no new dependencies", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0);
  assert.equal(Object.keys(pkg.devDependencies ?? {}).length, 0);
});

test("C4: plain ESM JavaScript, no require()", () => {
  for (const f of ["report", "parse", "format", "render"]) {
    let text = "";
    try {
      text = readFileSync(`src/${f}.js`, "utf8");
    } catch {
      continue; // missing modules are reported by the part tests
    }
    assert.doesNotMatch(text, /\brequire\(/, `src/${f}.js uses require()`);
  }
});
