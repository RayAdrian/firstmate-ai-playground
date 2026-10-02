# ex-4-6: Package a skill and a command as a plugin

Build `fm-team-kit`, the smallest useful plugin: a manifest, one skill and one command. Then check it two ways: with the script in this repo, and with the real validator.

## Setup

```bash
cp -r exercises/ex-4-6-plugin/starter ~/fm-ex/ex-4-6-plugin
cd ~/fm-ex/ex-4-6-plugin
git init -b main && git add -A && git commit -m "starter"
npm test        # red
```

No dependencies to install. Read `SPEC.md` first: it fixes the names and the contents.

## What to do

1. **Write the manifest** at `plugin/.claude-plugin/plugin.json`.
2. **Write the skill** at `plugin/skills/pr-description/SKILL.md`.
3. **Fix the draft command.** Someone started `changelog.md` and saved it in the wrong place. Find it, move it to `plugin/commands/changelog.md`, and add the frontmatter the spec asks for.
4. **Validate.**

   ```bash
   npm run validate                 # this repo's script: prints every problem
   claude plugin validate ./plugin  # Claude Code's own validator (Claude Code only)
   ```

5. **Try it.** Load the plugin for one session without installing it:

   ```bash
   claude --plugin-dir ./plugin
   ```

   Run `/fm-team-kit:changelog 1.4.0` and ask "write a PR description for my changes". After you edit a file, `/reload-plugins` picks the change up.
6. **Stretch: a team marketplace.** Add `.claude-plugin/marketplace.json` at the repo root, next to `plugin/`, with one entry (`name` `fm-team-kit`, `source` `./plugin`). Then install it by name:
   - Claude Code: `claude plugin marketplace add ./` then `claude plugin install fm-team-kit@<your marketplace name>`.
   - Codex: `codex plugin marketplace add .` then `codex plugin add fm-team-kit@<your marketplace name>`.

   Clean up afterwards so the exercise does not stay in your real setup: `claude plugin uninstall fm-team-kit@<name>` and `claude plugin marketplace remove <name>`, or `codex plugin remove fm-team-kit@<name>` and `codex plugin marketplace remove <name>`.

## Verify

```bash
npm test
```

The tests check the manifest fields, the layout (only `plugin.json` inside `.claude-plugin/`), the skill, the command, and, if you added them, a hooks file and the marketplace entry. Whether the plugin really loads in the tool is on the checklist.
