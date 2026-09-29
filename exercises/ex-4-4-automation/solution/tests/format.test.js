import { test } from "node:test";
import assert from "node:assert/strict";
import { formatSource } from "../scripts/format.mjs";

test("formatSource trims, converts tabs, collapses blank lines and ends with one newline", () => {
  assert.equal(formatSource("a  \r\n\tb\t\n\n\n\nc"), "a\n  b\n\nc\n");
  assert.equal(formatSource("\n\n"), "");
});
