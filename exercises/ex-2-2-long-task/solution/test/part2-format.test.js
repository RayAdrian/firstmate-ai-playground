// Part 2 (session 2): extract money formatting into src/format.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMoney } from "../src/format.js";

test("formatMoney renders integer cents as $D.CC", () => {
  assert.equal(formatMoney(125000), "$1250.00");
  assert.equal(formatMoney(4999), "$49.99");
  assert.equal(formatMoney(50), "$0.50");
  assert.equal(formatMoney(0), "$0.00");
});
