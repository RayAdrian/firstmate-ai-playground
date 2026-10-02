---
name: Release Notes
description: "Release stuff and "notes" and changelogs"
disable-model-invocation: true
---

Draft release notes for the range the user names (default: since the latest tag).

1. Run `git describe --tags --abbrev=0` to find the last tag, then `git log <tag>..HEAD --no-merges --pretty=format:'%s'`.
2. Group the commits under Added, Changed and Fixed. Drop merge noise and commits that only touch docs or tests.
3. Fill in [template.md](template.md). Write for the client, not the team: no ticket numbers, no internal jargon.
4. Show the notes in chat. Do not edit CHANGELOG.md unless asked.
