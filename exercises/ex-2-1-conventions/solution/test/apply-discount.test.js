import { test } from "node:test";
import assert from "node:assert/strict";
import { handlers } from "../src/handlers/index.js";
import { AppError } from "../src/errors.js";

test("applyDiscountCents takes a percent off, rounded to whole cents", () => {
  assert.equal(handlers.applyDiscountCents(10000, 15), 8500);
  assert.equal(handlers.applyDiscountCents(999, 10), 899);
});

test("applyDiscountCents rejects a percent outside 0..100", () => {
  assert.throws(
    () => handlers.applyDiscountCents(1000, 101),
    (e) => e instanceof AppError && e.code === "E_INVALID_PERCENT",
  );
});
