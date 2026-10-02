---
slug: l5-multi-agent-teams
level: 5
sort: 2
title: "Multi-agent teams: an orchestrator, workers and file ownership"
objective: "Split a spec into tasks, dispatch workers in separate worktrees with explicit file ownership, and pass work between them through files, using Claude Code subagents, worktrees and agent teams and Codex subagents and codex exec."
est_minutes: 50
tool_versions:
  claude_code: "2.1.284"
  codex_cli: "0.154.0"
last_verified_on: "2026-09-30"
differences:
  - "Claude Code has an experimental agent-teams mode (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) with a shared task list and teammates that message each other. For Codex, the documented pattern is subagents spawned inside one session, or one `codex exec` process per worker with files as the handoff."
  - "Worktree isolation is built into Claude Code: `claude --worktree <name>` and `isolation: worktree` on a subagent. With Codex, create the worktree with `git worktree add` and point the worker at it with `-C`."
  - "Claude Code subagents can run in the background and be listed with `claude agents`. Codex subagent threads are switched between with `/agent` inside the session."
  - "In both tools the orchestrator's conversation does not reach a worker. What the worker knows is its brief, the repo files and its own instructions file, so the brief must be self-contained."
exercise: ex-5-2-team
claude_no_equivalent: false
codex_no_equivalent: false
tldr:
  points:
    - "Split work by file ownership, not by topic, so workers never edit the same file."
    - "Write each worker a self-contained brief; it cannot see your conversation."
    - "Pass results through files like `handoffs/<name>.md`, and lock shared resources."
  try_this:
    claude: { kind: command, text: "claude agents" }
    codex: { kind: prompt, text: "/agent" }
---

## Concept

One agent working alone is limited by its context window and your patience. A team fixes both, but only if the work is split so the workers cannot get in each other's way.

The roles:

- **Orchestrator.** Reads the spec, splits it into tasks, assigns ownership, dispatches workers, integrates. It does not implement. Use the strong model.
- **Workers.** Each implements one task in its own git worktree, on its own branch, in files only it may edit. Use the fast model.
- **Handoffs.** Everything that passes between them is a file or an issue: the brief going in, a report coming out. Never "the orchestrator told it earlier".

```diagram
type: lanes
id: team-handoffs
title: What passes between orchestrator and workers
summary: The orchestrator sends each worker a self-contained brief and gets a report back. The orchestrator's conversation never reaches a worker, so each brief has to stand alone.
lanes:
  - { id: orch, label: Orchestrator }
  - { id: wa, label: Worker A }
  - { id: wb, label: Worker B }
steps:
  - { id: brief, lane: orch, col: 1, label: Split and brief, sub: paths per worker, emphasis: true }
  - { id: build-a, lane: wa, col: 2, label: Build task A, sub: own worktree }
  - { id: build-b, lane: wb, col: 2, label: Build task B, sub: own worktree }
  - { id: integrate, lane: orch, col: 3, label: Integrate, sub: reads both reports }
handoffs:
  - { from: brief, to: build-a, label: brief }
  - { from: brief, to: build-b, label: brief }
  - { from: build-a, to: integrate, label: report }
  - { from: build-b, to: integrate, label: report }
```

### Split by file ownership, not by topic

Two workers that need the same file will conflict, however well they are prompted. So before anyone starts, assign every file to exactly one owner. This repo's PRD (section 11) does it by directory:

| Workstream | Owns |
|---|---|
| B: Content pipeline | `scripts/seed/`, `scripts/exercises/`, `supabase/seed/`, `tests/fixtures/` |
| D: Progress layer | `src/lib/progress/`, `src/app/progress/`, `src/app/bookmarks/` |
| F: News UI | `src/app/news/`, `src/components/news/` |
| G1-G5: Level n content | `content/lessons/l<n>/`, `exercises/ex-<n>-*/` |

`AGENTS.md` turns that into a rule every agent reads: "edit only the paths your workstream owns", and shared things such as `package.json`, contracts and migrations are frozen after the foundation milestone and change only in a dedicated PR. The code-review gate then checks the PR for edits outside the owner's paths.

If a worker needs a change outside its paths, the rule is: say so in the report, do not make the edit. The orchestrator decides who owns it.

### Write a brief the worker can act on alone

A worker starts with none of your context. This repo's worker brief opens with what to read (`AGENTS.md`, the PRD section, the test cases, the frozen contracts), then setup, then working rules, then the shape of the final reply. The parts that carry the weight:

- **Owned paths, and what to do when you need another.**
- **Test-first:** write the tests for your P0 criteria, watch them fail, then implement.
- **Exact commands** to run before opening a PR, and the exact reply format ("PR URL, head SHA, ACs done and deferred, real test counts, anything needed outside owned paths, under 200 words").
- **Forbidden actions:** do not post gate statuses, add gate labels or merge. Independent gate agents do that.

Short reports matter. Ten workers each returning a page of prose is more than the orchestrator can read.

### Shared resources: locks and ports

Worktrees isolate files. They do not isolate anything outside the repo. On this project ten worktrees shared one local Supabase database, so two workers running `db:reset:test` or the end-to-end tests at the same time corrupted each other's fixtures. The fix was a lock that every DB-touching command runs inside, and one assigned dev-server port per worker (other projects already used :3000 and :3100).

```bash
#!/usr/bin/env bash
# db-lock.sh <command...>: serialize access to the shared database across worktrees.
LOCK=/tmp/firstmate-playground-db.lock
for i in $(seq 1 900); do
  if mkdir "$LOCK" 2>/dev/null; then              # mkdir is atomic: only one caller wins
    echo "$$ $(pwd)" > "$LOCK/owner"
    trap 'rm -rf "$LOCK"' EXIT INT TERM
    "$@"; exit $?
  fi
  pid=$(cut -d' ' -f1 "$LOCK/owner" 2>/dev/null)  # break a stale lock whose owner died
  [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null && rm -rf "$LOCK"
  sleep 2
done
echo "db-lock: timed out waiting (held by $(cat "$LOCK/owner"))" >&2; exit 75
```

```bash
db-lock.sh npm run db:reset:test
db-lock.sh env PLAYWRIGHT_PORT=3457 npm run e2e
```

This is a lesson-sized lock: two waiters can both decide a stale lock is dead, and one can delete the other's fresh lock. Use a real lock (`flock`, or a database advisory lock) when the stakes are higher. The brief tells each worker to "keep lock holds short" and to kill only the process IDs it started, never by name. List shared resources in the spec (database, ports, third-party sandboxes, rate limits) before you dispatch, and give each one an owner or a lock.

### When not to use a team

A team adds coordination cost and uses many more tokens than one session. Do not use it for sequential work, for a change that touches one file, or when the pieces depend on each other heavily. Three focused workers usually beat five scattered ones.

### First Mate tip

For a client MVP, the orchestrator's first deliverable is not code. It is an ownership table, a frozen interface file and a worker brief template, committed to the repo. That is a few hours of setup, and it is what lets you run three or four workers overnight and merge in the morning without a conflict. It also gives the client a written record of who, human or agent, was responsible for which part.

## Claude Code

### Workers in their own worktrees

```bash
claude --worktree ws-parser
```

That creates `.claude/worktrees/ws-parser/` on a new branch `worktree-ws-parser` and starts Claude in it. Add `.claude/worktrees/` to `.gitignore`. A worktree is a fresh checkout, so gitignored files such as `.env` are missing. List the ones to copy in a `.worktreeinclude` file at the repo root (`.gitignore` syntax; only files that match and are also gitignored are copied):

```text
.env
.env.local
```

You can dispatch a worker headlessly with the brief as the prompt:

```bash
claude -p --worktree ws-parser --model sonnet "$(cat briefs/parser.md)"
```

Headless runs (`-p`) do not clean up their worktrees, so remove them yourself with `git worktree remove <path>` when the PR is merged. To start a worker in the background and come back to it, use `--bg`, then list background sessions with `claude agents`.

### Subagents that isolate themselves

If one session is your orchestrator, its subagents can each get their own worktree. Set it in the subagent file so it is permanent:

```markdown
---
name: refactorer
description: Applies one owned-file refactor and runs its tests
tools: Read, Grep, Glob, Bash, Edit, Write
model: sonnet
isolation: worktree
---

Change only the files named in your brief. Run the tests and report the real output.
```

A subagent worktree with no changes is removed automatically when it finishes. Worktrees branch from the repository's default branch unless `worktree.baseRef` is set to `"head"`.

### Agent teams (experimental)

Agent teams let one lead session coordinate several independent Claude Code sessions with a shared task list and direct messaging. They are off by default:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

Then describe the team in plain language, naming the model and the ownership:

```text
Spawn three teammates, using Sonnet for each. parser owns src/parse.mjs, grouper owns
src/group.mjs, renderer owns src/render.mjs. Nobody edits tests/. Each writes
handoffs/<name>.md when done. Wait for all three before you integrate.
```

Things the docs are clear about: teammates start with your project context (`CLAUDE.md`, MCP servers, skills) but not the lead's conversation, so put task details in the spawn prompt; two teammates editing the same file overwrite each other, so split the files; 3-5 teammates is a sensible start; and the lead can start doing the work itself unless you tell it to wait. Teams cost significantly more tokens than one session. Because the feature is experimental, `/resume` and `/rewind` do not restore in-process teammates.

Hooks can enforce your rules. `TaskCreated` and `TaskCompleted` run when a task is created or marked done, and exiting with code 2 blocks that action and sends feedback. `TeammateIdle` runs when a teammate is about to go idle, and exit code 2 sends feedback and keeps it working.

If you want plain subagents instead of a team, leave the variable unset. Setting `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` to `1` makes named subagents launch as teammates.

## Codex CLI

### Subagents inside one session

Multi-agent support is on by default (`agents.enabled` defaults to `true`; `codex features list` shows `multi_agent` as stable). You ask for parallel work in the prompt, and Codex spawns the threads:

```text
Spawn one agent per workstream in OWNERSHIP.json. Each owns only its listed files, none edits
tests/, and each writes handoffs/<name>.md when done. Wait for all of them, then summarize.
```

Define reusable roles as TOML files in `.codex/agents/` (project) or `~/.codex/agents/` (personal). Each needs `name`, `description` and `developer_instructions`, and can set `model`, `model_reasoning_effort` and `sandbox_mode`:

```toml
# .codex/agents/renderer.toml
name = "renderer"
description = "Implements src/render.mjs from SPEC.md Part C"
model = "<fast-model>"
model_reasoning_effort = "low"
sandbox_mode = "workspace-write"
developer_instructions = """
You own src/render.mjs only. Do not edit tests/. Run the tests and write handoffs/renderer.md.
"""
```

Cap concurrency in `config.toml`:

```toml
[agents]
max_concurrent_threads_per_session = 3
```

Inside the session, `/agent` (or `/subagents`) switches between the spawned threads so you can read or steer one.

### One process per worker

For hard isolation, create the worktrees yourself and run one `codex exec` per worker, each with its own working root:

```bash
git worktree add ../wt-parser -b feat/parse
git worktree add ../wt-grouper -b feat/group

mkdir -p handoffs
codex exec -C ../wt-parser  --profile fm-impl -o "$PWD/handoffs/parser.md"  "$(cat briefs/parser.md)"  &
codex exec -C ../wt-grouper --profile fm-impl -o "$PWD/handoffs/grouper.md" "$(cat briefs/grouper.md)" &
wait
```

`-C` sets the agent's working root and `-o <file>` writes the agent's last message to a file, which is your handoff. Each worker still gets only its brief. `fm-impl` is the profile from lesson 5.1.

`codex --worktree` ("run the session in a new managed Git worktree") appears in `codex --help`, and `codex features list` marks `worktrees` as experimental, so this lesson uses explicit `git worktree add`, which behaves the same everywhere.
