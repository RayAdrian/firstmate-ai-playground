---
description: Add a CHANGELOG.md entry for a version, from the commits since the last tag
argument-hint: "[version]"
---

Add a changelog entry for version $ARGUMENTS. If no version was given, ask for one and stop.

1. Find the last tag with `git describe --tags --abbrev=0`.
2. List the commits since it with `git log <tag>..HEAD --no-merges --pretty=format:'%s'`.
3. Group them under Added, Changed and Fixed and add the entry at the top of CHANGELOG.md.
