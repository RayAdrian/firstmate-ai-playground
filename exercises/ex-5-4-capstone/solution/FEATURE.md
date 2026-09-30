# The feature


Add due dates to the todo library:

- `parseDue(input)` validates a `YYYY-MM-DD` date and throws `RangeError` otherwise.
- `addTodo(list, title, { due })` stores the due date. Without `due`, the todo is unchanged.
- `listOverdue(list, today)` lists open todos due strictly before `today`, earliest first.
- `formatTodo(todo, today)` prints `[ ] 1 Write spec (due 2026-10-05) OVERDUE`.

You still write the spec, the plan and the tests. The reference in `solution/` shows one way, not the only way.

