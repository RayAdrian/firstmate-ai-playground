import { test } from "node:test";
import assert from "node:assert/strict";
import { handler } from "../../src/routes/orders.js";

test("GET /orders?customer= returns that customer's orders", async () => {
  const res = await handler({ method: "GET", query: { customer: "c-1" } });
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 2);
});

test("GET /orders without a customer is a bad request", async () => {
  const res = await handler({ method: "GET", query: {} });
  assert.equal(res.status, 400);
});
