import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "../src/slugify.js";

test("joins words with hyphens", () => {
  assert.equal(slugify("Hello World"), "hello-world");
});

test("drops punctuation and collapses spaces", () => {
  assert.equal(slugify("  A  b!  "), "a-b");
});
