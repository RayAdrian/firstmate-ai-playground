// The handoff note between session 1 and session 2, kept in the repo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

test("HANDOFF.md exists with Done, Next and Constraints sections", () => {
  assert.ok(existsSync("HANDOFF.md"), "write HANDOFF.md at the end of session 1");
  const text = readFileSync("HANDOFF.md", "utf8");
  for (const h of ["Done", "Next", "Constraints"]) {
    assert.match(text, new RegExp(`^## ${h}\\s*$`, "m"), `missing "## ${h}" heading`);
  }
});

test("HANDOFF.md carries the constraints, not just the progress", () => {
  const text = readFileSync("HANDOFF.md", "utf8");
  assert.match(text, /byte-identical|golden/i, "mention the golden-output constraint");
  assert.match(text, /dependenc/i, "mention the no-new-dependencies constraint");
  assert.match(text, /fixtures/i, "mention that fixtures must not be edited");
});
