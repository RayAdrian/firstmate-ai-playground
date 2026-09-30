import { test } from "node:test";
import assert from "node:assert/strict";
import { handler } from "../../src/routes/users.js";

test("GET /users?id= returns the user", async () => {
  const res = await handler({ method: "GET", query: { id: "u-1" } });
  assert.equal(res.status, 200);
  assert.equal(res.body.name, "Ana Reyes");
});

test("GET /users without an id is a bad request", async () => {
  const res = await handler({ method: "GET", query: {} });
  assert.equal(res.status, 400);
});

test("GET /users with an unknown id is a 404", async () => {
  const res = await handler({ method: "GET", query: { id: "nope" } });
  assert.equal(res.status, 404);
});
