# Feedback-loop demo

JavaScript (ESM) with JSDoc types, checked by tsc (`checkJs`). Node 20+.

## Verify your own work
Passing tests are not enough in this repo. Type errors and lint errors do not fail the tests.
Run these from the repo root, in this order, and read the output:

1. `npm run typecheck` (tsc --noEmit, strict)
2. `npm run lint` (house rules: no console, no var, no `==`, no explicit any)
3. `npm test`

`npm run verify` runs all of them plus a context check.

## Definition of done
A task is done only when `npm run typecheck`, `npm run lint` and `npm test` all exit 0, including for files you did not touch. If one fails, fix it and re-run. Show the final output when you report back.

## Rules
- Never weaken a check to get green: no `@ts-ignore`, no `any`, no editing `tsconfig.json` or `scripts/lint.mjs`, no deleting or loosening tests.
- Do not add dependencies.
- Log through `src/log.js`, not `console`.
