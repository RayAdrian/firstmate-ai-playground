# Plan: <feature name>

Written by the planning model, reviewed by you, committed before any implementation starts.

## Tasks
| # | Task | Workstream | Depends on | Test written first |
|---|---|---|---|---|
| 1 | | | | |

## Order of work
1. Tests from the spec's acceptance criteria (planning model).
2. Worktrees, one per workstream (implementation model, in parallel).
3. Rebase on `main`, then the three gates.
4. Merge with `npm run gate:merge`.

## Risks and shared resources
<Anything two workstreams could collide on: files, ports, a database, a lock.>

## Definition of done
- [ ] All acceptance criteria have a passing test
- [ ] Three gates green on the head commit
- [ ] Merged with `npm run gate:merge`
