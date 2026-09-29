# Orders service

Small Node ESM library. No build step, no dependencies.

## Commands
- Test: `npm test` (node:test). Run it before you say a task is done.

## Conventions (none of these are obvious from the code)
- **Money is integer cents.** Never use floats for money. Any function that takes or returns money ends in `Cents` (`getOrderTotalCents`), and so do money parameters and variables (`totalCents`).
- **Errors are `AppError`.** Import from `src/errors.js` and throw `new AppError("E_UPPER_SNAKE", "message")`. Never `throw new Error(...)`.
- **No `console.*`.** Log through `log(level, message, fields)` from `src/log.js`.
- **One handler per file.** Handlers live in `src/handlers/`, one kebab-case file each (`get-order-total.js`), exporting one function, and are registered in `src/handlers/index.js`.

## Done means
`npm test` is green, including `test/conventions.test.js`, and any new handler has its own test file.
