import { test } from "node:test";
import assert from "node:assert/strict";
import { priceOrder } from "../src/pricing.js";

const line = (unitPriceCents, qty, sku = "A") => ({ sku, unitPriceCents, qty });

test("subtotal sums unit price times qty across lines", () => {
  const r = priceOrder([line(1000, 2, "A"), line(250, 3, "B")]);
  assert.deepEqual(r, {
    subtotalCents: 2750,
    volumeDiscountCents: 0,
    tierDiscountCents: 0,
    couponDiscountCents: 0,
    netCents: 2750,
    shippingCents: 499,
    vatCents: 330,
    totalCents: 3579,
  });
});

test("volume discount: 10% off a line at qty 10", () => {
  const r = priceOrder([line(1000, 10)]);
  assert.equal(r.subtotalCents, 10000);
  assert.equal(r.volumeDiscountCents, 1000);
  assert.equal(r.netCents, 9000);
  assert.equal(r.vatCents, 1080);
  assert.equal(r.totalCents, 10080);
});

test("volume discount: none at qty 9 (boundary)", () => {
  assert.equal(priceOrder([line(1000, 9)]).volumeDiscountCents, 0);
});

test("volume discount: 20% off a line at qty 50, not stacked with the 10% tier", () => {
  const r = priceOrder([line(100, 50)]);
  assert.equal(r.volumeDiscountCents, 1000);
  assert.equal(r.netCents, 4000);
});

test("volume discount: qty 49 still gets 10% (boundary)", () => {
  const r = priceOrder([line(100, 49)]);
  assert.equal(r.volumeDiscountCents, 490);
  assert.equal(r.netCents, 4410);
});

test("volume discount applies per line, not to the whole order", () => {
  const r = priceOrder([line(1000, 10, "A"), line(1000, 1, "B")]);
  assert.equal(r.subtotalCents, 11000);
  assert.equal(r.volumeDiscountCents, 1000);
  assert.equal(r.netCents, 10000);
});

test("gold tier takes 5% off after volume discounts", () => {
  const r = priceOrder([line(1000, 10)], { tier: "gold" });
  assert.equal(r.volumeDiscountCents, 1000);
  assert.equal(r.tierDiscountCents, 450);
  assert.equal(r.netCents, 8550);
  assert.equal(r.vatCents, 1026);
  assert.equal(r.totalCents, 9576);
});

test("standard tier gets no tier discount", () => {
  assert.equal(priceOrder([line(1000, 10)], { tier: "standard" }).tierDiscountCents, 0);
});

test("gold tier discount rounds half up (10 cents -> 1 cent off)", () => {
  const r = priceOrder([line(10, 1)], { tier: "gold" });
  assert.equal(r.tierDiscountCents, 1);
  assert.equal(r.netCents, 9);
});

test("coupon WELCOME500 takes 500 cents off when net is at least 2000", () => {
  const r = priceOrder([line(2500, 1)], { coupon: "WELCOME500" });
  assert.equal(r.couponDiscountCents, 500);
  assert.equal(r.netCents, 2000);
  assert.equal(r.vatCents, 240);
  assert.equal(r.totalCents, 2739);
});

test("coupon applies at exactly 2000 and is ignored at 1999 (boundary)", () => {
  assert.equal(priceOrder([line(2000, 1)], { coupon: "WELCOME500" }).couponDiscountCents, 500);
  const r = priceOrder([line(1999, 1)], { coupon: "WELCOME500" });
  assert.equal(r.couponDiscountCents, 0);
  assert.equal(r.netCents, 1999);
});

test("coupon threshold is checked after the gold discount", () => {
  // 2100 - 5% (105) = 1995, which is under 2000, so the coupon does not apply.
  const r = priceOrder([line(2100, 1)], { tier: "gold", coupon: "WELCOME500" });
  assert.equal(r.tierDiscountCents, 105);
  assert.equal(r.couponDiscountCents, 0);
});

test("unknown coupon throws", () => {
  assert.throws(() => priceOrder([line(1000, 1)], { coupon: "NOPE" }), /Unknown coupon/);
});

test("shipping is free at net 5000 and 499 at 4999 (boundary)", () => {
  assert.equal(priceOrder([line(5000, 1)]).shippingCents, 0);
  assert.equal(priceOrder([line(4999, 1)]).shippingCents, 499);
});

test("shipping is decided after the coupon", () => {
  const r = priceOrder([line(5200, 1)], { coupon: "WELCOME500" });
  assert.equal(r.netCents, 4700);
  assert.equal(r.shippingCents, 499);
});

test("vat is 12% of net and excludes shipping", () => {
  const r = priceOrder([line(1000, 1)]);
  assert.equal(r.vatCents, 120);
  assert.equal(r.totalCents, 1000 + 499 + 120);
});

test("vat rounds to the nearest cent", () => {
  assert.equal(priceOrder([line(105, 1)]).vatCents, 13); // 12.6
  assert.equal(priceOrder([line(104, 1)]).vatCents, 12); // 12.48
});

test("empty order costs nothing, with no shipping", () => {
  const zero = {
    subtotalCents: 0,
    volumeDiscountCents: 0,
    tierDiscountCents: 0,
    couponDiscountCents: 0,
    netCents: 0,
    shippingCents: 0,
    vatCents: 0,
    totalCents: 0,
  };
  assert.deepEqual(priceOrder([]), zero);
  assert.deepEqual(priceOrder([], { coupon: "WELCOME500", tier: "gold" }), zero);
});

test("invalid qty is rejected", () => {
  assert.throws(() => priceOrder([line(100, 0)]), RangeError);
  assert.throws(() => priceOrder([line(100, 1.5)]), RangeError);
  assert.throws(() => priceOrder([line(100, -2)]), RangeError);
});

test("invalid unit price is rejected", () => {
  assert.throws(() => priceOrder([line(-1, 1)]), RangeError);
  assert.throws(() => priceOrder([line(9.99, 1)]), RangeError);
});

test("invalid tier is rejected", () => {
  assert.throws(() => priceOrder([line(100, 1)], { tier: "platinum" }), RangeError);
});
