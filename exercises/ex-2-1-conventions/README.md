# ex-2-1: Teach the agent four conventions it cannot guess

Lesson: 2.1 Project instructions (CLAUDE.md vs AGENTS.md).

## Goal
A tiny orders library follows four conventions that are not obvious from reading one file. There is no context file yet. Write the context files, then have the agent add a feature. Tests assert the conventions were followed.

## Setup
```bash
mkdir -p ~/fm-ex
cp -r exercises/ex-2-1-conventions/starter ~/fm-ex/ex-2-1-conventions
cd ~/fm-ex/ex-2-1-conventions && npm i
```
No dependencies, so `npm i` is instant. Needs Node 20+.

## Steps
1. **Baseline.** Start the agent in the starter with the feature prompt below and no context file. Run `npm test`, then `npm run verify`, and note which conventions it broke. Then re-copy the starter (`rm -rf ~/fm-ex/ex-2-1-conventions` and run the setup again).

   Feature prompt: `Add a handler applyDiscountCents(totalCents, percent) in src/handlers/apply-discount.js. It takes a percent off the total and rounds to whole cents. A percent outside 0..100 fails with the error code E_INVALID_PERCENT. Add a test for it.`
2. **Write the context files.** Read `src/` and work out the four conventions, or let the agent draft them and then cut. Write `AGENTS.md`. Add `CLAUDE.md` containing `@AGENTS.md`.
3. **Confirm loading.** Claude Code: run `/context` and look under Memory files. Codex: start a fresh session and ask `Summarize your current instructions for this repo.`
4. **Add the feature in a fresh session** with the feature prompt from step 1. The conventions must come from the files, not the prompt.
5. Run the verify command.

## What the verify step checks
The checks live in `.verify/`. Try not to read them before you have written your context files: they spell out the conventions you are meant to work out from `src/`.
- `.verify/conventions.test.js`: the four conventions hold across `src/`.
- `.verify/apply-discount.test.js`: the feature works, sits in its own kebab-case file and is registered.
- `.verify/context.test.js`: `AGENTS.md` exists and mentions each convention and the test command. If `CLAUDE.md` exists it must import `AGENTS.md`.
- `test/`: the tests your agent writes, plus the existing order-total tests.

## Verify
```bash
npm run verify
```
Fails on the starter (no context files, no feature). Passes on the solution. Needs Node 21+.
