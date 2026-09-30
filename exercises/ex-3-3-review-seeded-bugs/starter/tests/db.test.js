import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../src/db.js";
import { sendReceipt } from "../src/receipts.js";

test("openDb seeds five orders", () => {
  const db = openDb();
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM orders").get().n, 5);
});

test("sendReceipt rejects an order without a usable email", async () => {
  await assert.rejects(sendReceipt({ id: 1, user_email: "nope" }), /bad email/);
});
