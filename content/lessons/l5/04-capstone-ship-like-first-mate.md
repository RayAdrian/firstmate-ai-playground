---
slug: l5-capstone
level: 5
sort: 5
title: "Capstone: ship like First Mate"
objective: "Run the full loop end to end, from spec to plan to parallel worktrees to test-first implementation to three gates to a gated merge, using the same process that built this app, in both Claude Code and Codex CLI."
est_minutes: 120
tool_versions:
  claude_code: "2.1.284"
  codex_cli: "0.154.0"
last_verified_on: "2026-09-30"
differences:
  - "The pipeline (spec, ownership, worktrees, commit statuses, gate script) is git and GitHub, so it is the same for both tools. Only the commands that start the agents differ."
  - "Planning: Claude Code uses plan mode (`--permission-mode plan`, or the `opusplan` model alias). Codex uses `/plan` or a read-only profile, which returns the plan as text for you to save."
  - "Dispatching workers: `claude --worktree <name>` creates the worktree for you. With Codex you run `git worktree add` and then `codex exec -C <dir>`."
  - "Agent review: `/code-review` in Claude Code, `codex review --base main` in Codex. Either can supply the `gate/review` verdict as long as the status is posted on the commit that was reviewed."
exercise: ex-5-4-capstone
claude_no_equivalent: false
codex_no_equivalent: false
---

## Concept

This lesson has no new tool feature. It is the process that built this app, run once by you on a small feature. The three lessons before it were the parts. Now you run the whole loop.

### The loop

| # | Step | Who does it | Artifact |
|---|---|---|---|
| 1 | **Spec.** Goal, numbered acceptance criteria, exact interfaces, non-goals, file ownership per workstream | You, with the strong model | `SPEC.md` (this app: `docs/PRD.md`, ACs like L-2 and P-1) |
| 2 | **Plan.** Tasks, order, shared resources, risks. Read it, edit it | Strong model in plan or read-only mode, then you | `PLAN.md` |
| 3 | **Tests first.** A failing test for every P0 criterion, on `main` | Strong model | Commit of red tests (this app: `docs/test-cases/`, written before implementation) |
| 4 | **Worktrees.** One per workstream, each with an owned-path brief | Orchestrator | `git worktree list` |
| 5 | **Implement.** Turn the red tests green, inside owned paths only | Fast model, in parallel | One PR per workstream |
| 6 | **Rebase.** On the current `main`, so the gates test what will actually merge | Worker | Rebased branch |
| 7 | **Three gates.** Browser or test run, agent code review, UI/UX review, each a status on the head SHA | Independent gate agents | `gate/browser`, `gate/review`, `gate/uiux` |
| 8 | **Merge.** Only through the gate script, pinned to the head commit | You | Squash-merged PR |

The order is not decoration. Each step makes the next one cheaper:

- The spec makes the plan checkable. The plan makes ownership explicit. Ownership makes parallel work conflict-free.
- Tests before code give the fast model an objective target, which is what makes it safe to give the implementation to the cheaper model.
- Gates on the head commit make it safe to let agents open PRs at all.

```diagram
type: flow
id: capstone-loop
title: The loop from spec to merge
summary: Each step makes the next one cheaper, and a red gate sends you back to build; a moved main sends you back to rebase. Either way the head commit changes, so the gates run again.
steps:
  - { id: spec, label: "Spec + plan" }
  - { id: tests, label: Tests first }
  - { id: build, label: Build }
  - { id: rebase, label: Rebase }
  - { id: gates, label: Three gates, emphasis: true }
loops:
  - { from: gates, to: build, label: "red: new commit" }
  - { from: gates, to: rebase, label: "main moved" }
exits:
  - { from: gates, label: pass, text: gate:merge, style: ok }
```

### How this app went through it

The foundation (M0) ran first, alone, and froze the contracts, migrations and shared test helpers. Six workstreams then ran in six worktrees, and five more content workstreams ran beside them, each owning a directory. Opus split the tasks, enforced path ownership, wrote test cases from the acceptance criteria before any implementation, and did the code and UI reviews. Sonnet implemented and ran tests. Every PR went through three gates and `npm run gate:merge`.

### What goes wrong, and what stops it

| Failure | What stops it |
|---|---|
| Two workers edit the same file | Explicit file ownership, and the review gate checking for edits outside owned paths |
| An interface changes mid-build | Contracts frozen after the foundation milestone; changes only in a dedicated PR |
| Workers trample a shared database or port | A lock around shared commands and one assigned port per worker |
| A worker weakens a test to go green | Tests written first by someone else, on `main`; review flags edited tests |
| An approval covers code nobody reviewed | Statuses pinned to the reviewed SHA; merge pinned with `--match-head-commit` |
| A push after approval slips through | Any push invalidates earlier approvals; the gate script needs statuses on the new head |
| `main` moved while the PR waited | Merge refuses if the branch is behind `main`; rebase, then re-run the gates |
| Nothing failed because nothing ran | The merge script blocks when there are no CI check runs |

### Know when a gate is red for the right reason

When a gate fails, read the finding before you touch the code. A blocking review finding is usually right. A flaky end-to-end test is not a reason to weaken the gate: fix the test, or re-run it and record why. Whatever you change, the fix is a new commit, which means new gates on the new head.

### First Mate tip

Run the capstone on a real but low-stakes internal repo before the first client engagement, then keep its `AGENTS.md`, PR template, gate scripts and worker brief as your starting kit. A client MVP does not need all ceremony on day one. It does need three things from the first commit: an ownership table, tests before code, and a merge that only happens through a gate. The rest, such as extra workstreams and a UI review, can be added when the team grows. Once the loop runs, add a few evals for your `AGENTS.md` and a baseline of lead time (lesson 5.4), so you can show the process helps.

## Claude Code

### 1 to 3: spec, plan, tests on the strong model

```bash
claude --model opus --permission-mode plan
```

```text
Read AGENTS.md and SPEC_TEMPLATE.md. We are adding due dates to the todo library. Stay in plan
mode. Draft SPEC.md: numbered P0 acceptance criteria, exact function signatures, non-goals, and
two workstreams with explicit file ownership. Show it to me before you write PLAN.md.
```

Edit the plan yourself, then leave plan mode and have it write the files. Or set `"model": "opusplan"` (lesson 5.1) so plan mode uses Opus and execution uses Sonnet automatically. For the tests:

```text
Write a failing test for every P0 criterion in SPEC.md. Do not write any implementation. Run npm test
and show me that each new test fails for the right reason.
```

Commit `SPEC.md`, `PLAN.md` and the red tests on `main` before you branch.

### 4 and 5: worktrees and workers on the fast model

```bash
claude --worktree ws-data --model sonnet
claude --worktree ws-format --model sonnet
```

Run each in its own terminal, or dispatch them headlessly:

```bash
claude -p --worktree ws-data --model sonnet "$(cat briefs/data.md)"
```

A brief names owned paths, the failing tests to turn green, "do not edit tests/", and the exact final reply you want back (PR URL, head SHA, test counts, anything you needed outside owned paths, under 200 words).

### 6 and 7: rebase and gates

```bash
git fetch origin && git rebase origin/main && git push --force-with-lease
```

Gate agents are separate sessions, so the author does not grade its own work. Each one records the SHA it reviewed and posts the status on that SHA:

```bash
SHA="$(gh pr view 1 --json headRefOid --jq .headRefOid)"
test "$(git rev-parse HEAD)" = "$SHA" || { echo "checkout is not the PR head"; exit 1; }
npm test                  # gate/browser for this repo: the suite on the head commit
```

```text
/code-review main...HEAD
```

```bash
bash scripts/gate-status.sh 1 browser success "$SHA" "npm test: 12 pass, 0 fail"
bash scripts/gate-status.sh 1 review  success "$SHA" "no blocking findings"
bash scripts/gate-status.sh 1 uiux    success "$SHA" "N/A: no UI changes"
gh pr edit 1 --add-label gate:browser-green --add-label gate:review-green --add-label gate:uiux-green
```

If the review agent runs for minutes, capture `SHA` **before** it starts and pass that same value at the end. If the head moved in between, `gate-status.sh` refuses a `success`, and you re-review.

### 8: merge

```bash
npm run gate:merge -- 1
```

From the primary checkout. Then try the negative test: push one more commit to a green PR and run it again. It must refuse.

## Codex CLI

### 1 to 3: spec, plan, tests on the strong model

Use the plan profile from lesson 5.1:

```bash
codex --profile fm-plan
```

```text
/plan Read AGENTS.md and SPEC_TEMPLATE.md. We are adding due dates to the todo library. Do not edit
code. Draft SPEC.md: numbered P0 acceptance criteria, exact function signatures, non-goals, and two
workstreams with explicit file ownership. Show it to me before anything else.
```

A read-only sandbox cannot write files, so the spec comes back as text. Save it yourself, or run the writing step with a workspace-write sandbox:

```bash
codex -m <frontier-model> -s workspace-write "Write SPEC.md from the draft above, then write a failing test for every P0 criterion. No implementation. Run npm test and show each new test failing."
```

Commit `SPEC.md`, `PLAN.md` and the red tests on `main`.

### 4 and 5: worktrees and workers on the fast model

```bash
git worktree add ../fm-capstone-data   -b ws-data/due-dates
git worktree add ../fm-capstone-format -b ws-format/overdue-flag
mkdir -p handoffs

codex exec -C ../fm-capstone-data   --profile fm-impl -o "$PWD/handoffs/data.md"   "$(cat briefs/data.md)"   &
codex exec -C ../fm-capstone-format --profile fm-impl -o "$PWD/handoffs/format.md" "$(cat briefs/format.md)" &
wait
```

`fm-impl` is the fast, workspace-write profile from lesson 5.1. Each brief is the same shape as in the Claude tab.

### 6 and 7: rebase and gates

```bash
git fetch origin && git rebase origin/main && git push --force-with-lease
SHA="$(gh pr view 1 --json headRefOid --jq .headRefOid)"
test "$(git rev-parse HEAD)" = "$SHA" || { echo "checkout is not the PR head"; exit 1; }
npm test
codex review --base main
```

`codex review --base main` reviews the branch against `main`. Read its findings; if none are blocking, post the same three statuses and labels as in the Claude tab, on `$SHA`. To have a script decide, use `codex exec --output-schema` as in lesson 5.3 and check that `reviewed_sha` equals `$SHA`.

### 8: merge

```bash
npm run gate:merge -- 1
```

Same script, same refusal if the head moved. That is the point of putting the gate in git and GitHub rather than in either tool.
