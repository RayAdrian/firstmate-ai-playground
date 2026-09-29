import { test } from "node:test";
import assert from "node:assert/strict";
import { addTodo, completeTodo, listOpen } from "../src/todos.mjs";

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
