# ex-5-4-capstone: ship like First Mate

Ship one small feature to a real GitHub repo through the full loop: spec, plan, parallel worktrees, tests first, three gates, merge. This is manual: the PR artifacts and the checklist are the proof.

## Setup

Local setup needs only `git` and Node. A bare repository on disk plays the part of GitHub, so you can do every step that does not need GitHub itself.

```bash
mkdir -p ~/fm-ex && cp -r exercises/ex-5-4-capstone/starter ~/fm-ex/ex-5-4-capstone && cd ~/fm-ex/ex-5-4-capstone
git init -q -b main && git add -A && git -c user.name=fm-learner -c user.email=learner@example.com commit -q -m baseline
npm install
git init -q --bare ~/fm-ex/ex-5-4-capstone-remote.git
git remote add origin ~/fm-ex/ex-5-4-capstone-remote.git && git push -q -u origin main
npm test    # 3 passing tests: the baseline
```

### Optional: use GitHub for the gates (steps 7 to 9)

`gate-status.sh` and `gate-merge.sh` call GitHub, so gates and the gated merge need a real repo. Make it **private**, since First Mate client work never goes in a public repo, and needs `gh` authenticated (`gh auth login`):

```bash
gh repo create fm-capstone --private --source . --remote github --push
for l in gate:browser-green gate:review-green gate:uiux-green; do gh label create "$l"; done
```

Branch protection on a private repo needs a GitHub Team or Pro plan. Without it, `gate:merge` is still your only merge path by convention. The gate scripts in `scripts/` are the ones this app was built with: `gate-status.sh` posts a status on the commit that was reviewed, and `gate-merge.sh` (`npm run gate:merge`) refuses to merge unless everything is green on the head commit.

Local only? Do steps 1 to 6, then merge your branches into `main` yourself and skip the GitHub-dependent checklist items (marked "GitHub path").

## The feature (also in `FEATURE.md` inside the starter)

Add due dates to the todo library:

- `parseDue(input)` validates a `YYYY-MM-DD` date and throws `RangeError` otherwise.
- `addTodo(list, title, { due })` stores the due date. Without `due`, the todo is unchanged.
- `listOverdue(list, today)` lists open todos due strictly before `today`, earliest first.
- `formatTodo(todo, today)` prints `[ ] 1 Write spec (due 2026-10-05) OVERDUE`.

You still write the spec, the plan and the tests. The reference in `solution/` shows one way, not the only way.

## The loop

Run every step. Save the artifacts, since the checklist is checked against them.

1. **Instructions.** Fill in the `## Rules` section of `AGENTS.md`: path ownership, test ownership, branch names, the three gates, and what invalidates an approval.
2. **Spec.** Copy `SPEC_TEMPLATE.md` to `SPEC.md`. Write acceptance criteria with ids, exact interfaces, and two workstreams with explicit owned files. Commit it on `main`.
3. **Plan.** Use your strongest model in plan mode (Claude Code) or read-only (Codex) to draft `PLAN_TEMPLATE.md` as `PLAN.md`. Read it, edit it, then commit it.
4. **Tests first.** Have the strong model write a failing test for every P0 criterion, on `main`. Run `npm test` and confirm they fail for the right reason. Commit.
5. **Worktrees.** One per workstream, each on its own branch: `git worktree add ../fm-capstone-data -b ws-data/due-dates`. Start one implementation session (fast model) in each, with a brief that names owned paths and the tests to turn green.
6. **PRs.** Each worker rebases on `main`, runs `npm test`, pushes and opens a PR with the template filled in.
7. **Gates.** For each PR, on the head SHA: run the tests, run a review agent (`/code-review` or `codex review`), and post three statuses with `scripts/gate-status.sh`. Add the three labels. The UI/UX gate is "N/A: no UI changes".
8. **Break one on purpose.** On one PR, push a small extra commit after the gates are green. Confirm `npm run gate:merge` refuses, then re-run the gates on the new head.
9. **Merge.** `npm run gate:merge -- <pr#>` from the primary checkout, for both PRs, in the order your plan says.

## Verify

Manual. Work through `CHECKLIST.md` and keep these artifacts: `AGENTS.md` rules, `SPEC.md`, `PLAN.md`, the failing-test commit, two PR links with gate statuses, and the output of the refused merge from step 8.
