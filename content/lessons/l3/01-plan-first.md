---
slug: l3-plan-first
level: 3
sort: 1
title: Plan before you code
objective: Use plan mode in Claude Code and /plan in Codex CLI to get a written plan, critique and edit it, and only then let the agent touch code.
est_minutes: 25
tool_versions:
  claude_code: "2.1.284"
  codex_cli: "0.154.0"
last_verified_on: "2026-09-30"
differences:
  - "Claude Code plan mode is a permission mode: Shift+Tab cycles into it, `/plan` enters it, and `claude --permission-mode plan` starts in it. Codex has `/plan` inside a session only; `codex --help` lists no start-in-plan flag."
  - "Claude Code ends planning with an approval prompt (Yes with auto mode, Yes with manual edit approval, or No and keep planning) and Ctrl+G opens the plan in your editor. Codex has no documented approval prompt or plan-editor shortcut, so you approve by telling it to proceed."
  - "Claude Code blocks edits until you approve the plan. In Codex, `/plan` asks for a plan before implementation, and a read-only sandbox (`-s read-only`, the default for `codex exec`) is what makes planning physically unable to change files."
  - "Codex `/plan` is unavailable while Codex is already working, so finish or interrupt the current turn first."
exercise: ex-3-1-plan-first
claude_no_equivalent: false
codex_no_equivalent: false
tldr:
  points:
    - "Ask for a written plan first, and approve it before the agent edits any code."
    - "Request files to change, steps, risks and verification commands, then edit the plan."
    - "A read-only mode makes planning safe: plan mode in Claude Code, `-s read-only` in Codex."
  try_this:
    claude: { kind: command, text: "claude --permission-mode plan" }
    codex: { kind: command, text: "codex -s read-only" }
---

## Concept

Most bad agent output comes from a wrong plan, not wrong typing. A 10-line plan takes a minute to read and fix. A 400-line diff built on a wrong plan takes an hour to unpick.

Plan first when a change touches more than one file, changes a public contract, or you can't say in one sentence what "done" looks like. Skip it for a one-line fix.

A useful plan has five parts:

1. **Goal** in one or two sentences, including what is out of scope.
2. **Files to change**, by path, and why each one.
3. **Steps** in order, each small enough to verify.
4. **Risks and open questions**: breaking changes, migrations, things the agent had to guess.
5. **Verification**: the exact commands that prove it works.

Your job in the review is to attack the plan. Ask what it assumes, which file it forgot, what breaks for existing callers, and whether the steps can be verified one at a time. Edit the plan, or send it back, before any code exists.

Keep the approved plan in the repo as `PLAN.md`. It is a handoff note if the session dies, and reviewers can compare it with the diff.

```diagram
type: flow
id: plan-review-loop
title: From draft plan to PLAN.md
summary: You attack the draft before any code exists. A weak plan goes back for another draft. Only a plan you accept becomes PLAN.md.
steps:
  - id: draft
    label: Draft plan
    sub: agent
  - id: attack
    label: Attack it
    sub: assumptions
    emphasis: true
  - id: plan
    label: PLAN.md
    sub: committed
  - id: code
    label: Implement
    sub: agent
loops:
  - from: attack
    to: draft
    label: send back
```

### First Mate tip

On client MVPs, the expensive mistakes are contract changes: an API response shape, a database column, an auth rule. Make "what breaks for existing callers" a required section of every plan. Paste the plan into the PR description so the client's tech contact can approve the approach before you spend days on it.

## Claude Code

Plan mode makes Claude read files, run exploration commands and write a plan, but it does not edit your source. Edits stay blocked until you approve the plan.

Enter it three ways:

```text
Shift+Tab           cycle default -> acceptEdits -> plan (status bar: "plan mode on")
                    (from the auto starting mode the first press goes to Manual, so plan is three presses away)
/plan add pagination to GET /items    enter plan mode and start on that task
```

```bash
claude --permission-mode plan
```

A good planning prompt names the sections you want and asks for questions:

```text
Add pagination to GET /items. Read src/app.js and the tests first.
Produce a plan with: Goal (and out of scope), Files to change, Steps,
Risks and open questions (especially anything that breaks existing callers),
and Verification commands. Ask me before assuming anything about response shape.
```

When the plan is ready, Claude presents it and asks how to proceed:

- **Yes, and use auto mode**: approve and continue in auto mode.
- **Yes, manually approve edits**: approve, and review each edit.
- **No, keep planning**: stay in plan mode and tell Claude what to change.

Press `Ctrl+G` to open the proposed plan in your default text editor and edit it directly before Claude proceeds.

Plan mode blocks edits, so Claude can't write `PLAN.md` itself. It may save its plan file to a plans directory (by default `.claude-plans/` in the cwd, per the settings reference); if so, copy that to `PLAN.md` and keep `.claude-plans/` out of your commits. Otherwise approve with manual edit approval and make the first instruction "Save the approved plan to PLAN.md and stop. Write no code yet." Then commit it.

To make plan mode the default for a project, set it in `.claude/settings.json`:

```json
{
  "permissions": {
    "defaultMode": "plan"
  }
}
```

Plan mode also holds in scripts: `claude -p "..." --permission-mode plan` plans without editing.

## Codex CLI

Inside a session, `/plan` switches the chat into plan mode. You can pass a prompt inline, and you can paste content or attach images with it:

```text
/plan Add pagination to GET /items. Read src/app.js and the tests first.
Give me Goal (and out of scope), Files to change, Steps, Risks and open
questions, and Verification commands. Do not write code.
```

Codex enters plan mode and treats your inline text as the first planning request. `/plan` is unavailable while Codex is already working.

Codex has no documented approval prompt or plan-editor shortcut. Review the plan in the chat and correct it in your next message, then approve it in words: "Save this plan to PLAN.md, commit nothing, write no code." A read-only session can't write the file: approve the write if Codex asks, or restart without `-s read-only` (for example `codex -s workspace-write`) for that step.

To make planning physically read-only, start the session in a read-only sandbox:

```bash
codex -s read-only
```

For a one-shot plan you can capture in a file, `codex exec` is read-only by default and prints only the final message to stdout:

```bash
codex exec "Plan the change: add pagination to GET /items. Sections: Goal, Files to change, Steps, Risks, Verification. Write no code." | tee PLAN.md
```

Once the plan is reviewed, start the implementation with a normal session (for example `codex "Follow PLAN.md exactly. Stop and ask if a step doesn't fit."`).
