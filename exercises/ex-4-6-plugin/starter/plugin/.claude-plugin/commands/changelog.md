Add a changelog entry for version $ARGUMENTS.

1. Find the last tag with `git describe --tags --abbrev=0`.
2. List the commits since it with `git log <tag>..HEAD --no-merges --pretty=format:'%s'`.
3. Group them under Added, Changed and Fixed and add the entry at the top of CHANGELOG.md.
