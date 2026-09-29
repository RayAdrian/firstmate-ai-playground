# ex-2-1: Teach the agent four conventions it cannot guess

Lesson: 2.1 Project instructions (CLAUDE.md vs AGENTS.md).

## Goal
A tiny orders library follows four conventions that are not obvious from reading one file. There is no context file yet. Write the context files, then have the agent add a feature. Tests assert the conventions were followed.

## Setup
```bash
cp -r exercises/ex-2-1-conventions/starter ~/fm-ex/ex-2-1-conventions
cd ~/fm-ex/ex-2-1-conventions && npm i
```
No dependencies, so `npm i` is instant. Needs Node 20+.

## Steps
1. **Baseline.** Start the agent in the starter and ask: `Add an applyDiscountCents handler: takes a total in cents and a percent, returns the discounted total.` Do not tell it about any convention. Run `npm test` and see which rules it broke. Then re-copy the starter (or `git init && git add -A && git commit -m base` first so you can `git checkout .`).
2. **Write the context files.** Read `src/` and work out the four conventions, or let the agent draft them and then cut. Write `AGENTS.md`. Add `CLAUDE.md` containing `@AGENTS.md`.
3. **Confirm loading.** Claude Code: run `/context` and look under Memory files. Codex: start a fresh session and ask `Summarize your current instructions for this repo.`
4. **Add the feature in a fresh session** with the one-line prompt from step 1. The conventions must come from the files, not the prompt.
5. Run the verify command.

## What the tests check
- `test/conventions.test.js`: the four conventions hold across `src/` (passes on the starter, so it guards your feature).
- `test/apply-discount.test.js`: the feature works, is in its own kebab-case file and is registered.
- `test/context.test.js`: `AGENTS.md` exists and mentions each convention and the test command. If `CLAUDE.md` exists it must import `AGENTS.md`.

## Verify
```bash
npm test
```
Fails on the starter (no context files, no feature). Passes on the solution.
