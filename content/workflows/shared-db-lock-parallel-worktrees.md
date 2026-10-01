---
title: One lock for a shared local database across worktrees
problem: Parallel worktrees sharing one local database corrupt each other's test runs.
tools: [claude-code]
use_cases: [parallel-work, testing]
stacks: [supabase, postgres]
related_lesson: l4-parallel-worktrees
tool_versions:
  claude_code: 2.1.286
verified_on: 2026-10-01
client_safe: confirmed
---

## Result

### Before
Several worktrees shared one local Supabase stack. One agent ran `db:reset:test` while another was mid e2e run, so tests failed with missing rows that had nothing to do with the code under test.

### After
Every command that mutates the database or runs e2e goes through a lock wrapper. Around ten parallel worktrees took turns on one stack with no cross-run resets, and a crashed holder never blocked the rest because stale locks are broken automatically.

## Setup

macOS has no `flock`, so the wrapper uses `mkdir`, which is atomic on every filesystem.

```bash path=scripts/db-lock.sh kind=script
#!/usr/bin/env bash
# Usage: scripts/db-lock.sh <command...>  (serialises DB-mutating runs across worktrees)
LOCK="${TMPDIR:-/tmp}/playground-db.lock"
for _ in $(seq 1 900); do
  if mkdir "$LOCK" 2>/dev/null; then
    echo "$$ $(pwd)" > "$LOCK/owner"
    trap 'rm -rf "$LOCK"' EXIT INT TERM
    "$@"; exit $?
  fi
  # Break the lock if its owner process is gone.
  pid=$(cut -d' ' -f1 "$LOCK/owner" 2>/dev/null)
  [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null && rm -rf "$LOCK"
  sleep 2
done
echo "db-lock: timed out waiting (held by $(cat "$LOCK/owner"))" >&2
exit 75
```

```markdown path=AGENTS.md kind=context-file
### Shared database
All worktrees share one local Supabase stack. Wrap EVERY command that mutates the DB or
runs e2e: `scripts/db-lock.sh npm run db:reset:test`, `scripts/db-lock.sh npm run e2e`.
Keep lock holds short. Never stop the stack from a worktree.
```

## Prompt

```text
Before running any database or e2e command, read AGENTS.md "Shared database".
Run it as `scripts/db-lock.sh <command>`. If the wrapper exits 75, report who holds the
lock (the message names the owner's pid and directory) instead of deleting the lock yourself.
```

## Steps

1. Commit `scripts/db-lock.sh` and make it executable (`chmod +x`).
2. Add the "Shared database" rule to `AGENTS.md` and to every worker brief you hand out.
3. Prefix each DB-mutating or e2e command with the wrapper: `scripts/db-lock.sh npm run e2e`.
4. If a run hangs, check `cat "${TMPDIR:-/tmp}/playground-db.lock/owner"` before touching anything.

## Why it works

`mkdir` either creates the directory or fails, so exactly one process wins even when many start together. Recording the owner pid lets waiters detect a dead holder and clear it, so a killed agent cannot wedge the queue. The 30-minute timeout turns a deadlock into a visible exit code 75 instead of a silent hang.
