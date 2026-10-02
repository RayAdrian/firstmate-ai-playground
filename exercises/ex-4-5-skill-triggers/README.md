# ex-4-5: Fix a skill that never triggers

A teammate wrote a `release-notes` skill for this repo. It never fires: ask for release notes and the agent writes them from scratch, in its own format. Your job is to find out why, and fix it.

## Setup

```bash
cp -r exercises/ex-4-5-skill-triggers/starter ~/fm-ex/ex-4-5-skill-triggers
cd ~/fm-ex/ex-4-5-skill-triggers
git init -b main && git add -A && git commit -m "starter"
npm test        # red
```

No dependencies to install.

## What to do

1. Run `npm run check`. It prints every problem it finds, in plain words.
2. Work out what is wrong before you change anything. Use the troubleshooting list from the lesson: where the tool looks, whether the frontmatter parses, what the description says, what could block automatic use.
3. Fix the skill:
   - **Move it, do not copy it.** Claude Code reads `.claude/skills/<name>/SKILL.md`. Codex reads `.agents/skills/<name>/SKILL.md`. Use either, or both. Keep `template.md` with it.
   - Leave nothing behind in the old `skills/` folder.
   - Rewrite the description so it says what the skill produces and when to use it, in the words people type.
4. Run `npm test` until it is green. Do not edit `tests/` or `scripts/`.
5. Prove it in the tool. Start a **fresh** session in the repo (if you keep an old one open, a brand-new `.claude/skills/` folder needs `/reload-skills` in Claude Code, and Codex needs a restart if the skill does not appear) and type a natural request, not the skill name:

   ```text
   What changed since the last tag? I need a changelog for the team
   ```

   Claude Code: run `/skills` first and confirm `release-notes` is listed, then check that the request loads it. Codex: run `/skills` or type `$` to confirm it is listed, then check that the request picks it.

## Verify

```bash
npm test
```

The tests check the location, the frontmatter, the name, the description (what, when, the words people type, and not too broad), that nothing blocks automatic use, and that the supporting file travels with the skill. Whether the agent really loads the skill is on the checklist.
