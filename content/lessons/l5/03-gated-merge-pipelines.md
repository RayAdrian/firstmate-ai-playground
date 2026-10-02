---
slug: l5-gated-merge-pipelines
level: 5
sort: 3
title: "Gated merge pipelines"
objective: "Merge only when tests pass, an agent code review is green and a UI review is green, with every approval tied to the exact commit that was reviewed, using Claude Code and Codex CLI in scripts and GitHub Actions."
est_minutes: 55
tool_versions:
  claude_code: "2.1.284"
  codex_cli: "0.154.0"
last_verified_on: "2026-09-30"
differences:
  - "Claude Code has a managed Code Review for GitHub (Team and Enterprise, research preview) that posts inline findings and a check run that is always neutral, so it never blocks a merge by itself. Codex has the `openai/codex-action` you run in your own workflow; the pass or fail decision is always yours to write."
  - "Both tools return a verdict in a machine-readable shape when run headless: `claude -p --json-schema <schema>` and `codex exec --output-schema <file>`. Codex also writes the final message to a file with `-o`."
  - "Local review: Claude Code `/code-review` (`/review` is an alias) reviews the branch and any uncommitted changes and accepts a target such as a PR number. Codex has `/review` in a session and `codex review` on the command line with `--base <branch>`, `--commit <sha>` and `--uncommitted`."
  - "Secrets and permissions differ per action. `anthropics/claude-code-action@v1` takes `anthropic_api_key` (or `claude_code_oauth_token`); `openai/codex-action@v1` takes `openai-api-key` and a `safety-strategy` that defaults to `drop-sudo`."
exercise: ex-5-3-gates
claude_no_equivalent: false
codex_no_equivalent: false
tldr:
  points:
    - "Merge only when tests and reviews pass on the exact commit that was reviewed."
    - "Make the review agent return JSON with `reviewed_sha` and a verdict a script can check."
    - "Run the local review before you push: `/code-review`, or `codex review --base main`."
  try_this:
    claude: { kind: prompt, text: "/code-review" }
    codex: { kind: command, text: "codex review --base main" }
---

## Concept

An agent that opens a PR is fast. An agent that can also approve and merge its own PR is a liability. A gate is a rule a machine can check that stands between "done" and "merged", and where the checker is not the author.

This app merged every PR through three gates, all required, all on the exact head commit (PRD section 12):

| Gate | Checked by | Passes when |
|---|---|---|
| `gate/browser` | Playwright + axe, plus a manual look at 360, 768 and 1440px | The end-to-end suite is green on the fixtures |
| `gate/review` | A code-review agent | No unresolved blocking findings, including edits outside the owner's paths |
| `gate/uiux` | A UI/UX review agent | Hierarchy, states, accessibility and brand are fine, or the verdict is "N/A: no UI changes" |

A gate is a GitHub **commit status** named `gate/<gate>`. `scripts/gate-merge.sh` (run as `npm run gate:merge -- <pr#>`) is the only way to merge, and it refuses unless all of this is true for the current head:

1. All three gate statuses are `success` on that commit.
2. Every CI check run succeeded (skipped and neutral are allowed, and at least one must exist).
3. The branch is not behind `main`.
4. The three `gate:*-green` labels are present.
5. The merge itself is pinned to that commit with `gh pr merge --squash --match-head-commit "$SHA"`.

Never merge with `gh pr merge` directly. The point of the script is that nobody, human or agent, can skip a check by forgetting it.

### The lesson we learned: pin every approval to the reviewed commit

Our own code review of the gate scripts caught it: a gate approval that is not pinned to the commit that was reviewed can end up covering code nobody reviewed. This is the failure it prevents:

1. A review agent starts reviewing the PR at commit `A`, and takes a few minutes.
2. The author pushes commit `B` while the review runs.
3. The review finishes: "looks good". If the gate script then records success against *the PR's current head*, or just adds a `gate:review-green` label, the green now sits on `B`, which nobody reviewed.

The approval and the code it covers came apart. Labels make it worse: a label belongs to the PR, not to a commit, so it stays after every push.

The fix has three parts, all in the repo today:

- **The reviewer states which commit it reviewed**, and posts the status on that commit. `scripts/gate-status.sh <pr#> <gate> <state> <sha> "<desc>"` takes the SHA as an argument, and posts on that SHA, not on whatever head is current.
- **A success is refused if the head has moved.** From the script:

  ```bash
  HEAD="$(gh pr view "$PR" --json headRefOid --jq .headRefOid)"
  SHA="$(gh api "repos/$REPO/commits/$REVIEWED" --jq .sha)"
  if [[ "$STATE" == success && "$SHA" != "$HEAD" ]]; then
    echo "Refusing: PR #$PR head is ${HEAD:0:7}, not reviewed commit ${SHA:0:7}. Re-review the new head." >&2
    exit 1
  fi
  ```

- **The merge reads statuses on the current head and pins the merge to it.** Commit statuses are scoped to a SHA, so a push to `B` leaves `B` with no `gate/*` statuses at all until the gates re-run:

  ```bash
  SHA="$(gh pr view "$PR" --json headRefOid --jq .headRefOid)"
  STATUSES="$(gh api "repos/$REPO/commits/$SHA/status" --jq '.statuses[] | "\(.context)=\(.state)"')"
  # ... every gate/* must be "=success" ...
  gh pr merge "$PR" --squash --delete-branch --match-head-commit "$SHA"
  ```

  `--match-head-commit` closes the last gap: if someone pushes between the check and the merge, GitHub rejects the merge.

The rule that generalizes: **an approval is a claim about one specific commit.** Store the SHA with the verdict, compare it at merge time, and treat any push as invalidating every earlier approval. Also fail closed. "No statuses found" and "no CI ran" must block, not pass.

```diagram
type: lanes
id: pinned-approval
title: An approval covers one commit
summary: The review checked A. Once the head moves to B, success on A is refused, so B needs its own review.
lanes:
  - { id: author, label: Author }
  - { id: reviewer, label: Reviewer }
steps:
  - { id: review-a, lane: reviewer, col: 1, label: Review A }
  - { id: push-b, lane: author, col: 2, label: Push B }
  - { id: post-a, lane: reviewer, col: 3, label: Post success on A, sub: "refused: A not head", emphasis: true, style: risk }
handoffs:
  - { from: review-a, to: post-a, label: stale result }
marker: { col: 3, label: head moves to B, style: risk }
```

### Make the agent's verdict machine-readable

A gate cannot parse "Overall this looks pretty good, though you may want to…". Have the reviewer return a small JSON verdict and gate on the fields:

```json
{
  "type": "object",
  "required": ["reviewed_sha", "verdict", "findings"],
  "properties": {
    "reviewed_sha": { "type": "string" },
    "verdict": { "enum": ["pass", "fail"] },
    "findings": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["severity", "file", "summary"],
        "properties": {
          "severity": { "enum": ["blocking", "nit"] },
          "file": { "type": "string" },
          "summary": { "type": "string" }
        }
      }
    }
  }
}
```

The script then posts `success` only if `verdict` is `pass`, no finding is `blocking`, and `reviewed_sha` matches the head. Ask the reviewer to fill in `reviewed_sha` from `git rev-parse HEAD` in the checkout it reviewed.

### First Mate tip

Clients ask "how do I know an agent didn't ship something nobody looked at?" The answer is a merge gate that a person can read in a minute. Put the three-gate table and the "pinned to the reviewed commit" rule in the PR template and the client handbook, and keep the gate scripts in the repo so the client owns them. For an MVP with no UI, keep the `gate/uiux` status and set it to "N/A: no UI changes". A status that is always present is simpler to enforce than one that is sometimes optional.

## Claude Code

### Review locally, before you push

```text
/code-review
/code-review high
/code-review 142
/code-review main...my-feature
```

`/code-review` reviews your branch's commits ahead of its upstream plus uncommitted changes. You can pass a target: a file path, a PR number, a branch, or a ref range. `/review` is an alias. At `low` and `medium` effort it reports only the findings it is most confident in; `high` through `max` broaden coverage. `--fix` applies findings to the working tree, and `--comment` posts them on a GitHub PR as inline comments.

Put review-only rules in the repo. Claude Code's managed Code Review reads a `REVIEW.md` at the repo root, and the local command follows `CLAUDE.md` but does not read `REVIEW.md`:

```markdown
# Review instructions

**What Important means here.** Reserve Important for findings that would break behavior, leak
data, or edit files outside the owner's paths. Style is Nit at most.

**Do not report:**
- Anything CI already enforces: lint, formatting, type errors
- Generated files and lockfiles
```

### A verdict a script can use

```bash
SHA="$(git rev-parse HEAD)"
claude -p --model opus --effort high \
  --json-schema "$(cat schemas/verdict.json)" \
  --output-format json \
  "Review the changes on this branch against main at commit $SHA. Set reviewed_sha to $SHA. Do not edit files."
```

`--json-schema` validates the final output against your schema, and `--output-format json` returns one result object. Run it once by hand and look at where your verdict sits in that object before you write the parser.

Then the gate agent posts the verdict on that commit:

```bash
scripts/gate-status.sh 142 review success "$SHA" "no blocking findings (claude opus)"
```

### In GitHub Actions

`anthropics/claude-code-action@v1` runs Claude Code in a workflow. `/install-github-app` (inside Claude Code) sets up the app and the `ANTHROPIC_API_KEY` secret, or you add the secret yourself. A review on every PR:

```yaml
name: Claude review
on:
  pull_request:
    types: [opened, synchronize, ready_for_review, reopened]
jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      issues: read
      id-token: write
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 1
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: |
            Review PR #${{ github.event.pull_request.number }} at commit ${{ github.event.pull_request.head.sha }}.
            State the commit you reviewed on the first line.
          claude_args: "--max-turns 8"
```

Keep the key in `secrets`, never in the file, and cap cost with `--max-turns` and a workflow timeout. With a `prompt` the action runs without waiting for an `@claude` mention. On public repos, secrets are not passed to runs from fork PRs.

Anthropic also offers a managed **Code Review** (research preview, Team and Enterprise plans) that reviews each PR with several agents and posts inline findings and a **Claude Code Review** check run. That check run always completes as neutral so it never blocks a merge. To gate on it, read the severity counts from the check run yourself with `gh api` and turn them into your own `gate/review` status on the same commit.

### The UI gate

A UI/UX review agent needs to see the page. Give it a browser MCP (lesson 4.3) and a fixed checklist: screenshots at 360, 768 and 1440px, then hierarchy, empty and error states, contrast and keyboard access. When the diff touches no UI, its verdict is the literal text "N/A: no UI changes".

## Codex CLI

### Review locally

Inside a session, `/review` asks Codex to review your working tree. From the command line:

```bash
codex review --uncommitted          # staged, unstaged and untracked changes
codex review --base main            # this branch against main
codex review --commit 4e7d1a9       # what one commit introduced
codex exec review                   # the same review through the non-interactive command
```

`codex review` also takes custom instructions as a prompt argument (`-` reads them from stdin).

### A verdict a script can use

```bash
SHA="$(git rev-parse HEAD)"
codex exec --profile fm-plan \
  --output-schema schemas/verdict.json \
  -o verdict.json \
  "Review the changes on this branch against main at commit $SHA. Set reviewed_sha to $SHA. Do not edit files."
jq -e '.verdict == "pass" and .reviewed_sha == "'"$SHA"'"' verdict.json
```

`--output-schema` constrains the final response to your JSON Schema and `-o` writes it to a file. `fm-plan` is the read-only strong-model profile from lesson 5.1, so the reviewer cannot edit code. Then post the status exactly as in the Claude tab, on `$SHA`.

### In GitHub Actions

`openai/codex-action@v1` runs `codex exec` in a workflow. It needs an `openai-api-key` secret. `safety-strategy` controls how the runner is locked down and defaults to `drop-sudo`. The final message comes back as the `final-message` output and can be written to a file with `output-file`:

```yaml
name: Codex review
on:
  pull_request:
    types: [opened, synchronize, reopened]
jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
      - id: codex
        uses: openai/codex-action@v1
        with:
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          safety-strategy: read-only
          prompt: |
            Review this pull request at commit ${{ github.event.pull_request.head.sha }}.
            State the commit on the first line. Do not edit files.
      - name: Show the review
        env:
          REVIEW: ${{ steps.codex.outputs.final-message }}
        run: printf '%s\n' "$REVIEW" >> "$GITHUB_STEP_SUMMARY"
```

Note how the model's output goes through `env:` and not straight into the shell script. Text a model wrote, from a PR you did not write, is untrusted input.

The action's documentation splits the run into two jobs so the job that runs Codex has no permission to write to the PR, and a second job with `pull-requests: write` posts the comment. Do the same for anything you care about. An agent that reads untrusted PR text should not hold a write token.
