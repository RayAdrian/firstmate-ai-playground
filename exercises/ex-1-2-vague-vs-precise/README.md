# Exercise 1.2: Vague prompt vs spec-quality prompt

Lesson: `l1-prompting-for-code`. Time: about 30 minutes.

## Goal

Implement `parseDateRange(input, today)` twice with the same agent. Attempt A uses a vague prompt. Attempt B uses a spec-quality prompt. Then compare the diffs and run the hidden edge-case tests against both.

## Setup

Requires Node.js 22.18 or later. No dependencies.

```bash
mkdir -p ~/fm-ex && cp -R exercises/ex-1-2-vague-vs-precise/starter ~/fm-ex/ex-1-2-precise && cp -R exercises/ex-1-2-vague-vs-precise/starter ~/fm-ex/ex-1-2-vague && rm ~/fm-ex/ex-1-2-vague/SPEC.md && for d in ex-1-2-vague ex-1-2-precise; do (cd ~/fm-ex/$d && git init -q && git add -A && git -c user.name=learner -c user.email=learner@example.com commit -qm start && npm install); done
```

Each folder has three visible tests (`npm test`) and a dot-folder `.hidden/` with the edge cases. **Do not open `.hidden/` and do not point the agent at it.** Doing so defeats the exercise.

## Attempt A: vague (in `~/fm-ex/ex-1-2-vague`)

Give the agent only this, in either tool:

```text
add a date range parser
```

Approve its work, then run `npm test`. It should pass the three visible tests.

## Attempt B: precise (in `~/fm-ex/ex-1-2-precise`)

Use the starter prompt below. It follows the lesson's four parts: goal, context (`@SPEC.md`, `@src/parseDateRange.ts`), constraints (no edits to `basic.test.ts`, no dependencies) and a done-when the agent can run. It also asks for tests first, so the agent verifies against the spec instead of against your patience.

```text
Implement parseDateRange in @src/parseDateRange.ts exactly as described in
@SPEC.md. First add tests in test/spec.test.ts for every input form and every
error case in the spec, run them and watch them fail. Then implement. Do not
edit test/basic.test.ts and add no dependencies. Done when `npm test` passes.
```

## Verify

Run this from each folder. The command runs the visible tests and the hidden edge cases together:

```bash
node --test "test/*.test.ts" ".hidden/*.test.ts"
```

Expect attempt A to fail some hidden tests and attempt B to pass all of them. Write down A's failure count.

## Compare

```bash
git diff --no-index ~/fm-ex/ex-1-2-vague/src ~/fm-ex/ex-1-2-precise/src
```

Also diff against the reference:

```bash
git diff --no-index exercises/ex-1-2-vague-vs-precise/starter exercises/ex-1-2-vague-vs-precise/solution
```

Ask of each diff: which behaviors did the agent guess? Which of them would a client have caught only in production?

## Notes

- If attempt A passes every hidden test, look at what it did: it may have found `SPEC.md` or `.hidden/`. Restart it from a clean copy.
- The point is not that vague prompts always fail. It is that requirements the prompt never states cannot be met reliably.
