import { test } from "node:test";
import assert from "node:assert/strict";
import { priceOrder } from "../src/pricing.js";

const line = (unitPriceCents, qty, sku = "A") => ({ sku, unitPriceCents, qty });

// These three are a starting point. Write the rest yourself from README.md (step 1),
// then run `npm run lock-tests` and commit before the agent implements anything.

test("subtotal sums unit price times qty across lines", () => {
  const r = priceOrder([line(1000, 2, "A"), line(250, 3, "B")]);
  assert.equal(r.subtotalCents, 2750);
});

test("volume discount: 10% off a line at qty 10", () => {
  const r = priceOrder([line(1000, 10)]);
  assert.equal(r.volumeDiscountCents, 1000);
  assert.equal(r.netCents, 9000);
});

test("empty order costs nothing, with no shipping", () => {
  const r = priceOrder([]);
  assert.equal(r.totalCents, 0);
  assert.equal(r.shippingCents, 0);
});
