# ex-5-2-team: an orchestrator and three workers

Build a small feature with one orchestrator session and three worker sessions, each in its own git worktree, with no merge conflicts.

## Setup

```bash
cp -r exercises/ex-5-2-team/starter ~/fm-ex/ex-5-2-team && cd ~/fm-ex/ex-5-2-team && npm i
git init -b main && git add -A && git commit -m "starter"
npm test    # fails on purpose
```

## The feature

`SPEC.md` describes a release-notes generator in three independent parts plus a glue file. The interfaces are fixed and the tests in `tests/` are the acceptance criteria:

| Part | File | Test |
|---|---|---|
| A: parse commit lines | `src/parse.mjs` | `tests/parse.test.mjs` |
| B: group by type | `src/group.mjs` | `tests/group.test.mjs` |
| C: render markdown | `src/render.mjs` | `tests/render.test.mjs` |
| Glue | `src/index.mjs` | `tests/integration.test.mjs` |

## The process

You play orchestrator. Do these in order:

1. **Ownership first.** Fill in `OWNERSHIP.json`: three workers (name, branch, owned files) and the orchestrator's glue file. Every file in `src/` has exactly one owner. No worker owns a test file. Commit it on `main` before you create any worktree.
2. **Worktrees.** One per worker, from the same commit:
   ```bash
   git worktree add ../ex-5-2-parser   -b feat/parse
   git worktree add ../ex-5-2-grouper  -b feat/group
   git worktree add ../ex-5-2-renderer -b feat/render
   ```
   Use your own names, and keep them in sync with `OWNERSHIP.json`.
3. **Dispatch.** Start one agent session per worktree (Claude Code, Codex, or a mix). Give each a brief that names its owned file, the spec section, the frozen tests, and the handoff note it must write. Run them in parallel.
4. **Handoff by file.** Each worker commits its owned file and `handoffs/<name>.md` (a `## Done` section and a `## Test output` section with the real output).
5. **Integrate.** Back on `main`, merge the branches one at a time and run `npm test` after each. Then write `src/index.mjs` yourself.

If a worker needs a change in a file it does not own, it says so in its handoff. It does not edit the file.

## Verify

```bash
npm test
```

This runs the feature tests and `tests/ownership.test.mjs`, which checks that ownership is complete and disjoint, the handoff notes exist and contain test output, and no conflict markers are left behind. It cannot check that you really ran the workers in parallel, so the checklist asks you to confirm it.
