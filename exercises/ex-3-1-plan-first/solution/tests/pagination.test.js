import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApp } from "./helpers.js";

// Spec: GET /items with no query is unchanged (bare array of all items).
// Pagination applies only when `limit` is given. page defaults to 1. limit must be an integer 1..100.
// The body stays a bare array. Headers: X-Total-Count (all items) and X-Total-Pages.
// Invalid limit or page, or `page` without `limit`: 400 with { error }. A page past the end: 200 and [].

let app;
before(async () => {
  app = await startApp();
});
after(() => app.stop());

test("limit=10 returns the first 10 items", async () => {
  const res = await app.get("/items?limit=10");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(
    body.map((i) => i.id),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
});

test("page=2&limit=10 returns items 11..20", async () => {
  const body = await (await app.get("/items?page=2&limit=10")).json();
  assert.deepEqual(
    body.map((i) => i.id),
    [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  );
});

test("the last page is short: page=5&limit=10 returns items 41..45", async () => {
  const body = await (await app.get("/items?page=5&limit=10")).json();
  assert.deepEqual(
    body.map((i) => i.id),
    [41, 42, 43, 44, 45],
  );
});

test("a page past the end returns an empty array, not an error", async () => {
  const res = await app.get("/items?page=99&limit=10");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), []);
});

test("sets X-Total-Count and X-Total-Pages headers", async () => {
  const res = await app.get("/items?page=1&limit=10");
  assert.equal(res.headers.get("x-total-count"), "45");
  assert.equal(res.headers.get("x-total-pages"), "5");
});

test("rejects invalid limit and page with 400 and an error message", async () => {
  const bad = ["limit=0", "limit=101", "limit=abc", "limit=1.5", "limit=-3", "page=0&limit=10", "page=x&limit=10"];
  for (const q of bad) {
    const res = await app.get(`/items?${q}`);
    assert.equal(res.status, 400, q);
    assert.equal(typeof (await res.json()).error, "string", q);
  }
});

test("page without limit is rejected rather than silently ignored", async () => {
  const res = await app.get("/items?page=2");
  assert.equal(res.status, 400);
});
