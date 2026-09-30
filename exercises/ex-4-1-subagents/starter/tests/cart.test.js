import { test } from "node:test";
import assert from "node:assert/strict";
import { subtotalCents, applyDiscount, shippingCents, totalCents, formatPeso } from "../src/cart.js";

const item = (priceCents, qty = 1) => ({ sku: "x", priceCents, qty });

test("subtotalCents sums price * qty", () => {
  assert.equal(subtotalCents([item(1000, 2), item(250, 4)]), 3000);
});

test("applyDiscount takes the percentage off", () => {
  assert.equal(applyDiscount(10000, 10), 9000);
  assert.equal(applyDiscount(10000, 0), 10000);
  assert.equal(applyDiscount(999, 15), 849);
});

test("shippingCents is free from 5000 upwards", () => {
  assert.equal(shippingCents(5000), 0);
  assert.equal(shippingCents(4999), 499);
});

test("shippingCents is zero for an empty cart", () => {
  assert.equal(shippingCents(0), 0);
});

test("totalCents without a discount", () => {
  assert.equal(totalCents([item(5000)]), 5000);
  assert.equal(totalCents([item(1000)]), 1499);
});

test("totalCents decides shipping after the discount", () => {
  // 6000 - 20% = 4800, which is under the free-shipping line
  assert.equal(totalCents([item(6000)], { discountPercent: 20 }), 5299);
});

test("totalCents of an empty cart is zero", () => {
  assert.equal(totalCents([]), 0);
});

test("formatPeso adds thousands separators and two decimals", () => {
  assert.equal(formatPeso(123450), "₱1,234.50");
  assert.equal(formatPeso(5), "₱0.05");
  assert.equal(formatPeso(0), "₱0.00");
});
