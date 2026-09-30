# ex-3-3: Review a diff with seeded bugs

A teammate added order handling to a small app (`src/orders.js`) with tests. The tests pass. Bugs got through (there are five), one of them a security issue. Your job is to find them with an AI review, then check the review's work.

## Setup

Needs Node 22.13 or newer (the project uses the built-in `node:sqlite`).

```bash
mkdir -p ~/fm-ex && rm -rf ~/fm-ex/ex-3-3-review-seeded-bugs ~/fm-ex/ex-3-3-origin.git   # safe to re-run
cp -r exercises/ex-3-3-review-seeded-bugs/starter ~/fm-ex/ex-3-3-review-seeded-bugs
cd ~/fm-ex/ex-3-3-review-seeded-bugs
G="git -c user.name=fm -c user.email=fm@example.com"
git init -q -b main && echo change.patch >> .git/info/exclude && git add -A && $G commit -qm baseline
git init -q --bare ../ex-3-3-origin.git && git remote add origin ../ex-3-3-origin.git
git push -q origin main && git remote set-head origin main
git checkout -q -b feature/orders
git apply --index change.patch && $G commit -qm 'Add order handling'
npm install && npm test   # 9 tests pass
```

The seeded change is committed on `feature/orders`, and a local bare repo acts as `origin` with `main` as its default branch. That is what `/security-review` needs: it diffs committed changes against `origin/HEAD`. Review the branch with `/code-review high main...feature/orders` (Claude Code) or `/review` with "Review against a base branch" and `main` (Codex). `change.patch` is the same change as a diff, if you want to read it that way.

## Steps

1. **Read the diff yourself first**, for about five minutes. Write down anything suspicious. This is your baseline for judging the AI.
2. **Run a correctness review** with a focused instruction (the panel has prompts for both tools).
3. **Run a security review** as a second pass.
4. **Triage every finding** in a `REVIEW.md` file. For each one, write the verdict (real, false positive, or unproven) and the evidence: the input you ran, or the test you wrote that fails.
5. **Score the review.** How many of the five seeded bugs did it find? What did it miss? What was noise? Did your own read find anything it didn't?
6. Optional: fix one finding with a failing test first (lesson 3.2), and re-run the review.

## Verify

Manual. There is no script, because the point is your judgement about the findings. Work through `CHECKLIST.md`. It describes the review process, not the bugs. `solution/ANSWERS.md` lists the five seeded bugs and `solution/REVIEW.md` is a reference review; open them only after you've triaged.

## Reference

`solution/` has the fixed code, tests that catch every bug, and a reference `REVIEW.md`. Running its tests against the buggy `src/orders.js` fails six tests, one or more per finding.
