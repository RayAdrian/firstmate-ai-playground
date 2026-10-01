# Runbook: workflow takedown (a leaked client detail or secret)

PRD section 16.10.4. Use this when a file under `content/workflows/` (or its history, commit messages, branch name or PR body) holds a client detail or a secret. Who: the repo owner or a steward. Target: contained within 1 hour of the report.

## 1. Contain (within 1 hour)

1. **If a secret leaked, rotate it first.** Removing it from git does not un-leak it.
2. Compute the `content_hash` (SHA-256 of the full file) of **every version** of the file in history, before any rewrite:

   ```bash
   # --name-only prints the path the file had in each commit, so versions under an earlier name are hashed too
   git log --follow --name-only --format='commit %H' -- content/workflows/<slug>.md |
     awk '/^commit /{c=$2; next} NF{print c, $0}' |
     while read -r c f; do git show "$c:$f" 2>/dev/null | shasum -a 256 | cut -d' ' -f1; done | sort -u
   ```

   If the seed stores a different hash than the one above, use the seed's definition (W1's `content_hash`) so the purge matches.
3. Open a content-lane PR that deletes the file and appends those hashes, one per line, to `content/workflows/_takedowns.txt`. Never put the slug or a hash of the slug there.
4. Merge it with `npm run gate:merge -- <pr#>` as soon as CI is green.

## 2. Rewrite history

Announce a merge freeze first: every SHA after the leak changes, so open PRs, worktrees and per-SHA gate statuses must be redone.

On a fresh mirror clone, remove the file or the term from every commit and force-push the affected refs:

```bash
git clone --mirror <repo-url> takedown.git && cd takedown.git
git filter-repo --invert-paths --path content/workflows/<slug>.md      # remove the file
# or: git filter-repo --replace-text replacements.txt                  # remove a term
git push --force --all && git push --force --tags
```

## 3. Purge GitHub's copies

PR refs and cached diffs survive a force-push. File a GitHub Support request to remove them; the account cannot do this itself.

## 4. Purge local copies

Tell every engineer to re-clone (or hard-reset to the rewritten `main`), delete old worktrees and branches, and run `npm run seed`. The seed hard-deletes any row whose `content_hash` is in `_takedowns.txt` (WF-43). This is the only hard delete in the system.

## 5. Notify

The engagement lead for the affected client decides on client notification under the client agreement, within 24 hours of the report.

## 6. Prevent

- Secret leaked: add a gitleaks rule for its pattern.
- Client detail leaked: add the specific miss to the "Merger review" wording in `.github/PULL_REQUEST_TEMPLATE/workflow.md` and tell the stewards. There is no client-name list to update.

## 7. Record

Add an entry to the incident log below: date, what class of detail, how it got past the checks. **Do not name the client.**

## Incident log

| Date | Class of detail | How it got past the checks |
|---|---|---|
| (none yet) | | |
