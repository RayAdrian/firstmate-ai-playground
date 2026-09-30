import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Structural check of PLAN.md. It can't judge whether the plan is good; the CHECKLIST does that.
const planPath = fileURLToPath(new URL("../PLAN.md", import.meta.url));

function loadPlan() {
  assert.ok(existsSync(planPath), "PLAN.md is missing. Write and commit the plan before any code.");
  return readFileSync(planPath, "utf8");
}

function section(plan, title) {
  const re = new RegExp(`^##\\s+${title}[^\\n]*\\n([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, "im");
  const m = plan.match(re);
  assert.ok(m, `PLAN.md needs a "## ${title}" section`);
  return m[1].trim();
}

test("PLAN.md has the five required sections, each non-empty", () => {
  const plan = loadPlan();
  for (const title of ["Goal", "Files to change", "Steps", "Risks", "Verification"]) {
    assert.ok(section(plan, title).length >= 20, `"## ${title}" is too thin`);
  }
});

test("PLAN.md states what is out of scope", () => {
  assert.match(loadPlan(), /out of scope/i);
});

test("Steps has at least three numbered steps", () => {
  const steps = section(loadPlan(), "Steps");
  const numbered = steps.split("\n").filter((l) => /^\s*\d+[.)]\s+\S/.test(l));
  assert.ok(numbered.length >= 3, `found ${numbered.length} numbered steps, need 3+`);
});

test("Files to change names real files from this repo", () => {
  const files = section(loadPlan(), "Files to change");
  assert.match(files, /src\/app\.js/, "the plan should name src/app.js");
  assert.match(files, /tests\//, "the plan should say which tests to add or change");
});

test("Verification names the command that proves it works", () => {
  assert.match(section(loadPlan(), "Verification"), /npm test/);
});

test("Risks addresses backwards compatibility and invalid input", () => {
  const risks = section(loadPlan(), "Risks");
  assert.match(risks, /backward|existing (client|caller)|breaking|compat/i);
  assert.match(risks, /invalid|400|validation|bad input/i);
});
