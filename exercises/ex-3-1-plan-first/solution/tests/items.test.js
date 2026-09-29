import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApp } from "./helpers.js";

let app;
before(async () => {
  app = await startApp();
});
after(() => app.stop());

test("GET /items with no query returns every item as a bare array", async () => {
  const res = await app.get("/items");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body));
  assert.equal(body.length, 45);
});

test("GET /items/:id returns one item", async () => {
  const res = await app.get("/items/7");
  assert.equal(res.status, 200);
  assert.equal((await res.json()).id, 7);
});

test("GET /items/:id returns 404 for an unknown id", async () => {
  const res = await app.get("/items/999");
  assert.equal(res.status, 404);
});
