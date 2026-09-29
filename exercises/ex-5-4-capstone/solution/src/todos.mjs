// A tiny todo list. Lists are plain arrays and every function returns a new array.
import { parseDue } from "./due.mjs";

export function addTodo(list, title, opts = {}) {
  const todo = { id: list.length + 1, title, done: false };
  if (opts.due !== undefined) todo.due = parseDue(opts.due);
  return [...list, todo];
}

export function completeTodo(list, id) {
  return list.map((todo) => (todo.id === id ? { ...todo, done: true } : todo));
}

export function listOpen(list) {
  return list.filter((todo) => !todo.done);
}

export function listOverdue(list, today) {
  const cutoff = parseDue(today);
  return listOpen(list)
    .filter((todo) => todo.due !== undefined && todo.due < cutoff)
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.id - b.id));
}
