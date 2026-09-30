# fm-capstone

A tiny todo library. Spec: `SPEC.md`. Plan: `PLAN.md`.

## Commands
- `npm test`: the test suite. It must pass before any push.
- `bash scripts/gate-status.sh <pr#> <browser|review|uiux> <success|failure> <sha> "<desc>"`: a gate agent posts its verdict as commit status `gate/<gate>` on `<sha>`, the commit it reviewed. `success` is refused if the PR head has moved past `<sha>`.
- `npm run gate:merge -- <pr#>`: merges (squash, pinned to the head SHA) only if all three gate statuses are `success` on that SHA, every CI check run succeeded, the branch is not behind `main`, and the three `gate:*-green` labels are present.

## Rules
- **Path ownership:** edit only the paths your workstream owns in `SPEC.md`. If you need something outside them, say so in your PR instead of editing it.
- **Test ownership:** tests for a criterion are written first, by the planner, on `main`. A worker turns them green and never weakens them.
- **Branch names:** `ws-<name>/<desc>`. One git worktree per branch. Rebase on `main` before the gates.
- **Gates:** `gate/browser` (here: `npm test` passes on the head commit), `gate/review` (review agent, no blocking findings), `gate/uiux` ("N/A: no UI changes" is a valid verdict). All three, on the exact head commit.
- **Any push invalidates earlier approvals.** Re-run the gates and post new statuses for the new head.
- Never merge with `gh pr merge` directly.
