import { test } from "node:test";
import assert from "node:assert/strict";
import { addTodo, completeTodo, listOpen, listOverdue } from "../src/todos.mjs";

test("addTodo appends an open todo with the next id", () => {
  const list = addTodo(addTodo([], "write spec"), "write tests");
  assert.deepEqual(list, [
    { id: 1, title: "write spec", done: false },
    { id: 2, title: "write tests", done: false },
  ]);
});

test("completeTodo marks one todo done without mutating the input", () => {
  const list = Object.freeze([Object.freeze({ id: 1, title: "a", done: false })]);
  assert.deepEqual(completeTodo(list, 1), [{ id: 1, title: "a", done: true }]);
});

test("listOpen hides done todos", () => {
  const list = completeTodo(addTodo(addTodo([], "a"), "b"), 1);
  assert.deepEqual(
    listOpen(list).map((t) => t.title),
    ["b"],
  );
});

test("A-2: addTodo stores a validated due date, and no due key without one", () => {
  const [withDue] = addTodo([], "a", { due: "2026-10-05" });
  assert.equal(withDue.due, "2026-10-05");
  const [without] = addTodo([], "b");
  assert.ok(!("due" in without));
  assert.throws(() => addTodo([], "c", { due: "soon" }), RangeError);
});

test("A-3: listOverdue returns open todos due strictly before today, sorted by due then id", () => {
  let list = [];
  list = addTodo(list, "late-2", { due: "2026-09-20" });
  list = addTodo(list, "on-time", { due: "2026-10-01" });
  list = addTodo(list, "late-1", { due: "2026-09-10" });
  list = addTodo(list, "no-due");
  list = addTodo(list, "late-done", { due: "2026-09-01" });
  list = completeTodo(list, 5);
  list = addTodo(list, "late-2b", { due: "2026-09-20" });
  assert.deepEqual(
    listOverdue(list, "2026-10-01").map((t) => t.title),
    ["late-1", "late-2", "late-2b"],
  );
  assert.throws(() => listOverdue(list, "yesterday"), RangeError);
});

test("A-5: listOverdue does not mutate its input", () => {
  const list = Object.freeze([Object.freeze({ id: 1, title: "a", done: false, due: "2026-01-01" })]);
  assert.equal(listOverdue(list, "2026-10-01").length, 1);
});
