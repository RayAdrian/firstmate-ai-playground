---
slug: l3-ai-code-review
level: 3
sort: 3
title: AI code review
objective: Run a local AI review with Claude Code /review and /security-review or Codex /review, give it review instructions, and triage the findings instead of trusting them.
est_minutes: 25
tool_versions:
  claude_code: "2.1.284"
  codex_cli: "0.154.0"
last_verified_on: "2026-09-30"
differences:
  - "In Claude Code 2.1.284, `/review` is an alias of `/code-review`, which reviews for correctness bugs and accepts an effort level and `--fix`. `/security-review` is a separate command that checks the branch diff for vulnerabilities. Codex `/review` is one command with presets, and the documented slash commands have no separate security review."
  - "Claude Code's review can apply its own fixes (`--fix`). Codex `/review` reports prioritized findings without changing your working tree."
  - "Custom review focus goes in different places. Claude Code's local review follows your CLAUDE.md but does not read REVIEW.md, which is for the managed GitHub Code Review. Codex `/review` takes custom review instructions directly, and `## Code Review Rules` in AGENTS.md is documented for GitHub PR reviews."
  - "Scope is chosen differently. Claude Code takes a target argument (a file path, PR number, branch or ref range such as `main...my-feature`). Codex `/review` presets are base branch, uncommitted changes, a specific commit, or custom instructions."
exercise: ex-3-3-review-seeded-bugs
claude_no_equivalent: false
codex_no_equivalent: false
tldr:
  points:
    - "Run a local review before you push, then check each finding against the code."
    - "Tell the reviewer what counts as a bug and what to skip, such as formatting CI covers."
    - "Run security as its own pass: `/security-review`, or a security-focused `codex review` prompt."
  try_this:
    claude: { kind: prompt, text: "/code-review high" }
    codex: { kind: command, text: "codex review --uncommitted" }
---

## Concept

An AI review is a cheap second reader. It reliably catches things tired humans skip: a missing `await`, an off-by-one, string-built SQL. It also produces plausible false alarms and misses whatever needs business context. Use it before you ask a human, not instead of one.

Passing tests don't mean the code is right. A reviewer reads for what the tests don't say.

**Give it a job.** "Review this" gets generic advice. Say what matters: correctness on money and permissions, data handling, error paths, and things your CI already enforces should be excluded. The best instructions name a bar ("only report what would break production") and what to skip ("ignore formatting").

**Two passes beat one.** Run a correctness review, then a security review. A reviewer looking for everything at once weights style and security equally.

**Triage every finding.** For each one:

1. **Reproduce it.** Write a failing test or run the input. If you can't trigger it, treat it as unproven.
2. **Classify it**: must fix now, fix later, or false positive. Say why for the false positives so the next instruction can exclude them.
3. **Fix one finding per commit** and re-run tests, so a bad fix is easy to revert.
4. **Ask for a re-review** after fixes. Fixes introduce their own bugs.

Never let a reviewer's confidence substitute for reproduction. Tone is not evidence.

```diagram
type: flow
id: finding-triage
title: Triaging an AI review finding
summary: A finding you cannot reproduce is unproven, whatever the reviewer's tone. Only a reproduced finding gets classified and fixed.
steps:
  - id: finding
    label: Finding
    sub: from review
  - id: repro
    label: Reproduce
    sub: test or input
    emphasis: true
  - id: classify
    label: Classify
    sub: rank it
  - id: fix
    label: Fix
    sub: one per commit
exits:
  - from: repro
    label: no repro
    text: Unproven
    style: risk
  - from: classify
    label: false alarm
    text: Note why
    style: ok
```

### First Mate tip

For a client MVP, run the security pass on anything that handles auth, payments, file uploads or raw SQL before it goes to the client's staging. It costs a few minutes. Keep the triage notes (finding, verdict, evidence) in the PR description. Clients and later maintainers see that the review happened and what was decided.

## Claude Code

Commands, from the commands reference:

- `/code-review [low|medium|high|xhigh|max|ultra] [--fix] [--comment] [pr#|branch|path]` reviews the current diff, or a PR, branch or path you pass, for correctness bugs. It reviews your branch's commits ahead of its upstream plus uncommitted changes.
- `/review` is an alias with the same levels and flags. (Before v2.1.223 it was a separate read-only PR review, so older tutorials differ.)
- `/security-review` analyzes the changes on your current branch for vulnerabilities such as injection, auth issues and data exposure. It diffs committed changes against origin's default branch (`git diff origin/HEAD...`), so it needs an `origin` remote and the work committed on a branch. Staged or uncommitted changes are invisible to it, and without `origin` it fails with an `ambiguous argument` error.

```text
/code-review high
/code-review main...my-feature
/security-review
```

At `low` and `medium` you get fewer, higher-confidence findings. `high` through `max` broaden coverage and may include findings the review is less sure about. With no level given, it reuses the last level you typed.

The review runs as a background subagent with its own context window, and the findings arrive in your conversation when it finishes. Pass `--fix` to apply findings to your working tree. Those edits are not undone by `/rewind`, so use git to revert them.

**Instructions.** The local review follows your `CLAUDE.md`, like any session. Put durable rules there:

```markdown
## Review focus
- Money is integer cents. Flag any float arithmetic on amounts.
- Every database query must be parameterised.
- Ignore formatting; CI runs prettier.
```

`REVIEW.md` at the repo root is read by the managed GitHub Code Review (a Team and Enterprise research-preview feature), not by the local `/code-review`.

You can also ask in plain language, and Claude will run the skill:

```text
Review my uncommitted changes. Only report bugs that would break behaviour,
with file:line and how to trigger each one. Then run /security-review.
```

For a deep multi-agent review in the cloud, `/code-review ultra` (alias `/ultrareview`) exists, but it needs a claude.ai account and can bill usage credits after the free runs. Start with the local levels.

## Codex CLI

Type `/review` in a session to open the review presets. Codex starts a dedicated reviewer that reads the selected diff and reports prioritized, actionable findings without changing your working tree.

The CLI presets are:

- **Review against a base branch**: finds the merge base and reviews your branch diff.
- **Review uncommitted changes**: staged, unstaged and untracked files.
- **Review a commit**: the exact change set for one commit.
- **Custom review instructions**: focus the review on criteria you provide.

The review appears as a turn in the transcript. Follow up with `/diff` to inspect exact file changes. By default it uses the session model; set `review_model` in `config.toml` to use a different one.

The same review runs non-interactively, which suits scripts and CI:

```bash
codex review --uncommitted
codex review --base main
codex review --commit <SHA>
codex review "Review the changes on this branch against main. Only report bugs that would break behaviour. Money is integer cents; flag float math. Every SQL query must be parameterised. Ignore formatting."
```

In 0.154.0 the scope flags (`--uncommitted`, `--base`, `--commit`) and the custom-instructions prompt are mutually exclusive: `codex review --base main "..."` fails with `the argument '--base <BRANCH>' cannot be used with '[PROMPT]'`. Use a scope flag alone, or a prompt alone with the scope described in it (`-` reads the prompt from stdin). `codex exec review` is the same review under `exec`.

Codex's documented slash commands have no dedicated security review, so run a second pass with custom instructions:

```bash
codex review "Security review of this branch's diff against main only: injection, authn/authz gaps, secrets in code, unsafe deserialisation, unvalidated input reaching queries, data exposure in logs or errors. For each finding give file:line and how to exploit it."
```

For reviews on GitHub pull requests (`@codex review`), Codex reads a `## Code Review Rules` section from the `AGENTS.md` closest to the changed code. The docs recommend two or three concise, repository-specific rules and leaving lint and formatting to CI.
