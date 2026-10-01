# Contributing

Two kinds of change land here, through two different paths.

- **App code** (anything outside `content/workflows/`): read `AGENTS.md`. The PR needs three green gates on its exact head commit and merges with `npm run gate:merge -- <pr#>`.
- **A shared workflow** (one file under `content/workflows/`): see below. No AI gates; CI checks secrets and format, and a human merges.

## Share a workflow

A workflow is a setup that worked for you (a hook, a subagent, a gate script, the prompt that made it go), written down so another engineer can copy it. One markdown file, `content/workflows/<slug>.md`. The format is PRD section 16.6; `content/workflows/_TEMPLATE.md` is the skeleton.

> **Human review at merge is the only check for client names, client code, internal URLs and people. CI checks secrets and format, nothing else.**

### Fastest path: the skill (target: under 10 minutes)

From a checkout of this repo, run `/share-workflow` in Claude Code, or `$share-workflow` in Codex. It runs a preflight, asks three questions (what problem it solved, what changed, which files make up the setup), drafts the file with client detail generalised, scans it for secrets, asks you to type `client-safe`, and opens the PR. It never merges.

Codex note: `git push` and `gh pr create` need network access, which the default `workspace-write` sandbox blocks, so Codex will ask for approval at that step. If the Codex run still fails, use the manual path below.

### Manual path (6 steps)

1. Copy `content/workflows/_TEMPLATE.md` to `content/workflows/<slug>.md`. The slug is kebab-case, at most 60 characters.
2. Fill it in. Replace every `<placeholder>`; keep the `##` sections in order and no others.
3. Run `npm run workflows:validate` and `npm run workflows:scan -- content/workflows/<slug>.md`. Fix everything they print. The scan reports secret shapes, emails, IP addresses and absolute home paths; it never looks for client names.
4. Go through the checklist below. Only then set `client_safe: confirmed` in the frontmatter.
5. Create the branch `workflow/<slug>` and commit only that file.
6. Open the PR: `gh pr create --template workflow.md --label workflow`

### The client-safe checklist

You may set `client_safe: confirmed` only if all of these hold:

- no client or prospect names
- no client code copied verbatim
- no internal URLs, hostnames or ticket IDs
- no secrets or tokens
- no names of people outside First Mate

This covers the file, every commit message on the branch, the branch name and the PR body. If a secret was ever in a commit, rotate it: removing it from git does not un-leak it.

### Review and merge

The owner or a steward reviews within 3 business days (Mon-Fri, Asia/Manila) using the "Merger review" list in the PR template, then runs `npm run gate:merge -- <pr#>`. No approval, gate status or label is needed for a PR that touches only `content/workflows/`. A PR that also touches other paths is app code and goes through the three gates. `gate:merge` is the only merge path; do not use the merge button or `gh pr merge`.

Workflows age: after 60 days a "May be outdated" badge shows, after 180 days a workflow is archived. Re-verify by opening a PR that bumps `verified_on` and `tool_versions`. Report a broken one with the "Report outdated" link on its page.

### If something leaked

Follow `docs/runbooks/workflow-takedown.md` immediately and tell the owner.

### Repo notes

- One-time setup by the owner: create the `workflow` and `workflow-outdated` labels (`gh label create workflow`, `gh label create workflow-outdated`), otherwise `gh pr create --label workflow` fails.
- Q-WF3 (does this plan enforce branch protection and code-owner review on a private personal repo?) is not yet answered. Until it is, `gate:merge` is the enforcement. Record the answer here when checked.
