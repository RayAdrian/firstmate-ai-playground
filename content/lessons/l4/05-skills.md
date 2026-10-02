---
slug: l4-skills
level: 4
sort: 5
title: "Skills"
objective: "Write skills the agent actually loads: know how it decides, structure multi-file skills, place and share them, tell a skill from CLAUDE.md, hooks, commands and subagents, and debug one that does not trigger."
est_minutes: 45
tool_versions:
  claude_code: "2.1.287"
  codex_cli: "0.154.0"
last_verified_on: "2026-10-02"
differences:
  - "Where skills live: Claude Code reads `.claude/skills/<name>/SKILL.md` (project), `~/.claude/skills` (personal), nested `.claude/skills` in subfolders, plugins and managed settings. Codex reads `.agents/skills/<name>/SKILL.md` in every folder from your working directory up to the repo root, `~/.agents/skills`, `/etc/codex/skills` and its built-in system skills."
  - "Invoking: Claude Code runs a skill as `/name` (with `$ARGUMENTS`) or loads it when your request matches the description. Codex runs it from `$name` or `/skills`, or picks it itself from the description. To stop automatic use, Claude Code has `disable-model-invocation: true` in the frontmatter, and Codex has `allow_implicit_invocation: false` in `agents/openai.yaml`."
  - "Frontmatter: Claude Code documents many fields (`allowed-tools`, `context: fork`, `hooks`, `paths`, `model`, `argument-hint` and more). The Codex docs describe only `name` and `description` in `SKILL.md`, and put UI metadata, invocation policy and tool dependencies in `agents/openai.yaml`. A skill that uses just `name` and `description` works in both."
  - "Listing budget: both tools keep only each skill's name and description in context, and shorten descriptions when you have many skills. Claude Code gives the list 1% of the context window and caps each entry at 1,536 characters. Codex gives it 2% of the context window (8,000 characters when the window is unknown) and shortens descriptions first."
  - "Debugging: Claude Code has `/skills`, `--debug`, `claude plugin validate .claude/skills`, `/skill-doctor` and `/reload-skills`. Codex has `/skills` and the `$` picker, and detects changes on its own (restart if a skill does not appear). Disable a Codex skill without deleting it with a `[[skills.config]]` entry in `~/.codex/config.toml`."
exercise: ex-4-5-skill-triggers
claude_no_equivalent: false
codex_no_equivalent: false
---

## Concept

Lesson 4.4 gave you the short version: a skill is a folder with a `SKILL.md`. This lesson is about making skills work reliably, because a skill that never loads is worse than no skill: someone wrote it, and the team believes it is being followed.

**What a skill is.** A named procedure the agent can load when it fits: how to review a migration, scaffold a route, write release notes. It lives in a folder, so it can carry templates, reference docs and scripts next to its instructions. Use a skill when you keep pasting the same checklist into chat, or when a section of `CLAUDE.md` or `AGENTS.md` has grown from a fact into a procedure.

**When the agent loads it.** The agent does not read every skill up front. It uses progressive disclosure:

1. **Always in context:** each skill's name and description, a few lines each.
2. **When the skill is used:** the full `SKILL.md` body is loaded, either because you invoked it by name or because the agent decided your request matches the description.
3. **On demand:** supporting files and scripts, read or run only if the body tells the agent to.

```diagram
type: stack
id: skill-loading
title: What a skill costs, and when it loads
summary: Only the name and description sit in context all the time. The SKILL.md body loads when the skill is used, and supporting files load only when the body points to them.
layers:
  - id: desc
    label: Name and description
    sub: always in context
  - id: body
    label: SKILL.md body
    sub: loads when it is used
    emphasis: true
  - id: files
    label: Supporting files
    sub: read on demand
axis:
  low: always loaded
  high: loaded on demand
```

So the **description is the trigger**. The agent matches your request against it, and nothing else. A description that says what the skill does and when to use it, in the words a person would type, loads at the right moment. A vague one never does.

| Weak | Strong |
|---|---|
| `Helps with migrations` | `Review a SQL or Supabase migration for unsafe changes (table locks, dropped columns, missing RLS). Use when the user asks to review, check or sanity-check a migration or schema change.` |

Write it as "what it does" plus "Use when ..." with the phrases people really say. Put the key use case first, because long descriptions are cut. Keep it specific: "Use when the user asks about databases" makes the skill fire on everything.

**A skill is not the other tools.** They overlap, so pick by how much you need to count on it:

| Mechanism | Loads | Use it for |
|---|---|---|
| `CLAUDE.md` / `AGENTS.md` | Every session, in full | Facts and rules that always apply: commands, conventions, "never touch X". |
| Skill | Description always, body when used | A procedure for one kind of task: steps, templates, scripts. |
| Hook | Runs on a lifecycle event, no model decision | Something that must happen every time, and a script can check. A skill cannot promise that. |
| Slash command | Only when you type it | Claude Code merged custom commands into skills, so a skill with `disable-model-invocation: true` is a command. Codex deprecated its file-based custom prompts in favour of skills. |
| Subagent | A separate context with its own prompt and tools | Delegating work so the main session stays small. A skill runs in your conversation instead; Claude Code can also run one in a subagent with `context: fork`. |

If a rule must hold every time, a skill is the wrong tool: move it to a hook.

**Multi-file skills.** `SKILL.md` stays short and navigates. Detail goes beside it:

```text
review-migration/
├── SKILL.md            required: metadata and the steps
├── checklist.md        read when the skill says so
└── scripts/
    └── lint-migration.sh   run, not read
```

Reference each file from `SKILL.md` and say when to use it ("Walk through checklist.md for anything the script cannot see"). A script's source never enters context: only its output does, so put deterministic work in scripts and judgement in the instructions. Claude Code recommends keeping `SKILL.md` under 500 lines.

**Project or personal.** A project skill is committed to the repo, so everyone who clones it gets it. A personal skill sits in your home folder and follows you across repos. Put a skill in the repo when it encodes how this codebase does something, and in your home folder when it is about how you work.

**Sharing.** Commit project skills. For several repos, package them as a plugin (lesson 4.6). Claude Code can also deploy skills organisation-wide through managed settings.

**When a skill does not trigger**, check in this order:

1. **Is it listed?** Ask the tool what skills it has (`/skills`). If it is missing, it is in the wrong place, the file is not named exactly `SKILL.md`, or the frontmatter is broken.
2. **Does the frontmatter parse?** A broken block makes some tools load the skill with no metadata: you can still run it by name, but the description never matches.
3. **Does the description match the request?** Read it as the agent would. Does it contain the words you actually typed?
4. **Is automatic use switched off?** A manual-only setting hides the skill from the agent.
5. **Are there too many skills?** The list has a budget, and long descriptions get shortened or dropped.
6. **Does it work when you invoke it by name?** If yes, the skill is fine and the description is the problem.

### First Mate tip

On a client MVP, the skills worth writing are the ones that make the tenth task look like the first: "add an API route", "review a migration", "write release notes". Commit them in the repo so a new contractor gets them on day one, and keep each to one job. When one does not fire, do not add "ALWAYS use this skill" to the instructions file: fix the description, or turn the rule into a hook. After you write a skill, test it with the sentences a client or a teammate would really say, in a fresh session, and keep those sentences with the skill.

## Claude Code

### Where skills live

| Location | Path | Loads in |
|---|---|---|
| Personal | `~/.claude/skills/<name>/SKILL.md` | All your projects |
| Project | `.claude/skills/<name>/SKILL.md` | Sessions in this repo. Commit it. |
| Nested | `<subdir>/.claude/skills/<name>/SKILL.md` | Loaded when Claude works on files there. In a monorepo it is not in the `/` menu until then. |
| Plugin | `<plugin>/skills/<name>/SKILL.md` | Where the plugin is enabled, as `/plugin-name:skill-name` |
| Enterprise | `.claude/skills/` in the managed settings directory | All users on machines your organisation deploys to |

Claude Code also loads project skills from every parent directory up to the repo root, so starting in `packages/web/` still finds the root skills. The folder name becomes the command: `.claude/skills/review-migration/` is `/review-migration`. When two locations define the same name, enterprise wins over personal, and personal over project. A skill named like a bundled command (for example `code-review`) replaces it. Claude Code watches the skills folders, so edits apply in the running session. Only if you create a top-level skills folder that did not exist when the session started do you need `/reload-skills`.

### Frontmatter

Every field is optional, but `description` is strongly recommended. Field names must match exactly: an unknown field is ignored without an error, so a typo such as `disable_model_invocation` silently does nothing. The opening `---` must be the file's first line.

| Field | What it does |
|---|---|
| `name` | The command name. Defaults to the folder name. |
| `description` | What the skill does and when to use it. The trigger. |
| `when_to_use` | Extra trigger phrases, appended to the description. Both together are cut at 1,536 characters in the listing. |
| `disable-model-invocation: true` | Only you can run it. Use for anything with side effects (`/deploy`, `/commit`). The description is then not in Claude's context at all. |
| `user-invocable: false` | Only Claude can use it. For background knowledge that is not a meaningful command. |
| `allowed-tools` | Tools pre-approved for the turn that runs the skill. It grants approval; it does not restrict. |
| `argument-hint`, `arguments` | Autocomplete hint, and named arguments for `$name` substitution. |
| `context: fork`, `agent` | Run the skill in a separate subagent. The skill body must be a task, not just guidelines. |
| `hooks` | Hooks registered while the skill is active. |
| `paths` | Glob patterns: load the skill automatically only when working on matching files. |
| `model`, `effort` | Model and effort for the turn the skill runs. |

`$ARGUMENTS`, `$0`, `$1` and `$name` in the body are replaced with what you typed after the command. `${CLAUDE_SKILL_DIR}` is the folder holding the `SKILL.md`, which is how a skill points at its own scripts wherever it is installed. A line such as ``!`git diff HEAD` `` runs the command before Claude sees the skill, so the output is inlined.

### A multi-file skill

**`.claude/skills/review-migration/SKILL.md`**

```markdown
---
name: review-migration
description: Review a SQL or Supabase migration for unsafe changes (table locks, dropped columns, missing RLS). Use when the user asks to review, check or sanity-check a migration or schema change.
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/lint-migration.sh *)
---

Review the migration the user names (default: the newest file in `supabase/migrations/`).

1. Run `${CLAUDE_SKILL_DIR}/scripts/lint-migration.sh <file>` and note what it flags.
2. Walk through [checklist.md](checklist.md) for anything the script cannot see.
3. Report findings as blocking, should fix, or fine. Do not edit the migration.
```

The same `${CLAUDE_SKILL_DIR}` in `allowed-tools` and in the body means the rule matches the exact command the skill tells Claude to run, so the script runs without a permission prompt. `allowed-tools` in a repo skill is a permission grant: review it in a PR the way you review a hook.

### Control, share, and keep it small

- `disable-model-invocation: true` removes the skill from Claude's context. `user-invocable: false` keeps Claude able to use it but hides it from the `/` menu. Use `skillOverrides` in settings (or the `/skills` menu) to change visibility without editing a shared `SKILL.md`.
- Share by committing `.claude/skills/`, by a plugin, or through managed settings. A skill folder can be a symlink to a directory elsewhere.
- A loaded skill stays in the conversation, but after auto-compaction Claude Code keeps only the first 5,000 tokens of each, so put the important rules at the top. Phrase standing rules for the whole task ("run the tests after every edit"), because the file is not re-read each turn.
- Run `/skill-doctor` to see what each skill costs and which ones were never used.

### Debugging a skill that does not trigger

1. In the session, run `/skills`, or ask "What skills are available?". Missing means the location or the file name is wrong.
2. Run `claude plugin validate .claude/skills` (or `~/.claude/skills`). It flags frontmatter that does not parse: Claude Code then loads the skill with empty metadata, so `/skill-name` still works but the description never matches. `claude --debug` shows the parse error too.
3. Rephrase your request using words from the description. If that fixes it, the description was missing the words people use.
4. Type `/skill-name` directly. If that works and the natural request does not, fix the description.
5. Many skills? Run `/doctor` for the listing's context cost, trim descriptions, or set rarely used skills to `"name-only"` in `skillOverrides`.
6. If Claude follows the skill at first and drifts later, the rule probably needs to be a hook, or invoke the skill again after a compaction.

## Codex CLI

### Where skills live

Codex reads skills from the repository, your user folder, the machine, and its own bundled set:

| Scope | Path |
|---|---|
| Repo | `.agents/skills` in your working directory and every folder above it up to the repo root |
| User | `~/.agents/skills` |
| Admin | `/etc/codex/skills` |
| System | Bundled with Codex (for example `skill-creator`) |

A repo skill is `.agents/skills/<name>/SKILL.md`. Codex follows symlinked skill folders. If two skills share a `name`, Codex does not merge them: both can appear in the selector.

### Writing and invoking one

A skill needs a `SKILL.md` with `name` and `description`; scripts, references and assets are optional. The multi-file `review-migration` skill above works in Codex with the portable parts only: drop `allowed-tools`, and point at the script by its folder-relative path, because `${CLAUDE_SKILL_DIR}` is a Claude Code substitution. The Codex skill list includes each skill's file path, so the agent can resolve it.

```markdown
---
name: review-migration
description: Review a SQL or Supabase migration for unsafe changes (table locks, dropped columns, missing RLS). Use when the user asks to review, check or sanity-check a migration or schema change.
---

Review the migration the user names (default: the newest file in `supabase/migrations/`).

1. Run `scripts/lint-migration.sh <file>` (it is in this skill's folder) and note what it flags.
2. Walk through `checklist.md` (also in this skill's folder) for anything the script cannot see.
3. Report findings as blocking, should fix, or fine. Do not edit the migration.
```

Invoke it explicitly with `$review-migration`, by typing `$` to pick it, or from `/skills`. Codex can also choose it itself when your task matches the description, so write the description the same way.

Codex has built-in helpers: `$skill-creator` asks what the skill does and when it should trigger, and `$skill-installer` installs curated skills.

### Optional metadata and policy

`agents/openai.yaml` next to `SKILL.md` carries what the frontmatter does not: UI metadata, invocation policy and tool dependencies.

```yaml
policy:
  allow_implicit_invocation: false
```

With `false`, Codex does not pick the skill from your prompt, and `$name` still works. The default is `true`. To turn a skill off without deleting it, add this to `~/.codex/config.toml` and restart Codex:

```toml
[[skills.config]]
path = "/path/to/skill/SKILL.md"
enabled = false
```

### Sharing

Commit `.agents/skills/` so the repo carries its skills. To reuse skills across repos or ship them with a connector, package them as a plugin (lesson 4.6). Both tools document symlinked skill folders, so `.agents/skills/<name>` could point at `.claude/skills/<name>`. This repo copies the folder instead, and CI checks the copies are identical, so nothing depends on symlink handling.

### Debugging a skill that does not trigger

1. Run `/skills` or type `$`. If the skill is not listed, check the folder is `.agents/skills/<name>/SKILL.md` somewhere between your working directory and the repo root, and that `name` and `description` are both present. Codex detects changes by itself; restart if it still does not appear.
2. Check `agents/openai.yaml` for `allow_implicit_invocation: false`, and `~/.codex/config.toml` for a `[[skills.config]]` entry with `enabled = false`.
3. Many skills? Codex keeps the initial list within 2% of the context window (8,000 characters when the window is unknown), shortens descriptions first, and may drop some skills with a warning. Put the key use case and trigger words at the start of each description, and remove skills you do not use.
4. Try `$name` directly. If that works, the description is the problem.
