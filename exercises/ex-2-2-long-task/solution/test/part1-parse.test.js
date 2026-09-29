// Part 1 (session 1): extract parsing into src/parse.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRows } from "../src/parse.js";

test("parseRows turns CSV into { name, amountCents } rows, skipping the header", () => {
  assert.deepEqual(parseRows("name,amountCents\nAlice,125000\n Bob ,4999\n"), [
    { name: "Alice", amountCents: 125000 },
    { name: "Bob", amountCents: 4999 },
  ]);
});
