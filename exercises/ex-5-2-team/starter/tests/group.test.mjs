// Part B acceptance tests. Frozen: do not edit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupByType } from "../src/group.mjs";

const c = (type, subject, extra = {}) => ({ type, scope: null, breaking: false, subject, ...extra });

test("groups follow the fixed order and empty groups are omitted", () => {
  const groups = groupByType([c("chore", "z"), c("fix", "y"), c("feat", "x"), c("docs", "w")]);
  assert.deepEqual(
    groups.map((g) => g.type),
    ["feat", "fix", "docs", "chore"],
  );
});

test("breaking commits lead, and are not repeated in their own type group", () => {
  const groups = groupByType([c("feat", "small"), c("feat", "big", { breaking: true }), c("fix", "bug")]);
  assert.deepEqual(
    groups.map((g) => [g.type, g.commits.map((x) => x.subject)]),
    [
      ["breaking", ["big"]],
      ["feat", ["small"]],
      ["fix", ["bug"]],
    ],
  );
});

test("unknown types fold into other, after chore", () => {
  const groups = groupByType([c("wip", "a"), c("other", "b"), c("chore", "c")]);
  assert.deepEqual(
    groups.map((g) => [g.type, g.commits.map((x) => x.subject)]),
    [
      ["chore", ["c"]],
      ["other", ["a", "b"]],
    ],
  );
});

test("input order is preserved inside a group", () => {
  const [g] = groupByType([c("fix", "1"), c("fix", "2"), c("fix", "3")]);
  assert.deepEqual(
    g.commits.map((x) => x.subject),
    ["1", "2", "3"],
  );
});

test("does not mutate its input", () => {
  const input = Object.freeze([Object.freeze(c("fix", "a")), Object.freeze(c("feat", "b", { breaking: true }))]);
  assert.doesNotThrow(() => groupByType(input));
});

test("no commits, no groups", () => {
  assert.deepEqual(groupByType([]), []);
});
