# Handoff: report.js refactor

Written at the end of session 1. Session 2 starts from this file, not from chat history.

## Done
- Part 1: `parseRows` extracted to `src/parse.js`. `test/part1-parse.test.js` is green.

## Next
- Part 2: extract `formatMoney(cents)` to `src/format.js`. Replace both copies of the dollars/cents string building.
- Part 3: extract `renderReport(rows)` to `src/render.js` (it must import `formatMoney`), then reduce `src/report.js` to a facade: `generateReport = csv => renderReport(parseRows(csv))`.
- Run `npm test` after each part. Commit after each part.

## Constraints
- `generateReport(csv)` output stays byte-identical (golden test: `test/constraints.test.js`).
- Do not edit anything under `test/fixtures/`.
- No new dependencies. Plain ESM JavaScript, no `require()`.
- Do not change the test files' assertions to make them pass.

## Decisions and gotchas
- `amountCents` is integer cents everywhere. Do not introduce floats.
- Trailing newline on the report is part of the golden output.
