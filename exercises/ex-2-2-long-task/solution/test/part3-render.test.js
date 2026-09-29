// Part 3 (session 2): extract rendering into src/render.js and make report.js a thin facade
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderReport } from "../src/render.js";

test("renderReport lays out rows, a rule and a total", () => {
  const out = renderReport([
    { name: "Bob", amountCents: 4999 },
    { name: "Chandra", amountCents: 50 },
  ]);
  assert.equal(out, "Bob         $49.99\nChandra     $0.50\n--------------------\nTOTAL       $50.49\n");
});

test("report.js is a thin facade over parse, render (and format via render)", () => {
  const text = readFileSync("src/report.js", "utf8");
  assert.match(text, /from "\.\/parse\.js"/);
  assert.match(text, /from "\.\/render\.js"/);
  assert.ok(text.split("\n").length <= 15, "report.js should be tiny after the refactor");
});

test("render.js uses format.js rather than re-implementing money formatting", () => {
  assert.match(readFileSync("src/render.js", "utf8"), /from "\.\/format\.js"/);
});
