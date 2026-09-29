# ex-3-3: Review a diff with seeded bugs

A teammate added order handling to a small app (`src/orders.js`) with tests. The tests pass. Five bugs got through, one of them a security issue. Your job is to find them with an AI review, then check the review's work.

## Setup

Needs Node 24 or newer (the project uses the built-in `node:sqlite`).

```bash
cp -r exercises/ex-3-3-review-seeded-bugs/starter ~/fm-ex/ex-3-3-review-seeded-bugs
cd ~/fm-ex/ex-3-3-review-seeded-bugs
git init -q && echo change.patch >> .git/info/exclude && git add -A && git commit -qm base
git apply --index change.patch
npm test   # 9 tests pass
```

After `git apply --index`, the change is staged but not committed, which is what `/code-review` and `codex review --uncommitted` review. `change.patch` is the same change as a diff, if you want to read it that way.

## Steps

1. **Read the diff yourself first**, for about five minutes. Write down anything suspicious. This is your baseline for judging the AI.
2. **Run a correctness review** with a focused instruction (the panel has prompts for both tools).
3. **Run a security review** as a second pass.
4. **Triage every finding** in a `REVIEW.md` file. For each one, write the verdict (real, false positive, or unproven) and the evidence: the input you ran, or the test you wrote that fails.
5. **Score the review.** How many of the five seeded bugs did it find? What did it miss? What was noise? Did your own read find anything it didn't?
6. Optional: fix one finding with a failing test first (lesson 3.2), and re-run the review.

## Verify

Manual. There is no script, because the point is your judgement about the findings. Work through `CHECKLIST.md`. The reference in `solution/REVIEW.md` shows what a good review of this diff catches. Look at it after you've triaged.

## Reference

`solution/` has the fixed code, tests that catch every bug, and a reference `REVIEW.md`. Running its tests against the buggy `src/orders.js` fails six tests, one or more per finding.
