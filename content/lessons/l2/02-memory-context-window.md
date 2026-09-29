---
slug: l2-memory-context
level: 2
sort: 2
title: "Memory and context-window management"
objective: "Manage what the agent remembers: persistent memory, compacting, clearing and resuming. Know when to reset instead of continuing, and hand work between sessions through a file."
est_minutes: 25
tool_versions:
  claude_code: "2.1.284"
  codex_cli: "0.154.0"
last_verified_on: "2026-09-30"
differences:
  - "Claude Code has /context (a usage grid with suggestions) and /memory (open CLAUDE.md files, toggle auto memory). Codex has no /context or /memory editor: /status shows configuration and token usage, and /memories only controls whether this chat uses and feeds Codex memories."
  - "Claude Code auto memory is on by default and Claude writes notes to ~/.claude/projects/<project>/memory/. Codex memories are off unless you set [features] memories = true, and live under ~/.codex/memories/."
  - "/compact takes focus instructions in Claude Code (/compact keep the test commands). The Codex /compact description lists no arguments, so put must-keep constraints in AGENTS.md or a handoff file instead."
  - "Starting fresh: Claude Code /clear (aliases /reset, /new). Codex /new starts a new chat, and /clear also clears the terminal. Coming back: claude --continue / --resume, codex resume --last / codex resume <id or name>."
exercise: ex-2-2-long-task
claude_no_equivalent: false
codex_no_equivalent: false
---

## Concept

The context window is the agent's working memory: your prompts, every file it read, every command output. It is finite and shared. Two things follow.

1. **Quality drops as it fills.** Long sessions pile up dead ends, big file dumps and failed attempts. The agent starts to forget early instructions or repeat mistakes. Cost and latency rise too.
2. **A new session starts blank.** Nothing in chat carries over. Only files on disk do: your instruction file, memory notes, the code and git history.

So you have four levers, cheapest first:

| Lever | What it does | Use when |
|---|---|---|
| **Compact** | Replaces the conversation with a summary, same session | Same task, context getting heavy |
| **Clear / new session** | Empty context, files on disk stay | Switching tasks, or the session is polluted |
| **Resume** | Reopens an earlier session with its history | You stopped mid-task and want the same thread |
| **Handoff file** | You (or the agent) write state into a file; the next session reads it | Multi-session work, or anything that must not depend on a summary |

**When to reset rather than continue.**

- You are on an unrelated task. Start fresh; don't carry the old one.
- You have corrected the agent about the same thing twice. Its context now holds two failed attempts. Clear, and write a better first prompt that includes what you learned.
- It is contradicting an earlier decision or forgetting a constraint. That is the window talking.
- The task changes phase (explore, then implement). A fresh implementer with a written plan often beats a long session that explored.

Continue (or compact) when you are deep in one problem and the history is genuinely useful.

**Summaries lose things.** Compaction keeps the gist and drops specifics: exact constraints, rejected options, "don't touch X". Anything that must survive goes in a file: the instruction file for permanent rules, a handoff note for the current task.

**A handoff note has three parts.**

```markdown
# Handoff: <task>
## Done
- What is finished and verified (with the test that proves it).
## Next
- The next steps in order, specific enough to start without asking.
## Constraints
- Rules that must still hold: don't edit fixtures, output stays byte-identical, no new deps.
```

Write it as if to a stranger with no memory of the chat. Commit after each finished part so `git log` shows the state without trusting any summary.

### First Mate tip

Client MVP work is interrupted constantly: a standup, a client call, a production bug. Treat each session as disposable and keep the state in the repo. End your day by asking the agent to update `HANDOFF.md` and commit. When you come back tomorrow, or when another First Mate engineer picks up the ticket, the first prompt is "read HANDOFF.md and continue". It also makes billing conversations easier: you can show exactly what was done.

## Claude Code

**See what you're spending.** `/context` draws the window as a grid, with suggestions for context-heavy tools and memory bloat. `/context all` expands the per-item breakdown in fullscreen mode. A custom status line can show usage continuously. `/usage` (aliases `/cost`, `/stats`) shows session cost.

**Compact.** `/compact [instructions]` summarises the conversation so far and keeps going in the same session. Give it a focus:

```text
/compact keep the list of modified files, the failing test names and the constraint that the golden output must not change
```

Claude Code also compacts automatically when you approach the limit. To steer that, add a line to CLAUDE.md, for example: `When compacting, always preserve the full list of modified files and any test commands.`

What survives `/compact`: the system prompt, the project-root CLAUDE.md (re-read from disk), auto memory, MCP tool names, up to five recently modified files re-read, and the body of skills you invoked. What doesn't: instructions you gave only in chat, and nested CLAUDE.md files or path-scoped rules until Claude reads matching files again.

To compact only part of a session, press `Esc` twice (or run `/rewind`), pick a message, and choose **Summarize from here** or **Summarize up to here**.

**Side questions.** `/btw <question>` asks something without adding it to the conversation, so a quick lookup doesn't grow the context.

**Clear.** `/clear [name]` starts a new conversation with empty context. The optional name labels the old one in the `/resume` picker. Aliases: `/reset`, `/new`. CLAUDE.md and auto memory still load.

**Resume.**

```bash
claude --continue          # most recent conversation in this directory (short: -c)
claude --resume            # pick from a list (short: -r); also takes a session id or name
claude -n oauth-migration  # name a new session so you can find it later
claude --resume <id> --fork-session   # continue from an old session under a new id
```

Inside a session, `/resume [session]` opens the picker (alias `/continue`).

**Memory that persists.**

- **CLAUDE.md** is what you write (lesson 2.1).
- **Auto memory** is what Claude writes to itself: your corrections and preferences, project context it can't derive from code. It lives in `~/.claude/projects/<project>/memory/` (a `MEMORY.md` index plus topic files), is shared across worktrees of the same repo, and is machine-local. The first 200 lines or 25 KB of `MEMORY.md` load each session. Toggle it and browse it with `/memory`, or set `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`.
- Ask for either explicitly: "remember that the API tests need a local Redis" goes to auto memory; "add this to CLAUDE.md" goes to the file.

Audit auto memory now and then. Wrong notes are read back as facts.

**Handoff prompt.**

```text
Write HANDOFF.md with ## Done, ## Next and ## Constraints so a fresh session can continue without this chat. Include the exact test command and which tests are green. Then commit.
```

Next session: `/clear` (or `claude`), then `Read HANDOFF.md and continue with Next. Follow the Constraints.`

## Codex CLI

**See what you're spending.** `/status` shows the current session configuration and token usage. Codex has no `/context` grid.

**Compact.** `/compact` summarises the conversation to avoid hitting the context limit. The command's description lists no arguments, so you can't pass focus instructions the way Claude Code allows. Two workarounds: state the must-keep constraints in `AGENTS.md`, or write them to a handoff file before you compact and ask Codex to re-read it after.

**Start fresh.**

- `/new` starts a new chat in the same session window.
- `/clear` clears the terminal and starts a new chat.
- Quit and run `codex` again for a new process.

**Resume and fork.**

```bash
codex resume --last            # continue the most recent session
codex resume                   # picker (add --all to see every directory)
codex resume <session id or name> "keep going on part 2"
codex fork --last              # branch the most recent session into a new one
```

Inside a session, `/resume` reopens a saved chat and `/fork` branches the current one. For scripted work, `codex exec resume --last "<prompt>"` continues a session non-interactively.

**Side conversations.** `/side` starts a side conversation in an ephemeral fork, so a tangent doesn't pollute the main thread. This is the closest match to Claude Code's `/btw`.

**Memory that persists.**

- **AGENTS.md** is the reliable one (lesson 2.1). The Codex docs say to keep required team guidance in `AGENTS.md` or checked-in docs and treat memories as a recall layer, not the only source for rules that must always apply.
- **Codex memories** carry useful context from earlier work into future sessions. They are off by default. Enable them in `~/.codex/config.toml`:

```toml
[features]
memories = true
```

  Stored locally under `~/.codex/memories/`. Inside a session, `/memories` controls whether the current chat can use existing memories and whether it contributes to future ones, without changing global settings. Related config keys documented: `memories.generate_memories`, `memories.use_memories`, `memories.disable_on_external_context`.

There is no `/memory` command that opens files for editing. Edit `AGENTS.md` and the memory directory with your editor.

**Handoff prompt.** The same prompt as the Claude Code tab works. In the next session: `codex`, then `Read HANDOFF.md and continue with the Next section. Follow the Constraints.` If you want to keep the old thread instead, `codex resume --last`.
