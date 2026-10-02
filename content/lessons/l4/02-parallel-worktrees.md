---
slug: l4-parallel-worktrees
level: 4
sort: 2
title: "Parallel work with git worktrees"
objective: "Run 2-3 agent sessions in isolated git worktrees, merge them cleanly and avoid file-overlap conflicts."
est_minutes: 30
tool_versions:
  claude_code: "2.1.284"
  codex_cli: "0.154.0"
last_verified_on: "2026-09-30"
differences:
  - "Claude Code has a first-class flag: `claude --worktree <name>` creates `.claude/worktrees/<name>` on a new branch `worktree-<name>`, and, for a session with changes, prompts you to keep or remove it on exit. For Codex CLI, the dependable route is plain `git worktree add` plus a session started inside it."
  - "Codex documents its managed worktrees mainly for the ChatGPT desktop app: they live under `$CODEX_HOME/worktrees` in a detached `HEAD` state. `codex --help` in 0.154.0 also lists a `--worktree` flag, but it is experimental and needs `--enable worktrees`."
  - "Gitignored files (`.env`, `node_modules`) are not in a new worktree. Claude Code copies files matching `.worktreeinclude` into worktrees it creates. Codex applies `.worktreeinclude` only to app-managed worktrees, not to ones you create with git."
  - "Claude Code subagents can each run in their own worktree with `isolation: worktree` in their frontmatter. The Codex docs describe no per-agent worktree setting, so run separate sessions instead."
exercise: ex-4-2-worktrees
claude_no_equivalent: false
codex_no_equivalent: false
tldr:
  points:
    - "Run parallel agents in separate `git worktree` checkouts, one branch each."
    - "Give each agent different files, so merges do not conflict."
    - "A new worktree has no `.env` or `node_modules`; set them up before you start."
  try_this:
    all: { kind: command, text: "git worktree list" }
---

## Concept

Two agents editing the same folder will overwrite each other's files, run each other's half-finished code and leave you with a diff nobody can explain. A **git worktree** fixes that. It is a second checkout of the same repository in another directory, on its own branch. The history and remotes are shared, but the files are separate.

```bash
git worktree add ../myapp-search -b feat/search     # new directory, new branch
git worktree add ../myapp-export -b feat/export
git worktree list                                    # every checkout and its branch
git worktree remove ../myapp-search                  # when you are done
```

One rule from git: a branch can be checked out in only one worktree at a time.

**What makes parallel work go well**

1. **Independent tasks only.** If task B needs task A's result, run them in order. Parallel agents are for work that touches different code.
2. **Two or three sessions, not ten.** You still review every diff. Your attention, not the CPU, is the limit.
3. **A scope fence in each prompt.** Name the files a session may touch and the ones it must not. Agents wander into shared code unless told not to.
4. **Find the shared files before you start.** Lockfiles, route or export barrels, migrations, `CHANGELOG.md` and generated files are where parallel branches collide. Pre-wire them, assign one owner, or accept an easy append-only conflict.
5. **Set up each worktree.** A worktree is a fresh checkout of tracked files. It has no `node_modules` and no `.env`. Install and copy per worktree.
6. **Merge one at a time.** Merge the first branch, rebase or merge the second onto the result, run the tests, then merge. Tests on the merged result are the only proof the features coexist.
7. **Clean up.** Remove the worktree and delete the merged branch. Worktrees are full copies and add up.

A worktree isolates files, not the machine. Two worktrees still share one database and one set of local ports, so a second dev server on the same port fails to start or quietly moves to another port while you keep testing the other worktree on :3000, and a second test run can reset the database under the first.

```diagram
type: boundary
id: worktree-isolation
title: What a worktree isolates and what it shares
summary: Each worktree gets its own files and branch. The history, database and local ports are shared, so two sessions can still collide there.
zones:
  - id: own
    label: Separate per worktree
    items:
      - id: files
        label: Files and branch
        sub: own checkout
      - id: app
        label: Dev server and tests
        sub: one per session
  - id: shared
    label: Shared by every worktree
    items:
      - id: git
        label: Git history
        sub: commits and remotes
      - id: db
        label: Database
        sub: one local instance
      - id: ports
        label: Local ports
        sub: one :3000
crossings:
  - from: app
    to: db
    label: same data
    style: risk
  - from: app
    to: ports
    label: same port
    style: risk
```

### First Mate tip

Client MVPs usually have a few independent slices at once, for example a settings screen, a CSV export and an email template. Those are ideal for parallel worktrees, and the collision points are predictable: the router, the DB migration order and the lockfile. Agree on those before you fan out. Decide who adds migrations (one branch, one number range) and let one branch own `package.json`. Two agents adding dependencies at the same time is the most common merge pain.

## Claude Code

Start a session in a new worktree with `--worktree` (or `-w`):

```bash
claude --worktree feature-auth
```

Claude Code creates `.claude/worktrees/feature-auth/` on a new branch `worktree-feature-auth` and starts in it. Run the command again with another name in a second terminal for a second isolated session. Leave the name off and it invents one. Add `.claude/worktrees/` to `.gitignore`.

```bash
claude --worktree "#1234"      # branch from pull request 1234 (quote the #)
claude --worktree feature-auth --resume   # go back into a kept worktree
```

You can also say "work in a worktree" during a session, and Claude uses its `EnterWorktree` tool.

**Base branch.** New worktrees branch from the repository's default branch on the remote (`worktree.baseRef` is `"fresh"`). To branch from your current local `HEAD` and carry unpushed commits, set it in settings:

```json
{
  "worktree": {
    "baseRef": "head"
  }
}
```

**Untracked files.** List gitignored files to copy into every worktree Claude creates in `.worktreeinclude`, in `.gitignore` syntax. Only files that are also ignored are copied.

```text
.env
.env.local
```

**Cleanup.** When you exit, a clean unnamed worktree is removed automatically. If it has changes or new commits, Claude asks whether to keep or remove it. A named session asks first even when clean. Non-interactive `-p` runs never clean up, so remove those yourself with `git worktree remove`.

**Hooks and paths.** After Claude enters a worktree, `${CLAUDE_PROJECT_DIR}` in your hooks still points at the original project root. The hook's `cwd` field is the worktree.

**Subagents in worktrees.** Set `isolation: worktree` in a subagent's frontmatter to give it a temporary worktree. It is cleaned up automatically if the subagent made no changes.

```markdown
---
name: refactorer
description: Applies mechanical refactors across many files
isolation: worktree
---
```

You can also create worktrees yourself with `git worktree add` and run `claude` inside them. Worktrees Claude did not create are never removed by its cleanup sweep.

## Codex CLI

Codex CLI works in whatever directory you start it in, so the reliable pattern is plain git. Create the worktrees, then start one session in each:

```bash
git worktree add ../myapp-search -b feat/search
git worktree add ../myapp-export -b feat/export

# terminal 1
cd ../myapp-search && codex
# terminal 2
cd ../myapp-export && codex
```

`codex -C <dir>` (or `--cd <dir>`) sets the working root, so you can also launch from anywhere. `--add-dir <dir>` makes an extra directory writable when a task needs to read or change a sibling checkout.

**Codex-managed worktrees.** The ChatGPT desktop app's Worktree mode creates them for you under `$CODEX_HOME/worktrees` at the branch you pick, in a detached HEAD state, and lets you hand a chat off between Local and Worktree. If you turn a worktree into a branch, remember git will not let that branch be checked out anywhere else. Codex keeps the 15 most recent managed worktrees by default and saves a snapshot before deleting one.

`codex --help` in 0.154.0 lists `--worktree` ("Run the session in a new managed Git worktree"). It is experimental: it fails unless you also pass `--enable worktrees` (`codex --enable worktrees --worktree`). It creates a detached worktree under `$CODEX_HOME/worktrees`, refuses untrusted projects, and the CLI does not clean these up for you. The docs also list a `/worktree` slash command. For anything you rely on, `git worktree add` behaves the same on every version.

**Untracked files.** For app-managed worktrees, list ignored paths in a `.worktreeinclude` file in the repo root and Codex copies them in. The docs say this does not apply to worktrees you create yourself with git, so copy `.env` and run your install in each one.

**Instructions travel with the code.** `AGENTS.md` is tracked, so every worktree already has it. An ignored `AGENTS.override.md` is copied automatically into managed worktrees.
