# Plan: due dates and overdue listing

Written by the planning model (Opus 5.5 / the strong Codex profile), reviewed by a human, committed before any implementation.

## Tasks
| # | Task | Workstream | Depends on | Test written first |
|---|---|---|---|---|
| 1 | Write tests for A-1 to A-5 from SPEC.md, on `main`, all failing | planner | none | yes, this is the task |
| 2 | `parseDue` | data | 1 | `tests/due.test.mjs` |
| 3 | `addTodo` with `due`, `listOverdue` | data | 2 | `tests/todos.test.mjs` |
| 4 | `formatTodo` | format | 1 | `tests/format.test.mjs` |

Tasks 2-3 (workstream `data`) and task 4 (workstream `format`) run in parallel worktrees.

## Order of work
1. Tests first, committed on `main`. Confirm they fail for the right reason.
2. Two worktrees, one per workstream, each with a brief that names its owned paths and the failing tests it must turn green.
3. Each worker rebases on `main`, runs `npm test`, and opens a PR.
4. Three gates per PR on the exact head commit. Merge each PR with `npm run gate:merge`.

## Risks and shared resources
- `src/format.mjs` needs `parseDue` before `data` has merged. Mitigation: `format` merges after `data`, or rebases onto it. The plan chooses: merge `data` first.
- No shared database or ports in this repo, so nothing needs a lock.

## Definition of done
- [x] A-1 to A-5 each have a passing test
- [x] Three gates green on the head commit of each PR
- [x] Both PRs merged with `npm run gate:merge`
