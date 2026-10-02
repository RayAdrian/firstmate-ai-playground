# fm-team-kit: spec

A small plugin that gives every First Mate engineer the same PR and release helpers, in either tool.

## Manifest

`plugin/.claude-plugin/plugin.json`:

- `name`: `fm-team-kit` (kebab-case, no spaces)
- `version`: `1.0.0` (we pin a version, so people get an update only when we bump it)
- `description`: one line saying what the plugin gives you
- `author`: `{ "name": "First Mate" }`

Nothing else goes inside `.claude-plugin/`.

## Skill: `pr-description`

`plugin/skills/pr-description/SKILL.md`. The agent should load it when someone wants a pull request description.

- Frontmatter: `name: pr-description` and a single-line `description` that says what it does and has a "Use when ..." clause with the words people type ("PR description", "PR summary", "write up my changes").
- Body: short numbered steps. Read the branch diff against `main`, then write Summary, Why, How to test, Risks.

## Command: `changelog`

`plugin/commands/changelog.md`. You run it as `/fm-team-kit:changelog 1.4.0`.

- Frontmatter: `description` (and an optional `argument-hint`).
- Body: add an entry for the version in `$ARGUMENTS` to `CHANGELOG.md`, grouped as Added, Changed, Fixed, from the commits since the last tag. If `$ARGUMENTS` is empty, ask for the version.

## Optional stretch

A team marketplace so teammates can install it by name: `.claude-plugin/marketplace.json` at the root of this repo (next to `plugin/`, not inside it), with one entry whose `name` is `fm-team-kit` and whose `source` is `./plugin`.
