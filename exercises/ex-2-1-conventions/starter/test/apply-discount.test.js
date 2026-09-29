// The feature request: add an apply-discount handler.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { handlers } from "../src/handlers/index.js";
import { AppError } from "../src/errors.js";

test("applyDiscountCents takes a percent off, rounded to whole cents", () => {
  assert.equal(handlers.applyDiscountCents(10000, 15), 8500);
  assert.equal(handlers.applyDiscountCents(999, 10), 899); // 899.1 rounds to 899
  assert.equal(handlers.applyDiscountCents(500, 0), 500);
  assert.equal(handlers.applyDiscountCents(500, 100), 0);
});

test("applyDiscountCents rejects a percent outside 0..100 with E_INVALID_PERCENT", () => {
  for (const bad of [-1, 101, Number.NaN]) {
    assert.throws(
      () => handlers.applyDiscountCents(1000, bad),
      (e) => e instanceof AppError && e.code === "E_INVALID_PERCENT",
    );
  }
});

test("apply-discount lives in its own kebab-case file", () => {
  assert.ok(existsSync("src/handlers/apply-discount.js"));
});
