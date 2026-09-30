import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPrice } from "../src/index.js";

test("formats centavos as pesos by default", () => {
  assert.equal(formatPrice(123450), "₱1,234.50");
  assert.equal(formatPrice(5), "₱0.05");
  assert.equal(formatPrice(0), "₱0.00");
});

test("supports USD", () => {
  assert.equal(formatPrice(999, { currency: "USD" }), "$9.99");
});

test("puts the minus sign before the symbol", () => {
  assert.equal(formatPrice(-500), "-₱5.00");
});

test("rejects non-integer input", () => {
  assert.throws(() => formatPrice(10.5), TypeError);
  assert.throws(() => formatPrice("100"), TypeError);
});

test("rejects unknown currencies", () => {
  assert.throws(() => formatPrice(100, { currency: "XXX" }), RangeError);
});
