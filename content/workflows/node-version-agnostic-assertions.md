---
title: Node-version-agnostic test assertions for agent-written tests
problem: Tests that pass on one Node version fail on another because of error-message and output details.
tools: [claude-code]
use_cases: [testing]
stacks: [node, typescript]
related_lesson: l3-tdd-with-agents
tool_versions:
  claude_code: 2.1.286
verified_on: 2026-10-01
client_safe: confirmed
---

## Result

### Before
A test asserted on the `node:test` summary line `ℹ pass 3`. It passed on one Node version and failed on another, which prints `# pass 3` instead. A `node --test test/` directory argument also behaved differently across versions, so the same suite was red on a teammate's machine.

### After
Assertions match what is stable across Node 20, 22 and 26: error `code` fields instead of message text, a regex that accepts both summary prefixes, and explicit `test/*.test.js` globs. The exercise suites were run on three Node majors and passed on each.

## Setup

```markdown path=AGENTS.md kind=context-file
### Tests must not depend on the Node version
- Assert on `error.code` or `instanceof`, never on `error.message` (V8 and Node reword messages).
- Never assert on exact CLI or reporter output. If you must, match with a regex that tolerates
  both the `ℹ` and `#` summary prefixes: /(?:ℹ|#) pass 3\b/.
- Pass explicit globs to `node --test` (`test/*.test.js`), not a directory.
- Before reporting done, run the suite on the oldest and newest Node we support.
```

```bash path=scripts/test-on-node.sh kind=script
#!/usr/bin/env bash
# Usage: scripts/test-on-node.sh <major> [command...]   (default command: npm test)
set -euo pipefail
MAJOR=$1; shift
DIR="${TMPDIR:-/tmp}/node-$MAJOR"
mkdir -p "$DIR"
[ -x "$DIR/node_modules/.bin/node" ] || (cd "$DIR" && npm init -y >/dev/null && npm i "node@$MAJOR" --silent)
PATH="$DIR/node_modules/.bin:$PATH"
node --version
if (($# == 0)); then npm test; else "$@"; fi
```

## Prompt

```text
Write the tests for <feature> first. Rules from AGENTS.md "Tests must not depend on the Node version" apply.
When the suite is green, run it on the oldest and newest supported Node majors with
`scripts/test-on-node.sh 20` and `scripts/test-on-node.sh 26`.
For any failure that differs between versions, fix the assertion (not the code) and say what was version-specific.
```

## Steps

1. Add the rules to `AGENTS.md` and commit `scripts/test-on-node.sh`.
2. Tell the agent which Node majors the project supports (for example 20, 22 and 26).
3. Let it write tests first, then run them on each major with the script.
4. Replace any assertion that differs by version with a `code`, `instanceof` or tolerant regex check.
5. Repeat the cross-version run in review before merging.

## Why it works

Agents write assertions from whatever output they just saw, so they copy version-specific text such as reporter prefixes and error messages. Writing the rule into the context file and forcing a run on the oldest and newest Node moves the failure to the agent's own loop, before a teammate or CI on a different version finds it.
