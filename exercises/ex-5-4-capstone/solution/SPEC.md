# Spec: due dates and overdue listing

## Goal
A todo can have a due date. People can list what is overdue and see it flagged when a todo is printed.

## Acceptance criteria

| ID | Priority | Criterion |
|---|---|---|
| A-1 | P0 | `parseDue("2026-10-05")` returns `"2026-10-05"`. Anything that is not a real calendar date in `YYYY-MM-DD` form throws a `RangeError` (for example `"2026-02-30"`, `"10/05/2026"`, `""`, `undefined`). |
| A-2 | P0 | `addTodo(list, title, { due })` stores a validated `due` on the new todo. Without `due`, the todo has no `due` key at all, so existing todos are unchanged. |
| A-3 | P0 | `listOverdue(list, today)` returns open todos whose `due` is strictly before `today`, sorted by `due` ascending then `id`. Done todos and todos without `due` are never overdue. `today` is validated with `parseDue`. |
| A-4 | P0 | `formatTodo(todo, today)` renders `[ ] <id> <title>`, or `[x]` when done, followed by ` (due <date>)` when there is a due date, and ` OVERDUE` when the todo is open and overdue. |
| A-5 | P1 | Nothing mutates its input. |

## Interfaces

```js
// src/due.mjs
parseDue(input: unknown): string            // "YYYY-MM-DD" or throws RangeError

// src/todos.mjs (extended)
addTodo(list, title, opts?: { due?: string }): Todo[]
listOverdue(list: Todo[], today: string): Todo[]

// src/format.mjs
formatTodo(todo: Todo, today: string): string
```

## Non-goals
Time zones, recurring todos, persistence, a CLI.

## Workstreams and file ownership

| Workstream | Branch | Owns (explicit paths) |
|---|---|---|
| data | `ws-data/due-dates` | `src/due.mjs`, `src/todos.mjs`, `tests/due.test.mjs`, `tests/todos.test.mjs` |
| format | `ws-format/overdue-flag` | `src/format.mjs`, `tests/format.test.mjs` |

`format` depends only on the `Todo` shape and `parseDue`'s contract, not on `data`'s code. It uses `parseDue` through a stub until `data` merges, so the two branches never touch the same file.
