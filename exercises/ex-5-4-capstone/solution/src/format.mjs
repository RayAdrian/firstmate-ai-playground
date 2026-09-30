import { parseDue } from "./due.mjs";

/** One line per todo: "[ ] 1 Write spec (due 2026-10-05) OVERDUE". */
export function formatTodo(todo, today) {
  const cutoff = parseDue(today);
  let line = `[${todo.done ? "x" : " "}] ${todo.id} ${todo.title}`;
  if (todo.due !== undefined) line += ` (due ${todo.due})`;
  if (!todo.done && todo.due !== undefined && todo.due < cutoff) line += " OVERDUE";
  return line;
}
