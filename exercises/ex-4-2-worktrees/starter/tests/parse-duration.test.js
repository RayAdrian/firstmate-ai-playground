import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDuration } from "../src/index.js";

test("parses single units into milliseconds", () => {
  assert.equal(parseDuration("45s"), 45_000);
  assert.equal(parseDuration("2m"), 120_000);
  assert.equal(parseDuration("3h"), 10_800_000);
  assert.equal(parseDuration("1d"), 86_400_000);
});

test("parses combined units, with or without spaces", () => {
  assert.equal(parseDuration("1h30m"), 5_400_000);
  assert.equal(parseDuration("1h 30m 15s"), 5_415_000);
  assert.equal(parseDuration("1d2h"), 93_600_000);
});

test("rejects empty and malformed input", () => {
  assert.throws(() => parseDuration(""), RangeError);
  assert.throws(() => parseDuration("abc"), RangeError);
  assert.throws(() => parseDuration("10"), RangeError);
  assert.throws(() => parseDuration("5x"), RangeError);
});

test("rejects non-strings", () => {
  assert.throws(() => parseDuration(90), TypeError);
});
