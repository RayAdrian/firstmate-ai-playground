# Review of the orders change

Scope: `src/orders.js` and `tests/orders.test.js` as added in `change.patch`. The existing tests pass, and none of the five findings below is caught by them. The fixes in this folder come with a test for each finding.

Verdict: do not merge. One security issue and four correctness bugs.

## 1. SQL injection in `findOrdersByEmail` (security, critical)

`src/orders.js:5` builds the query with a template literal: `... WHERE user_email = '${email}' ...`. Any caller who controls `email` controls the SQL.

- Trigger: `findOrdersByEmail(db, "x' OR '1'='1")` returns every customer's orders. `'; DROP TABLE orders; --` is also worth testing against a real driver that allows stacked statements.
- Impact: data exposure across customers, and modification or loss of data.
- Fix: a bound parameter, `db.prepare("... WHERE user_email = ? ORDER BY id").all(email)`.

## 2. Off-by-one in `listOrders` (bug, high)

`src/orders.js:10`: `const offset = page * pageSize;` but the doc comment says pages are 1-based. Page 1 skips the first `pageSize` orders, so the first page of results is never returned.

- Trigger: `listOrders(db, { page: 1, pageSize: 2 })` returns ids 3 and 4, not 1 and 2.
- Why tests missed it: the only test checks the length of the page, not which rows are in it.
- Fix: `(page - 1) * pageSize`, and reject `page < 1`.

## 3. Fractional cents in `discountedTotal` (bug, medium)

`src/orders.js:16`: `totalCents * (1 - percent / 100)` returns a float for most inputs. The rest of the code treats money as integer cents.

- Trigger: `discountedTotal(999, 10)` returns `899.1`.
- Impact: values that can't be charged or stored as integer cents, plus totals that differ from what other code computes.
- Why tests missed it: the inputs (10000 and 2500) happen to divide evenly.
- Fix: `Math.round((totalCents * (100 - percent)) / 100)`, with the rounding rule stated in one place.

## 4. Missing `await` on `sendReceipt` in `completeOrder` (bug, high)

`src/orders.js:27`: `sendReceipt(order)` returns a promise and isn't awaited. The `try/catch` around it can never catch a rejection, so a failed email becomes an unhandled promise rejection. Node's default is to crash the process on that. The "log and carry on" behaviour the comment promises doesn't exist.

- Trigger: complete an order whose `user_email` has no `@`.
- Fix: `await sendReceipt(order)`. The order is already saved by then, so a failure is logged and the function still returns.

## 5. Refund cap ignores earlier refunds in `refundOrder` (bug, high, money)

`src/orders.js:41`: `amountCents > order.total_cents` compares against the full total, not what remains. The doc comment says the sum of all refunds may never exceed the total.

- Trigger: refund 6000 of a 10000 order, then refund 5000. The second call succeeds and `refunded_cents` becomes 11000.
- Fix: compare with `order.total_cents - order.refunded_cents`.

## Not worth blocking on

- `findOrdersByEmail` and `listOrders` have no upper bound on result size. Add `pageSize` limits before this is exposed to clients, but that is a follow-up, not a bug in this change.
- `completeOrder` isn't wrapped in a transaction with the status update. Fine while the only failure is the email, which is deliberately non-fatal.

## What a good review of this diff does

- Reads the doc comments as the spec and checks each function against its own comment (findings 2, 4 and 5).
- Notices the tests pass but never assert the risky behaviour (all five).
- Ranks the SQL injection first, with a concrete input that triggers it.
- Reports what it can't confirm as a question, not as a defect.
