---
slug: l2-context-files
level: 2
sort: 1
title: "Project instructions: CLAUDE.md vs AGENTS.md"
objective: "Write an instruction file the agent actually follows: right scope, right size, right place in the hierarchy. Keep one source of truth when a repo is used with both Claude Code and Codex."
est_minutes: 25
tool_versions:
  claude_code: "2.1.284"
  codex_cli: "0.154.0"
last_verified_on: "2026-09-30"
differences:
  - "Claude Code reads `CLAUDE.md`. Codex reads `AGENTS.md`. Since Claude Code 2.1.277 it also reads a repo's `AGENTS.md`, but only when there is no `CLAUDE.md` in or above the working directory. The moment you add a `CLAUDE.md` (or a `CLAUDE.local.md`), `AGENTS.md` is ignored unless `CLAUDE.md` imports it or you change the `Project instructions` setting in `/config` to load both."
  - "Claude Code `CLAUDE.md` files can import other files with `@path` (up to four hops deep). The Codex docs describe no import syntax: Codex concatenates one `AGENTS.md` per directory, root to working directory."
  - "Claude Code has extra layers: `CLAUDE.local.md` (personal, gitignored), `.claude/rules/` with path-scoped rules, and a managed-policy file. Codex has a global `~/.codex/AGENTS.md`, `AGENTS.override.md`, and `project_doc_fallback_filenames`."
  - "Size limits differ. Claude Code: aim for under 200 lines per file (it loads files up to 4 MiB, but adherence drops). Codex: `project_doc_max_bytes` defaults to 32 KiB for the project chain, and a file that crosses the limit is truncated."
  - "Check what loaded: `/context` (or `/memory`) in Claude Code. Codex has no listing command; start a session and ask it to summarise its instructions."
exercise: ex-2-1-conventions
claude_no_equivalent: false
codex_no_equivalent: false
---

## Concept

An agent starts every session knowing nothing about your repo except what it can read. An instruction file is the part of that knowledge you write down once so you stop retyping it. It is loaded into context at the start of every session, so every line costs tokens and competes for attention.

**What belongs in it.** Only things the agent cannot work out from the code:

- Commands it can't guess: how to run one test, how to start the dev server, the exact typecheck and lint commands.
- Conventions that differ from the defaults: "money is integer cents", "errors are `AppError` with an `E_` code".
- Gotchas: "the seed script wipes the local DB", "don't touch `generated/`".
- What "done" means: which commands must pass.

**What doesn't.** A directory tour, a dependency list, language basics, "write clean code". If the agent already does it right without the line, delete the line. Test every rule with: *would removing this cause a mistake?*

**Write rules you can check.** "Use 2-space indentation" beats "format code nicely". "Run `npm test` before you finish" beats "test your changes". Two rules that contradict each other get followed at random, so prune when you add.

**Scope and hierarchy.** Both tools stack files from the repo root down to the directory you started in, so put repo-wide rules at the root and package-specific rules next to the package. Personal preferences go in your home directory or a gitignored local file, never in the committed file.

**Instructions are advice, not enforcement.** The model reads them and usually follows them. Anything that must happen every time (block a command, run a formatter) belongs in a permission rule or a hook, not a sentence. Lesson 4.4 covers hooks.

**Two tools, one repo.** Every First Mate engineer has both CLIs, and a client repo will be opened with either. Two files that drift apart are worse than one. Pick `AGENTS.md` as the single source of truth (Codex reads it natively), and give Claude Code a thin `CLAUDE.md` that imports it. Details are in the tabs.

### First Mate tip

On a client MVP, write the instruction file in the first hour, not the third week. Ten lines covering the stack, the run/test commands and two or three "we do it this way" rules save more time than any prompt you'll write later. Commit it: the client's own devs, and any contractor we hand off to, inherit it. Never put secrets, staging URLs or client-confidential details in it. It is checked in.

## Claude Code

**Where files live** (broadest first; later files are read last, so closer rules win ties):

| File | Scope |
|---|---|
| `/Library/Application Support/ClaudeCode/CLAUDE.md` (macOS), `/etc/claude-code/CLAUDE.md` (Linux) | Managed policy, all users on the machine |
| `~/.claude/CLAUDE.md` | You, all projects |
| `./CLAUDE.md` or `./.claude/CLAUDE.md` | Project, shared via git |
| `./CLAUDE.local.md` | You, this project. Add to `.gitignore` |

Claude Code loads `CLAUDE.md` from the working directory and every directory above it at launch, concatenated (not overriding). A `CLAUDE.md` in a subdirectory loads on demand, when Claude reads files in that directory. In a monorepo, put package rules in `packages/api/CLAUDE.md`.

**Generate a first draft, then cut it.** Run `/init`. Claude analyses the repo and writes a `CLAUDE.md` (if one exists, it suggests improvements instead of overwriting). Set `CLAUDE_CODE_NEW_INIT=1` before running `/init` for an interactive flow that can also set up skills and hooks. Generated files are long. Delete everything the agent could derive from the code.

**A good file** (this is a real size: short):

```markdown
# Orders service

## Commands
- Test one file: `npm test -- test/foo.test.js`. All tests: `npm test`
- Typecheck: `npm run typecheck`. Lint: `npm run lint`

## Conventions
- Money is integer cents. Functions that take or return money end in `Cents`.
- Throw `AppError("E_UPPER_SNAKE", msg)` from `src/errors.js`, never a bare `Error`.
- No `console.*`. Log via `log()` from `src/log.js`.

## Done means
`npm run typecheck`, `npm run lint` and `npm test` all pass.
```

**Imports.** `@path/to/file` inside a CLAUDE.md pulls that file in at launch. Paths are relative to the file that contains the import. Imports nest up to four hops. `@` inside backticks or a code block is not an import.

```markdown
See @README.md for the overview and @package.json for scripts.
- Git workflow: @docs/git-instructions.md
```

Imports don't save context (they load at launch too). They help organisation. To save context, use `.claude/rules/*.md` files with a `paths:` frontmatter so they load only when Claude touches matching files:

```markdown
---
paths:
  - "src/api/**/*.ts"
---
- Every endpoint validates input with zod.
```

**Use AGENTS.md as the source of truth.** Create `CLAUDE.md` next to it:

```markdown
@AGENTS.md

## Claude Code
- Use plan mode for changes under `src/billing/`.
```

Claude reads the import first, then your Claude-only notes. (A symlink, `ln -s AGENTS.md CLAUDE.md`, also works, but avoid it if anyone on the team uses Windows.)

**Check that it loaded.** `/context` lists loaded files under **Memory files**. `/memory` lists your CLAUDE.md files and lets you open them in your editor. `/doctor prompt-audit` (2.1.283+) has Claude look for stale or conflicting instructions across your CLAUDE.md, AGENTS.md, rules and skills.

**Details worth knowing.**
- HTML block comments (`<!-- note to maintainers -->`) are stripped before the file goes into context, so they cost nothing.
- Instructions given only in chat are lost on `/compact`; the project-root CLAUDE.md is re-read from disk and survives.
- For a monorepo where other teams' files get picked up, `claudeMdExcludes` in settings skips them.

## Codex CLI

**Where files live.** Codex builds one instruction chain per session:

1. **Global**: in the Codex home directory (default `~/.codex`, override with `CODEX_HOME`), `AGENTS.override.md` if it exists, otherwise `AGENTS.md`. First non-empty file wins.
2. **Project**: walking from the project (git) root down to your working directory, in each directory `AGENTS.override.md`, else `AGENTS.md`, else any name in `project_doc_fallback_filenames`. At most one file per directory.
3. Files are concatenated root to cwd, so files closer to where you launched come later and win on conflict.

In the global scope an empty file is skipped. In a project directory Codex picks the file by whether it exists, so an *empty* `AGENTS.override.md` hides that directory's `AGENTS.md`. Nested directories get their own `AGENTS.md`, exactly like Claude Code's subdirectory `CLAUDE.md`.

**Generate a first draft.** `/init` inside a session creates an `AGENTS.md` in the current directory. Same rule as above: cut what the agent could read from the code.

**Size limit.** `project_doc_max_bytes` defaults to 32 KiB for the project chain (the global `~/.codex/AGENTS.md` is not counted). A file that crosses the limit is truncated partway, not skipped. Raise it in `~/.codex/config.toml` if a monorepo needs more, but better to trim:

```toml
# ~/.codex/config.toml
project_doc_max_bytes = 65536
project_doc_fallback_filenames = ["TEAM_GUIDE.md", ".agents.md"]
```

**Reusing a CLAUDE.md.** There is no import syntax in the Codex docs, so don't try to make `AGENTS.md` pull in another file. Instead:

- Make `AGENTS.md` the real file (recommended). Claude Code imports it, Codex reads it.
- If a repo already has only a `CLAUDE.md` and you can't add files, add `project_doc_fallback_filenames = ["CLAUDE.md"]` to your Codex config. It is used only in directories that have no `AGENTS.md`.

**Personal overrides.** Put personal preferences in `~/.codex/AGENTS.md`. Use `AGENTS.override.md` for a temporary local change (for example a stricter rule while you debug); delete it afterwards, since a stray override higher in the tree silently hides the normal `AGENTS.md` in that directory.

**Check that it loaded.** Codex has no command that lists loaded files. Start a fresh session and ask: `Summarize your current instructions for this repo.` Or from the shell: `codex --ask-for-approval never "Summarize the current instructions."` (the flag stops it from pausing at an approval prompt). Use `codex --cd <subdir>` to test how a nested `AGENTS.md` changes the answer. If nothing loads: the file may be empty, you may be outside the project root, an `AGENTS.override.md` (even an empty one) may be shadowing it, the project may be untrusted (untrusted projects load no project docs), or the root was not found (it is located through `project_root_markers`, default `.git`). Restarting Codex rebuilds the chain.

**Same file, both tools.** A minimal `AGENTS.md` for the example above works unchanged in Codex, and in Claude Code through the two-line `CLAUDE.md`. Test both once: open the repo in each CLI and ask the same "summarise your instructions" question.
