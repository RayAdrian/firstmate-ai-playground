import { test } from "node:test";
import assert from "node:assert/strict";
import { handlers } from "../src/handlers/index.js";
import { AppError } from "../src/errors.js";

test("getOrderTotalCents sums price x qty in cents", () => {
  assert.equal(
    handlers.getOrderTotalCents([
      { priceCents: 1999, qty: 2 },
      { priceCents: 500, qty: 1 },
    ]),
    4498,
  );
});

test("getOrderTotalCents rejects a bad quantity with an AppError", () => {
  assert.throws(
    () => handlers.getOrderTotalCents([{ priceCents: 100, qty: 0 }]),
    (e) => e instanceof AppError && e.code === "E_INVALID_QTY",
  );
});
