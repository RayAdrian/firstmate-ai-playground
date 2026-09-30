import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "../src/text.js";
import { parsePort } from "../src/config.js";
import { findItem, totalQty } from "../src/inventory.js";

test("slugify", () => {
  assert.equal(slugify("  Hello, World!  "), "hello-world");
});

test("parsePort", () => {
  assert.equal(parsePort("8080"), 8080);
  assert.equal(parsePort("nope"), 3000);
  assert.equal(parsePort(undefined), 3000);
});

test("findItem and totalQty", () => {
  const items = [
    { sku: "a", qty: 2 },
    { sku: "b", qty: 5 },
  ];
  assert.equal(findItem(items, "b").qty, 5);
  assert.equal(totalQty(items), 7);
});
