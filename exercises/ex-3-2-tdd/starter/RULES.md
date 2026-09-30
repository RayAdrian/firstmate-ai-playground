# Pricing rules

Write your tests in `tests/pricing.test.js` from these rules.

`priceOrder(items, options)` in `src/pricing.js` returns integer cents. `items` is `[{ sku, unitPriceCents, qty }]`. `options` is `{ tier?: "standard" | "gold", coupon?: string }`.

1. **Subtotal**: the sum of `unitPriceCents * qty` over all lines.
2. **Volume discount, per line**: qty 50 or more gets 20% off that line, qty 10 to 49 gets 10%, otherwise 0. Only the best applicable rate applies (no stacking).
3. **Gold tier**: an extra 5% off the amount left after volume discounts. `standard` gets nothing.
4. **Coupon `WELCOME500`**: 500 cents off, but only when the amount after volume and gold discounts is at least 2000. Below that the coupon is ignored (no error). Any other coupon code throws `Error("Unknown coupon: ...")`.
5. **Net** = subtotal minus volume, tier and coupon discounts.
6. **Shipping**: 0 when net is at least 5000 or the order is empty, otherwise 499. It is decided after all discounts.
7. **VAT**: 12% of net (shipping is not taxed).
8. **Total** = net + shipping + VAT.
9. **Rounding**: every percentage rounds to the nearest cent, halves up.
10. **Invalid input** throws `RangeError`: `qty` not an integer >= 1, `unitPriceCents` not a non-negative integer, or an unknown `tier`.
11. An empty order returns all zeros.

The result has these fields: `subtotalCents`, `volumeDiscountCents`, `tierDiscountCents`, `couponDiscountCents`, `netCents`, `shippingCents`, `vatCents`, `totalCents`.

## Workflow

1. Write the tests. Cover every rule, both sides of each boundary, the invalid inputs and the empty order. Name tests so the rule is obvious (`npm run verify` checks that titles mention: subtotal, volume, gold, coupon, shipping, vat, empty, invalid). Run `npm test` and confirm they fail because the code is missing.
2. Lock and commit them: `npm run lock-tests`, then `git add -A && git commit -m "Add pricing tests and lock"`.
3. Ask the agent to implement `src/pricing.js` with the tests protected (see the starting prompt).
4. `npm run verify`.
