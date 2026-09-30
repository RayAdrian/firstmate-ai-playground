# Answer key: open this after you have triaged

The five seeded bugs in `src/orders.js`:

1. **SQL injection** in `findOrdersByEmail` (line 5): the email is interpolated into the SQL string. This is the security issue. Rank it first.
2. **Off-by-one** in `listOrders` (line 10): pages are 1-based but the offset is `page * pageSize`, so page 1 skips the first page of rows.
3. **Float arithmetic on money** in `discountedTotal` (line 16): returns fractional cents for most inputs.
4. **Missing `await`** on `sendReceipt` in `completeOrder` (line 27): the `try/catch` never sees the rejection, so a failed email becomes an unhandled rejection.
5. **Refund cap ignores earlier refunds** in `refundOrder` (line 41): it compares with the order total, not the remaining refundable amount.

Score your review: how many did it flag, what did it miss, what was noise? `REVIEW.md` in this folder is a reference review with triggers and fixes for each one.
