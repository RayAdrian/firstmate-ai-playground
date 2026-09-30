import { test } from "node:test";
import assert from "node:assert/strict";
import { handler } from "../../src/routes/health.js";

test("GET /health is up", async () => {
  const res = await handler({ method: "GET", query: {} });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: "up" });
});
