# ex-3-2: TDD with an agent

You own the tests. The agent owns the implementation. Verify fails if the tests change between the two.

## The rules (write your tests from these)

`priceOrder(items, options)` returns integer cents. `items` is `[{ sku, unitPriceCents, qty }]`. `options` is `{ tier?: "standard" | "gold", coupon?: string }`.

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

## Setup

```bash
cp -r exercises/ex-3-2-tdd/starter ~/fm-ex/ex-3-2-tdd
cd ~/fm-ex/ex-3-2-tdd
git init -q && git add -A && git commit -qm starter
```

## Steps

1. **Write the tests** in `tests/pricing.test.js` (three are there to get you started). Cover every rule, both sides of each boundary, and the invalid inputs. Name tests so the rule is obvious. Run `npm test` and confirm they fail because the code is missing, not because the tests are broken. You can have an agent draft tests, but read every assertion yourself.
2. **Lock them**: `npm run lock-tests`, then `git add -A && git commit -m "Add pricing tests and lock"`.
3. **Set the guard**, then implement with the agent. Give it the prompt from the panel: the tests are the contract, don't touch them, stop and explain if a test looks wrong.
4. **Verify**: `npm run verify`.
5. **Try to break it.** Edit an assertion in `tests/`, run `npm run verify`, and watch it fail on the lock. Then `git checkout -- tests/`.

## Verify

```bash
npm run verify
```

It checks three things in order:

1. `tests.lock` exists and matches the hash of everything under `tests/`. On the starter, the lock doesn't exist yet, so this fails.
2. There are at least 12 tests, no `skip`/`todo`/`only`, and the test titles mention every rule: subtotal, volume, gold, coupon, shipping, vat, empty, invalid.
3. `npm test` passes.

This is a floor, not a grade. The checklist asks whether your tests are good.

## Reference

`solution/` has a full test file, its lock, and the implementation.
