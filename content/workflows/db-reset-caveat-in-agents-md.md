---
title: Document the db-reset caveat in AGENTS.md
problem: E2E resets wipe your working dev data, and agents forget to restore it.
tools: [claude-code]
use_cases: [context, testing]
stacks: [supabase, nextjs]
related_lesson: l2-feedback-loops
tool_versions:
  claude_code: 2.1.286
verified_on: 2026-10-01
client_safe: confirmed
---

## Result

### Before
`npm run db:reset:test` loads end-to-end fixtures into the same local database the developer uses by hand. After an agent's e2e run, the dev server showed fixture data instead of the real seeded content, and nobody noticed until a page looked wrong.

### After
The caveat and the restore command live in the context file and in every worker brief: after any e2e run or reset, run `npm run seed && npm run news:import`. Agents end each database task with the restore step and say so in their report, so the working database is back to normal when they finish.

## Setup

```markdown path=AGENTS.md kind=context-file
### Database caveat
`npm run db:reset:test` and the e2e run replace the local database contents with test fixtures.
This is the same database used for manual development.
- Run reset and e2e one at a time (all worktrees share one stack): `scripts/db-lock.sh <command>`.
- After ANY e2e run or db:reset:test, restore the working data: `npm run seed && npm run news:import`.
- Never run `supabase db reset`; migrations are applied already.
- Say in your final report that you restored the database, or why you did not need to.
```

## Prompt

```text
You will run the e2e suite. Read AGENTS.md "Database caveat" first.
Run the suite with `scripts/db-lock.sh npm run e2e`. Immediately afterwards, even if tests failed,
run `scripts/db-lock.sh npm run seed` and `scripts/db-lock.sh npm run news:import`.
Confirm the home page shows real content again, and include that confirmation in your report.
```

## Steps

1. Add the "Database caveat" section to `AGENTS.md` with the exact restore commands for your project.
2. Copy the same two lines into every worker or gate brief that runs tests.
3. Ask for the restore confirmation in each final report.
4. When a page looks wrong after agent runs, run the restore commands before debugging anything else.

## Why it works

Agents only know what the context file tells them, and a reset command's side effect on shared data is invisible from its name. Stating the side effect, the exact repair command and a reporting requirement in one place makes the cleanup part of the task instead of a favour someone remembers.
