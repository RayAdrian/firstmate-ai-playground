import { test } from "node:test";
import assert from "node:assert/strict";
import { titleCase } from "../src/text.mjs";

test("titleCase capitalises each word", () => {
  assert.equal(titleCase("model routing pays off"), "Model Routing Pays Off");
});

test("titleCase lowercases the rest of each word", () => {
  assert.equal(titleCase("oPUS aND sONNET"), "Opus And Sonnet");
});

test("titleCase collapses repeated whitespace and trims", () => {
  assert.equal(titleCase("  plan   then  build "), "Plan Then Build");
});

test("titleCase of an empty string is an empty string", () => {
  assert.equal(titleCase(""), "");
});
