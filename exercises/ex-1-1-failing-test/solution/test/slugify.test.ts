import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Node runs .ts files directly and needs the extension; the playground's tsconfig does not allow it.
import { slugify } from "../src/slugify.ts";

test("lowercases and joins words with a hyphen", () => {
  assert.equal(slugify("Hello World"), "hello-world");
});

test("leaves an existing slug alone", () => {
  assert.equal(slugify("already-a-slug"), "already-a-slug");
});

test("keeps digits", () => {
  assert.equal(slugify("Top 10 Tips"), "top-10-tips");
});

test("collapses runs of punctuation and spaces, and trims the ends", () => {
  assert.equal(slugify("  Hello,   World!  "), "hello-world");
});
