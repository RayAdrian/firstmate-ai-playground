// Checks the orchestration artifacts, not the feature. Frozen: do not edit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ownership = JSON.parse(readFileSync(path.join(root, "OWNERSHIP.json"), "utf8"));
const workers = ownership.workers ?? [];
const orchestratorOwns = ownership.orchestrator?.owns ?? [];

test("three workers, each with a name, a unique branch and at least one owned file", () => {
  assert.equal(workers.length, 3, "OWNERSHIP.json needs exactly 3 workers");
  const names = new Set();
  const branches = new Set();
  for (const w of workers) {
    assert.match(w.name ?? "", /^[a-z][a-z0-9-]*$/, "worker name must be kebab-case");
    assert.match(w.branch ?? "", /^[a-z0-9][a-z0-9/_-]*$/, `worker ${w.name}: invalid branch name`);
    assert.ok(Array.isArray(w.owns) && w.owns.length > 0, `worker ${w.name} owns nothing`);
    names.add(w.name);
    branches.add(w.branch);
  }
  assert.equal(names.size, 3, "worker names must be unique");
  assert.equal(branches.size, 3, "worker branches must be unique");
});

test("every src/ file has exactly one owner, and owners are explicit paths, not globs", () => {
  const srcFiles = readdirSync(path.join(root, "src")).map((f) => `src/${f}`);
  const owners = new Map();
  const claim = (who, file) => {
    assert.ok(!/[*?{}[\]]/.test(file), `${who}: "${file}" is a glob, list explicit files`);
    assert.ok(existsSync(path.join(root, file)), `${who}: "${file}" does not exist`);
    assert.ok(!owners.has(file), `"${file}" is owned by both ${owners.get(file)} and ${who}`);
    owners.set(file, who);
  };
  for (const w of workers) for (const f of w.owns) claim(w.name, f);
  for (const f of orchestratorOwns) claim("orchestrator", f);
  for (const f of srcFiles) assert.ok(owners.has(f), `${f} has no owner`);
});

test("nobody owns a test file: the tests are frozen for everyone", () => {
  const all = [...workers.flatMap((w) => w.owns), ...orchestratorOwns];
  for (const f of all) assert.ok(!f.startsWith("tests/"), `${f}: tests are frozen, remove it from OWNERSHIP.json`);
});

test("the orchestrator owns the glue file and no worker does", () => {
  assert.ok(orchestratorOwns.includes("src/index.mjs"));
  for (const w of workers) assert.ok(!w.owns.includes("src/index.mjs"), `${w.name} must not own src/index.mjs`);
});

test("each worker left a handoff note with Done and Test output sections", () => {
  for (const w of workers) {
    const file = path.join(root, "handoffs", `${w.name}.md`);
    assert.ok(existsSync(file), `handoffs/${w.name}.md is missing`);
    const text = readFileSync(file, "utf8");
    assert.match(text, /^## Done\s*$/m, `${w.name}: handoff needs a "## Done" section`);
    assert.match(text, /^## Test output\s*$/m, `${w.name}: handoff needs a "## Test output" section`);
    const after = text.split(/^## Test output\s*$/m)[1] ?? "";
    assert.ok(after.trim().length >= 20, `${w.name}: paste the real test output under "## Test output"`);
  }
});

test("no merge conflict markers anywhere in src/, tests/ or handoffs/", () => {
  for (const dir of ["src", "tests", "handoffs"]) {
    const abs = path.join(root, dir);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) {
      if (f === ".gitkeep") continue;
      const text = readFileSync(path.join(abs, f), "utf8");
      // Only the opening and closing markers: "=======" is a legitimate markdown underline.
      assert.ok(!/^(<{7}|>{7})( |$)/m.test(text), `${dir}/${f} contains a conflict marker`);
    }
  }
});
