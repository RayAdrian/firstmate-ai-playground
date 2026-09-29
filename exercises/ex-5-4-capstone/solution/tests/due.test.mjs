import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDue } from "../src/due.mjs";

test("A-1: a real date in YYYY-MM-DD form is returned unchanged", () => {
  assert.equal(parseDue("2026-10-05"), "2026-10-05");
  assert.equal(parseDue("2028-02-29"), "2028-02-29");
});

test("A-1: anything else throws RangeError", () => {
  for (const bad of ["2026-02-30", "2027-02-29", "10/05/2026", "2026-1-5", "", "2026-13-01", undefined, null, 20261005]) {
    assert.throws(() => parseDue(bad), RangeError, `expected ${String(bad)} to be rejected`);
  }
});
