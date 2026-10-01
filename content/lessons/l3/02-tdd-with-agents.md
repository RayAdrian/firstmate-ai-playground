---
slug: l3-tdd-with-agents
level: 3
sort: 2
title: TDD with agents
objective: Write the failing tests yourself, lock them, have the agent implement until they pass, and make sure it can't win by editing the tests.
est_minutes: 30
tool_versions:
  claude_code: "2.1.284"
  codex_cli: "0.154.0"
last_verified_on: "2026-09-30"
differences:
  - "Claude Code can deny edits to a path with a permission rule such as `Edit(tests/**)` in `permissions.deny`, passed inline with `--settings`. Codex does the equivalent with a permission profile (beta) or an AGENTS.md instruction, and neither is airtight."
  - "A Claude Code deny rule covers its file tools and recognised Bash commands such as `sed` and `tee`. It does not cover a script that writes files indirectly, so a hash check outside the agent is still the real guard."
  - "Codex permission profiles are marked beta and don't combine with `--sandbox` or `sandbox_mode`. Claude Code permission rules work with any permission mode."
exercise: ex-3-2-tdd
claude_no_equivalent: false
codex_no_equivalent: false
---

## Concept

Test-driven development suits agents because "make these tests pass" is a goal the agent can check for itself. The tests are the spec. Your job is to make the spec right.

The loop:

1. **You write the tests** from the requirements. Cover each rule, the boundaries, and the invalid inputs. Run them and watch them fail for the right reason.
2. **Lock the tests.** Commit them and record a hash of the test files.
3. **The agent implements.** Tell it the tests are the contract and it must not touch them.
4. **Verify outside the agent.** Run the tests, then confirm the test files still match the recorded hash.
5. **Refactor** with the tests still locked.

The failure mode to design against is an agent that turns a red test green by editing the test: loosening an assertion, deleting a case, adding `.skip`, or changing an expected value to whatever the code returns. It usually does this with good intentions, because it believes the test is wrong. Treat that as a question for you, not a decision for the agent.

Layers of protection, weakest to strongest:

- **Instruction**: "Do not modify anything under `tests/`. If a test looks wrong, stop and tell me why."
- **Tool permissions**: deny edits to the test directory.
- **Verification**: `git diff --exit-code -- tests/` or a stored hash, run by you or CI. This one can't be argued with.

Use all three. The first two prevent the problem cheaply. The third catches whatever got through.

```diagram
type: flow
id: tdd-lock-loop
title: Keeping the tests as the spec
summary: Lock the tests before the agent starts, then verify outside the agent. If the agent edits a test to get green, the stored hash no longer matches.
steps:
  - id: red
    label: Tests fail
    sub: you write them
  - id: lock
    label: Lock
    sub: commit, hash
  - id: impl
    label: Implement
    sub: agent
  - id: verify
    label: Verify
    sub: tests, hash
    emphasis: true
exits:
  - from: impl
    label: edits a test
    text: Fake green
    style: risk
```

### First Mate tip

Client specs are usually prose in a ticket. Turn each sentence of business rule into one named test before the agent starts. It exposes the ambiguities ("does free shipping start at 5000 or above 5000?") while asking the client is still cheap, and the tests become the acceptance evidence you hand over with the PR.

## Claude Code

Write and commit the tests yourself (or have Claude draft them in a separate step that you review). Confirm they fail:

```bash
npm test
git add tests && git commit -m "Add pricing tests"
```

Start the implementation session with a deny rule on the test directory. `--settings` accepts a JSON string, so you don't need to edit a settings file:

```bash
claude --settings '{"permissions":{"deny":["Edit(tests/**)"]}}'
```

As a deny rule, `Edit(tests/**)` matches a `tests` directory at any depth under the current directory. A `Read` deny would also block Edit and Write on that path, but it stops Claude reading the tests too, which you don't want. Path rules are checked against `Edit(...)` and `Read(...)` only, so don't write them for `Write` or `MultiEdit`.

Prompt:

```text
Implement src/pricing.js so that `npm test` passes. The tests in tests/ are the
contract: do not edit, delete, skip or rename any of them. If you believe a test
is wrong, stop and explain which assertion and why; do not change it.
Run `npm test` after each change and report the final output.
```

Deny rules cover Claude's file tools, and Bash commands Claude Code recognises such as `cat`, `sed`, `tee` and redirects. They don't cover a Python or Node script that writes files indirectly. So check afterwards, yourself:

```bash
git diff --exit-code -- tests/ && echo "tests untouched"
```

For a stronger guard, a `PreToolUse` hook can reject edits to a path before they run. See https://code.claude.com/docs/en/hooks.

## Codex CLI

The same workflow. Commit the tests first, then start the implementation session in the workspace-write sandbox:

```bash
codex -s workspace-write "Implement src/pricing.js so that npm test passes. \
The tests in tests/ are the contract: do not edit, delete, skip or rename any \
of them. If a test looks wrong, stop and explain instead of changing it. \
Run npm test after each change."
```

Put the standing rule in `AGENTS.md` so it applies to every session:

```markdown
## Tests

- Never modify files under `tests/` unless the user explicitly asks in this session.
- If a test seems wrong, stop and report the assertion and the reason.
```

Codex permission profiles (marked beta in the docs) can also deny or downgrade filesystem paths inside the workspace. The docs show `".devcontainer" = "read"` and `"**/*.env" = "deny"` under `[permissions.<name>.filesystem.":workspace_roots"]`; a test directory would follow the same pattern:

```toml
default_permissions = "tdd"

[permissions.tdd]
extends = ":workspace"

[permissions.tdd.filesystem.":workspace_roots"]
"tests" = "read"
```

Profiles don't compose with `--sandbox`/`sandbox_mode`: if either is set, Codex uses the older settings instead and the `tests` rule is ignored. When you use the profile, drop `-s workspace-write` and start plain `codex`. Because the feature is beta, always confirm with the outside check:

```bash
git diff --exit-code -- tests/ && echo "tests untouched"
```

In a script, `codex exec --sandbox workspace-write "..."` runs the same prompt non-interactively.
