# Checklist

What a good review catches, and what a good reviewer (you) does with it.

- [ ] {#c1} The review flagged the SQL built by string interpolation in `findOrdersByEmail`, and I ranked it as the most serious finding.
- [ ] {#c2} The review flagged the off-by-one in `listOrders` (1-based pages, but the offset is `page * pageSize`).
- [ ] {#c3} The review flagged float arithmetic on money in `discountedTotal`.
- [ ] {#c4} The review flagged the missing `await` on `sendReceipt`, so the `try/catch` around it does nothing.
- [ ] {#c5} The review flagged that `refundOrder` checks against the order total instead of the remaining refundable amount.
- [ ] {#c6} I ran a second, security-focused pass after the correctness pass.
- [ ] {#c7} For every finding I wrote a verdict and evidence (an input I ran or a failing test), rather than accepting the tool's wording.
- [ ] {#c8} I noted at least one thing the review missed or got wrong, or explicitly confirmed it had none.
- [ ] {#c9} I did not treat a style-only or speculative finding as a blocker.
- [ ] {#c10} I can explain why all 9 existing tests passed while these bugs were present.
