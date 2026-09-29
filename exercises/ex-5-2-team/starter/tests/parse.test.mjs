// Part A acceptance tests. Frozen: do not edit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCommit, parseCommits } from "../src/parse.mjs";

test("parses type, scope, breaking flag and subject", () => {
  assert.deepEqual(parseCommit("feat(ui)!: add dark mode"), {
    type: "feat",
    scope: "ui",
    breaking: true,
    subject: "add dark mode",
  });
});

test("scope and bang are optional", () => {
  assert.deepEqual(parseCommit("fix: handle empty input"), {
    type: "fix",
    scope: null,
    breaking: false,
    subject: "handle empty input",
  });
});

test("type is lowercased, scope keeps its case, extra whitespace after the colon is fine", () => {
  assert.deepEqual(parseCommit("Feat(API):    Add thing"), {
    type: "feat",
    scope: "API",
    breaking: false,
    subject: "Add thing",
  });
});

test("non-conventional lines become type other with the trimmed line as subject", () => {
  assert.deepEqual(parseCommit("  Merge branch 'main'  "), {
    type: "other",
    scope: null,
    breaking: false,
    subject: "Merge branch 'main'",
  });
});

test("blank lines return null", () => {
  assert.equal(parseCommit(""), null);
  assert.equal(parseCommit("   \t"), null);
});

test("parseCommits keeps order, drops blank lines and tolerates CRLF", () => {
  const commits = parseCommits("feat: a\n\nfix(core): b\r\nchore: c\r\n");
  assert.deepEqual(
    commits.map((c) => `${c.type}|${c.scope}|${c.subject}`),
    ["feat|null|a", "fix|core|b", "chore|null|c"],
  );
});
