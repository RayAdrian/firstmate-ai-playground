# Checklist

- [ ] {#c1} I read the diff myself for a few minutes and wrote down what looked suspicious before running any AI review.
- [ ] {#c2} I ran a correctness review with a focused instruction (what matters, and what to ignore), not a bare "review this".
- [ ] {#c3} I ran a second, security-focused pass.
- [ ] {#c4} For every finding I wrote a verdict (real, false positive or unproven) and evidence: an input I ran or a failing test I wrote.
- [ ] {#c5} I ranked the findings by severity and did not treat a style-only or speculative finding as a blocker.
- [ ] {#c6} After triaging, I opened solution/ANSWERS.md and counted how many of the five seeded bugs the review found, and which it missed.
- [ ] {#c7} I noted at least one thing the review got wrong or missed, or explicitly confirmed it had none.
- [ ] {#c8} I can explain why all 9 existing tests passed while these bugs were present.
