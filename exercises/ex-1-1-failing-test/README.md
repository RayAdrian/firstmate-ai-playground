# Exercise 1.1: Fix the failing slugify test

Lesson: `l1-first-session`. Time: about 20 minutes.

## Goal

`src/slugify.ts` turns a title into a URL slug. One of its four tests fails. Get the suite green with **Claude Code**, then again with **Codex CLI**, without editing the tests.

## Setup

Requires Node.js 22.18 or later (the tests are TypeScript and run with `node --test`, no build step and no dependencies).

```bash
cp -r exercises/ex-1-1-failing-test/starter ~/fm-ex/ex-1-1-failing-test
cd ~/fm-ex/ex-1-1-failing-test
git init && git add -A && git commit -m "starter"
npm i
npm test          # expect 1 failing test
```

## Steps

1. Run `npm test` yourself and read the failure.
2. Start Claude Code in the folder (`claude`) and use the starter prompt below. Approve or deny prompts as they appear. Note which permission mode you started in (status bar).
3. Run `/diff`, or `git diff`, and read every changed line. Check with `git diff --stat` that nothing under `test/` changed.
4. Commit the result on a branch, for example `git switch -c claude-fix && git commit -am "fix slugify"`.
5. Reset for the second run: `git switch main` (or `master`, whichever `git init` made). You are back at the failing starter.
6. Start Codex (`codex`) in the same folder with the same prompt. Read the diff again.
7. Quit one of the sessions, then resume it: `claude --continue` or `codex resume --last`. Ask a follow-up such as "explain the regex you changed".

## Starter prompt (both tools)

```text
Run `npm test` and tell me which test fails and why. Then fix the bug in
src/slugify.ts without editing anything under test/, and run `npm test`
again to confirm it is green.
```

## Verify

```bash
npm test
```

The command exits non-zero on the starter and zero on the reference solution. Then tick the checklist. The checklist covers the parts a test cannot: that you read the diff and that the tests were left alone.

## Compare

```bash
git diff --no-index exercises/ex-1-1-failing-test/starter exercises/ex-1-1-failing-test/solution
```
