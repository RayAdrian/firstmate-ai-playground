// Static checks for the four repo conventions. Verify step only: try not to read this before you write AGENTS.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { handlers } from "../src/handlers/index.js";

const listFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? listFiles(join(dir, d.name)) : [join(dir, d.name)],
  );
const files = listFiles("src");
const read = (f) => readFileSync(f, "utf8");

test("convention 1: money is integer cents, and money handlers end in Cents", () => {
  for (const name of Object.keys(handlers)) {
    assert.match(name, /Cents$/, `handler ${name} must end in Cents`);
  }
});

test("convention 2: errors are AppError with an E_UPPER_SNAKE code, never a bare Error", () => {
  for (const f of files) {
    assert.doesNotMatch(read(f), /throw new Error\(/, `${f} throws a bare Error`);
    for (const m of read(f).matchAll(/new AppError\("([^"]+)"/g)) {
      assert.match(m[1], /^E_[A-Z_]+$/, `${f}: bad error code ${m[1]}`);
    }
  }
});

test("convention 3: no console.*, use src/log.js", () => {
  for (const f of files) {
    if (f.endsWith("log.js")) continue;
    assert.doesNotMatch(read(f), /console\./, `${f} uses console`);
  }
});

test("convention 4: one kebab-case file per handler, registered in handlers/index.js", () => {
  const handlerFiles = readdirSync("src/handlers").filter((f) => f !== "index.js");
  const index = read("src/handlers/index.js");
  for (const f of handlerFiles) {
    assert.match(f, /^[a-z0-9]+(-[a-z0-9]+)*\.js$/, `${f} is not kebab-case`);
    assert.ok(index.includes(`./${f}`), `${f} is not imported in handlers/index.js`);
  }
  assert.equal(handlerFiles.length, Object.keys(handlers).length);
});
