## Summary
Adds `parseDue`, `addTodo(..., { due })` and `listOverdue` (A-1, A-2, A-3, A-5). Workstream `data`.

## Workstream and owned paths
Workstream: data

Paths this PR touches (must all be owned by the workstream in SPEC.md):
- `src/due.mjs`
- `src/todos.mjs`
- `tests/due.test.mjs`
- `tests/todos.test.mjs`

- [x] I edited no files outside my owned paths

## Merge gates
- [x] **Browser** (`gate:browser-green`): `npm test` passes on the head commit
- [x] **Code review agent** (`gate:review-green`): no unresolved blocking findings
- [x] **UI/UX** (`gate:uiux-green`): N/A: no UI changes

Head SHA reviewed: `9c41e07` (example; yours will differ)

```
$ bash scripts/gate-status.sh 1 browser success 9c41e07 "npm test: 12 pass, 0 fail"
gate/browser=success on 9c41e07...
$ bash scripts/gate-status.sh 1 review success 9c41e07 "no blocking findings"
gate/review=success on 9c41e07...
$ bash scripts/gate-status.sh 1 uiux success 9c41e07 "N/A: no UI changes"
gate/uiux=success on 9c41e07...
$ npm run gate:merge -- 1
All gates green for PR #1 at 9c41e07. Merging (squash).
```

## Test evidence
```
$ npm test
ℹ tests 12
ℹ pass 12
ℹ fail 0
```
