# ex-4-2: Parallel work with git worktrees

Two independent features, two agent sessions, one repo. Each session gets its own worktree so they cannot overwrite each other's files.

- Feature A: `formatPrice` in `src/format-price.js`
- Feature B: `parseDuration` in `src/parse-duration.js`

## Setup

```bash
cp -r exercises/ex-4-2-worktrees/starter ~/fm-ex/ex-4-2-worktrees
cd ~/fm-ex/ex-4-2-worktrees
git init -b main && git add -A && git commit -m "starter"
npm test        # red: both features are stubs
```

No dependencies to install.

## What to do

1. Create two worktrees next to the repo, each on a new branch:

   ```bash
   git worktree add ../ex-4-2-price -b feat/format-price
   git worktree add ../ex-4-2-duration -b feat/parse-duration
   ```

   (Claude Code can also create one, but it names the branch `worktree-<name>` and branches from the remote default branch, which this local-only repo does not have. Stick to `git worktree add` here.)
2. Start one agent session per worktree, in two terminals. Use Claude Code in one and Codex in the other if you like.
3. Give each session a scope fence (see the starter prompts). Each also adds one line under "Unreleased" in `CHANGELOG.md`, so you will meet a small merge conflict on purpose.
4. When both are green and committed, merge them into `main`:

   ```bash
   git switch main
   git merge --no-ff feat/format-price
   git merge --no-ff feat/parse-duration   # CHANGELOG.md conflicts: keep both lines
   ```
5. Clean up: `git worktree remove ../ex-4-2-price` and the same for the other, then `git branch -d` both branches.

## Verify

```bash
node scripts/verify.mjs
```

It runs every test on the merged checkout, rejects leftover conflict markers, checks that `CHANGELOG.md` has an entry for each feature, and (in your own git repo) that a merge commit exists.
