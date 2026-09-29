# ex-4-1: Subagents

`src/cart.js` has four bugs and `npm test` is red. Before you fix anything, build two scoped subagents and use them.

## Setup

```bash
cp -r exercises/ex-4-1-subagents/starter ~/fm-ex/ex-4-1-subagents
cd ~/fm-ex/ex-4-1-subagents
git init && git add -A && git commit -m "starter"   # so the reviewer has a diff to read
npm test                                            # red
```

There are no dependencies to install.

## What to do

1. Define a `test-runner` subagent. It runs `npm test` and reports PASS or FAIL plus each failing test's name and assertion message. It must not be able to edit files.
2. Define a `reviewer` subagent. It reads `git diff` and reports bugs and missing edge cases. It must be read-only.
3. In the main session, ask for the test run to be delegated to `test-runner`. Fix `src/cart.js` yourself (with the agent) from its report.
4. Before you finish, delegate a review of the diff to `reviewer` and triage what it says.

Define the agents in whichever tool you are using. Doing it in both tools is the better exercise.

| | Claude Code | Codex CLI |
|---|---|---|
| Where | `.claude/agents/<name>.md` (Markdown, YAML frontmatter) | `.codex/agents/<name>.toml` |
| Required fields | `name`, `description` | `name`, `description`, `developer_instructions` |
| Limit its power | `tools:` list | `sandbox_mode = "read-only"` |

## Rules

- Do not edit anything under `tests/`.
- Give each subagent an explicit, minimal capability set.

## Verify

```bash
npm test
```

It is green when the cart tests pass and `tests/subagents.test.js` finds valid definitions. Then work through `CHECKLIST.md`. The checklist covers what a script cannot see, such as whether the delegation actually happened.
