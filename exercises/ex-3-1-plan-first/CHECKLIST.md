# Checklist

- [ ] {#c1} I got the plan from the agent in plan mode (or a read-only session) before any code was written.
- [ ] {#c2} The plan has Goal, Files to change, Steps, Risks and open questions, and Verification, and it says what is out of scope.
- [ ] {#c3} I checked the plan against the existing tests and found that the current `GET /items` returns a bare array, so changing the body shape would break callers.
- [ ] {#c4} The plan says what happens with invalid `limit` or `page` and with a page past the end.
- [ ] {#c5} I challenged or edited the plan at least once (a risk, an assumption or a step) before approving it.
- [ ] {#c6} `PLAN.md` was committed on its own, before the implementation commit.
- [ ] {#c7} The implementation touched only the files the plan named (checked with `git diff --stat`).
- [ ] {#c8} `npm test` passes, and `tests/pagination.test.js` and `tests/items.test.js` were not edited.
