import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTodo } from "../src/format.mjs";

const today = "2026-10-01";

test("A-4: an open todo without a due date", () => {
  assert.equal(formatTodo({ id: 1, title: "Write spec", done: false }, today), "[ ] 1 Write spec");
});

test("A-4: a done todo is ticked", () => {
  assert.equal(formatTodo({ id: 2, title: "Ship", done: true }, today), "[x] 2 Ship");
});

test("A-4: a due date is shown, and an open todo past due is flagged", () => {
  assert.equal(formatTodo({ id: 3, title: "Soon", done: false, due: "2026-10-05" }, today), "[ ] 3 Soon (due 2026-10-05)");
  assert.equal(formatTodo({ id: 4, title: "Late", done: false, due: "2026-09-30" }, today), "[ ] 4 Late (due 2026-09-30) OVERDUE");
});

test("A-4: due today is not overdue, and a done todo is never flagged", () => {
  assert.equal(formatTodo({ id: 5, title: "Today", done: false, due: today }, today), "[ ] 5 Today (due 2026-10-01)");
  assert.equal(formatTodo({ id: 6, title: "Was late", done: true, due: "2026-01-01" }, today), "[x] 6 Was late (due 2026-01-01)");
});
