---
slug: l2-feedback-loops
level: 2
sort: 3
title: "Self-verifying agents: encode your feedback loop"
objective: "Put your test, typecheck and lint commands and a definition of done into the context file, so the agent verifies its own work and you stop being the verification loop."
est_minutes: 20
tool_versions:
  claude_code: "2.1.284"
  codex_cli: "0.154.0"
last_verified_on: "2026-09-30"
differences:
  - "Both tools learn your verification commands from the instruction file (`CLAUDE.md` or `AGENTS.md`), and in both it is advice the model can skip."
  - "Both tools have a `Stop` hook: a command runs after every turn and, by exiting 2 or returning a block decision, sends the agent back to work. Claude Code configures it in `.claude/settings.json`; Codex in `.codex/hooks.json` or `config.toml`, and Codex asks you to review and trust a new hook with `/hooks` before it runs."
  - "Claude Code also has `/goal`, where a small model judges a condition after every turn, plus prompt and agent hook types. Codex has a `/goal` command too, but its docs give little detail on evaluation, so use a `Stop` command hook for a hard gate."
  - "Claude Code's `/goal` evaluator reads only what appears in the conversation, so make the agent print command output. It does not run the commands itself."
  - "A verification command must exit non-zero on failure and print what failed. That is what both agents read."
exercise: ex-2-3-feedback-loop
claude_no_equivalent: false
codex_no_equivalent: false
tldr:
  points:
    - "Put your test, typecheck and lint commands in the context file so the agent checks itself."
    - "Ban shortcuts there too: no `@ts-ignore`, and no editing tests to get green."
    - "Instructions can be skipped; a `Stop` hook that exits 2 blocks the stop when checks fail."
  try_this:
    all: { kind: prompt, text: "Run npm run typecheck, npm run lint and npm test; report failures." }
---

## Concept

An agent stops when the work *looks* done. If the only check it has is its own judgement, "looks done" is the only signal, and you become the verification loop: every mistake waits for you to spot it. Give the agent a check it can run, and the loop closes without you: it works, runs the check, reads the result, fixes, and repeats until it passes.

```diagram
type: flow
id: self-check-loop
title: The loop that ends at exit 0
summary: The agent works, runs the checks, and fixes until every one exits 0. A check it can silence gives a false green, so forbid that in the file.
steps:
  - id: work
    label: Work
    sub: agent edits
    next: run
  - id: check
    label: Check
    sub: types, lint, tests
    emphasis: true
    next: fails
  - id: fix
    label: Fix
    sub: read the output
loops:
  - from: fix
    to: check
    label: run again
exits:
  - from: check
    label: exit 0
    text: Done
    style: ok
  - from: fix
    label: hides error
    text: False green
    style: risk
```

**The failure to design against.** Tests are green, so the agent reports success. But the repo also has a typecheck and a linter, nobody told the agent, and they fail. You find out in CI, or in review. This is the normal state of most codebases, and the fix is one paragraph in the context file.

**What to encode.**

1. **The commands, in order, exactly as typed.** `npm run typecheck`, `npm run lint`, `npm test`. Fast checks first. Include how to run a single test, so it doesn't run the whole suite for every edit.
2. **A definition of done in exit codes.** "Done means typecheck, lint and tests all exit 0, including files you didn't touch." The last clause is what makes the agent fix errors that were already there, or at least report them.
3. **What not to do to get green.** An agent told to pass the checks will sometimes weaken them: `@ts-ignore`, `any`, `eslint-disable`, deleting or loosening a test. Say no, once, in the file.
4. **Evidence.** "Show the final output of the three commands." Reviewing output is faster than re-running it, and it works for sessions you weren't watching.

```markdown
## Verify your own work
Tests alone are not enough here: type and lint errors don't fail them. Run, in order:
1. `npm run typecheck`
2. `npm run lint`
3. `npm test`

## Definition of done
All three exit 0, including for files you did not touch. Paste the final output when you report back.

## Never
- Add `@ts-ignore`, `any` or lint-disable comments to get green.
- Edit or delete a test to make it pass.
```

**Three strengths of gate.**

| Gate | How it works | Strength |
|---|---|---|
| Sentence in the context file | Agent reads it and usually complies | Advisory |
| Enforced by the tool | A hook or goal checks after each turn and sends the agent back | Deterministic |
| Enforced outside the agent | CI or a merge gate (level 5) | Cannot be bypassed |

Start with the sentence. Move up a level when the agent keeps skipping the step, or when you want to walk away.

**Keep it fast.** A loop that takes 10 minutes will get skipped or run once. Prefer `tsc --noEmit` and the linter over the full suite on each edit, and the full suite at the end.

### First Mate tip

Most client MVPs we inherit have tests that pass and a typecheck that doesn't, or no typecheck at all. On day one, add the three commands to `AGENTS.md`, run them once yourself, and record the baseline errors. If the repo is already red, don't ask the agent to "fix everything": say `Done means no new errors compared to the baseline in BASELINE.md` and clean up in a separate PR. The same commands then become the CI job, so the agent, the reviewer and the client all use one definition of "passing".

## Claude Code

**Put the loop in CLAUDE.md** (or in AGENTS.md imported from CLAUDE.md, as in lesson 2.1). Confirm it loaded with `/context`.

**Ask for it in the prompt too, for one-off tasks.** From Anthropic's best-practices guide, the pattern is: state the check, then the expectation.

```text
Write validateEmail. Cases: user@example.com is true, invalid is false, user@.com is false.
Run npm run typecheck, npm run lint and npm test after implementing. Fix everything they report, and don't suppress errors.
```

**Make it a gate for a whole session: `/goal`.** Set a completion condition and Claude keeps starting turns until a small fast model judges it met:

```text
/goal npm run typecheck, npm run lint and npm test all exit 0, and no test file or tsconfig.json is modified. Stop after 20 turns.
```

The evaluator only sees what Claude has surfaced in the conversation. It does not run commands. So the condition must be something Claude's output can show, like an exit code it prints. Bound the run with a turn clause as above. `/goal` also works headless: `claude -p "/goal ..."`. It is a session-scoped wrapper around a Stop hook, and it is unavailable if hooks are disabled.

**Make it deterministic: a Stop hook.** A Stop hook lives in settings, applies to every session in its scope, and runs after every turn. Use a command hook when you want a script, not a model, to decide:

`.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "./scripts/stop-gate.sh" }
        ]
      }
    ]
  }
}
```

```bash
#!/bin/bash
# scripts/stop-gate.sh: block the turn from ending while checks fail
INPUT=$(cat)
# Claude Code overrides a Stop hook that keeps blocking without progress; don't loop forever
if [ "$(echo "$INPUT" | jq -r '.stop_hook_active')" = "true" ]; then exit 0; fi
if ! OUT=$(npm run typecheck 2>&1 && npm run lint 2>&1 && npm test 2>&1); then
  echo "$OUT" | tail -40 >&2
  exit 2   # exit 2 blocks; stderr goes back to Claude as feedback
fi
```

Exit code 2 blocks the action and feeds stderr to Claude on events where that applies; see the hooks reference for the per-event table. Claude Code also has `prompt` and `agent` hook types, where a model (or a subagent that can run commands) makes the call instead of a script. Hooks are covered in depth in lesson 4.4. Note that a hook adds latency to every turn.

**A fresh reviewer.** For work you didn't watch, ask for a second opinion in a fresh context: `Use a subagent to review the diff against the plan. Report only gaps that affect correctness.` The bundled `/code-review` skill does this for the current diff.

## Codex CLI

**Put the loop in AGENTS.md** (lesson 2.1), in the same words as the Claude Code tab. The file is read at the start of every session; test that it loaded by asking `Which commands must you run before you say a task is done?`

**Ask for it in the prompt, one-off.** Codex responds to the same phrasing:

```text
Add truncate(text, max) to src/text.js plus a test. Before you finish, run npm run typecheck, npm run lint and npm test, fix everything they report without suppressing errors, and paste the final output.
```

**Make it deterministic: a Stop hook.** Codex hooks are stable and on by default in 0.154.0. A `Stop` hook runs when a turn is about to end. If it exits 2 and writes to stderr, or prints `{"decision":"block","reason":"..."}`, Codex continues with a new prompt built from that reason. The input JSON includes `stop_hook_active` (true if Codex already continued once), so guard against loops. Hooks live in `~/.codex/hooks.json`, `~/.codex/config.toml`, `<repo>/.codex/hooks.json` or `<repo>/.codex/config.toml`.

`.codex/hooks.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$(git rev-parse --show-toplevel)/scripts/stop-gate.sh\"",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

The same hook in `.codex/config.toml`:

```toml
[[hooks.Stop]]

[[hooks.Stop.hooks]]
type = "command"
command = '"$(git rev-parse --show-toplevel)/scripts/stop-gate.sh"'
timeout = 120
```

The script is the same as in the Claude Code tab (read stdin, exit 0 when `stop_hook_active` is true, run the three checks, print the tail of the output to stderr and `exit 2` on failure).

Codex does not run a new or changed hook until you have reviewed it: open `/hooks` in the CLI, inspect the definition and trust it. Trust is recorded against the hook's hash, so changing the hook definition re-triggers review. To turn hooks off, set `[features] hooks = false`.

**Long-running tasks: `/goal`.** Codex has a `/goal` slash command ("set or view the goal for a long-running task"). The public docs give little detail on how a goal is evaluated, so use the Stop hook above when you need a hard gate.

**Keep the gate outside the agent.** Put the same three commands in a script and run it yourself, in a git hook, or in CI:

`package.json`:

```json
{ "scripts": { "verify": "npm run typecheck && npm run lint && npm test" } }
```

Then the prompt is short, and the definition of done is a command anyone can run:

```text
Implement the ticket in TICKET.md. Done means `npm run verify` exits 0. Run it, fix failures, and show me the last 20 lines of output.
```

**Non-interactive runs.** `codex exec "<prompt>"` runs a task headless (lesson 3.4), so the same verify-command prompt works in a script. In CI, run `npm run verify` after the agent step: the agent's claim that it passed is not the gate, the exit code is.

