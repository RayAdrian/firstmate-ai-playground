# Checklist

- [ ] {#c1} I wrote or reviewed every test myself, and ran them to see them fail because the code was missing.
- [ ] {#c2} Every rule has a test, and both sides of each boundary are covered (qty 9, 10, 49 and 50; coupon net 1999 and 2000; shipping net 4999 and 5000).
- [ ] {#c3} I tested invalid input and the empty order, not only the happy path.
- [ ] {#c4} I ran `npm run lock-tests` and committed the tests and `tests.lock` before the agent implemented anything.
- [ ] {#c5} The agent was told the tests are the contract, and I protected them (a deny rule, a read-only path, or an instruction in AGENTS.md or CLAUDE.md).
- [ ] {#c6} If the agent said a test was wrong, I decided what to do; it didn't decide for me.
- [ ] {#c7} `npm run verify` passes.
- [ ] {#c8} I edited one assertion on purpose and confirmed `npm run verify` fails, then reverted it.
