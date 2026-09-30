// Feature spec (verify step only): truncate(text, max) in src/text.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { truncate } from "../src/text.js";

test("truncate leaves short text alone", () => {
  assert.equal(truncate("hello", 5), "hello");
  assert.equal(truncate("", 3), "");
});

test("truncate cuts to max characters, ending with a single ellipsis that counts towards max", () => {
  assert.equal(truncate("hello world", 8), "hello w\u2026");
  assert.equal(truncate("hello world", 8).length, 8);
  assert.equal(truncate("abc", 1), "\u2026");
});
