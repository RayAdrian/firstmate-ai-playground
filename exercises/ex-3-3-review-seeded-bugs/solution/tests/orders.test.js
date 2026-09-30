import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../src/db.js";
import { findOrdersByEmail, listOrders, discountedTotal, completeOrder, refundOrder } from "../src/orders.js";

test("findOrdersByEmail returns that customer's orders", () => {
  const db = openDb();
  const rows = findOrdersByEmail(db, "alice@example.com");
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.user_email === "alice@example.com"));
});

// Added because of review finding 1 (SQL injection).
test("findOrdersByEmail treats the email as data, not SQL", () => {
  const db = openDb();
  assert.deepEqual(findOrdersByEmail(db, "x' OR '1'='1"), []);
});

test("listOrders returns a page of the requested size", () => {
  const db = openDb();
  assert.equal(listOrders(db, { pageSize: 2 }).length, 2);
});

// Added because of review finding 2 (off-by-one).
test("listOrders is 1-based: page 1 starts at the first order", () => {
  const db = openDb();
  assert.deepEqual(listOrders(db, { page: 1, pageSize: 2 }).map((o) => o.id), [1, 2]);
  assert.deepEqual(listOrders(db, { page: 2, pageSize: 2 }).map((o) => o.id), [3, 4]);
  assert.deepEqual(listOrders(db, { page: 3, pageSize: 2 }).map((o) => o.id), [5]);
});

test("listOrders rejects page 0", () => {
  assert.throws(() => listOrders(openDb(), { page: 0 }), RangeError);
});

test("discountedTotal takes a percentage off", () => {
  assert.equal(discountedTotal(10000, 50), 5000);
  assert.equal(discountedTotal(2500, 20), 2000);
});

// Added because of review finding 3 (fractional cents).
test("discountedTotal always returns whole cents", () => {
  assert.equal(discountedTotal(999, 10), 899); // 899.1 rounds down
  assert.equal(discountedTotal(995, 10), 896); // 895.5 rounds half up
  assert.ok(Number.isInteger(discountedTotal(333, 33)));
});

test("completeOrder marks the order completed", async () => {
  const db = openDb();
  const result = await completeOrder(db, 1);
  assert.equal(result.status, "completed");
  assert.equal(db.prepare("SELECT status FROM orders WHERE id = 1").get().status, "completed");
});

test("completeOrder rejects an unknown order", async () => {
  await assert.rejects(completeOrder(openDb(), 999), /not found/);
});

// Added because of review finding 4 (missing await).
test("completeOrder survives a failed receipt and logs it", async () => {
  const db = openDb();
  db.prepare("UPDATE orders SET user_email = 'not-an-email' WHERE id = 2").run();
  const log = mock.method(console, "error", () => {});
  try {
    const result = await completeOrder(db, 2);
    assert.equal(result.status, "completed");
    assert.equal(log.mock.callCount(), 1, "the receipt failure should be caught and logged");
  } finally {
    log.mock.restore();
  }
});

test("refundOrder records a partial refund", () => {
  const db = openDb();
  assert.equal(refundOrder(db, 1, 4000).refunded_cents, 4000);
});

test("refundOrder rejects a refund larger than the order", () => {
  assert.throws(() => refundOrder(openDb(), 2, 99999), /exceeds/);
});

// Added because of review finding 5 (refund cap ignores earlier refunds).
test("refundOrder counts earlier refunds against the cap", () => {
  const db = openDb();
  refundOrder(db, 1, 6000);
  assert.throws(() => refundOrder(db, 1, 5000), /exceeds/);
  assert.equal(refundOrder(db, 1, 4000).refunded_cents, 10000);
});
