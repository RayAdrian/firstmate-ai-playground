# ex-2-3: Make the agent run typecheck and lint without being asked

Lesson: 2.3 Self-verifying agents: encode your feedback loop.

## Goal
`npm test` is green, but `npm run typecheck` and `npm run lint` fail. An agent that only runs the tests will report success and leave the errors. Encode the loop in a context file so it verifies its own work without being asked.

## Setup
```bash
mkdir -p ~/fm-ex
cp -r exercises/ex-2-3-feedback-loop/starter ~/fm-ex/ex-2-3-feedback-loop
cd ~/fm-ex/ex-2-3-feedback-loop && npm i
```
Installs TypeScript and `@types/node` only. The linter is a small local script (`scripts/lint.mjs`) to keep installs fast; in a real project this would be ESLint or Biome.

## Steps
1. Run `npm test`, `npm run typecheck`, `npm run lint`. Note the gap.
2. Give the agent the starter prompt with no context file. Does it run typecheck or lint on its own? Write down what it reported.
3. Write `AGENTS.md`: the commands in order, a definition of done, and what the agent must not do. Add `CLAUDE.md` with `@AGENTS.md`.
4. Reset the code to the starter (`rm -rf` your working copy, run the setup again, and copy your `AGENTS.md`/`CLAUDE.md` back in). Start a fresh session and send the same prompt again.
5. Run the verify command.

## Verify
```bash
npm install --no-audit --no-fund --no-package-lock --silent && npm run verify
```
`npm run verify` runs typecheck, lint, tests, a spec check for `truncate` (in `.verify/`) and a check that `AGENTS.md` names the three commands, has a "done" heading and says what not to do. Fails on the starter, passes on the solution.
