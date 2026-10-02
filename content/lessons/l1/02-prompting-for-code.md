---
slug: l1-prompting-for-code
level: 1
sort: 2
title: Prompting for code
objective: Write asks with context, constraints, examples and a verification criterion. Reference files with @path and attach images.
est_minutes: 30
tool_versions:
  claude_code: "2.1.284"
  codex_cli: "0.154.0"
last_verified_on: "2026-09-30"
differences:
  - "Images: Codex CLI has a flag (`codex -i shot.png \"...\"`, or `--image a.png,b.png`). Claude Code has no image flag. Drag the file into the window, paste with Ctrl+V, or put the file path in the prompt."
  - "File references: both use `@` in the prompt to search for a file. Codex also has `/mention <path>`. Claude Code also has `@server:resource` for MCP resources, and an `@` file reference pulls in the `CLAUDE.md` files in that file's directory and parents."
  - "Plan first: Claude Code uses `Shift+Tab` to plan mode or `claude --permission-mode plan`. Codex uses `/plan` or `Shift+Tab`. Lesson 3.1 goes deeper."
  - "Piped input works in one-shot mode for both, but with different commands: `claude -p` and `codex exec`."
exercise: ex-1-2-vague-vs-precise
claude_no_equivalent: false
codex_no_equivalent: false
tldr:
  points:
    - "Put the goal, context, constraints and a done-when check in every prompt."
    - "Point at files with `@path` instead of describing where the code lives."
    - "Pipe logs into one-shot mode: `cat build.log | claude -p` or `| codex exec`."
  try_this:
    claude: { kind: prompt, text: "Explain the logic in @src/utils/auth.js" }
    codex: { kind: prompt, text: "Explain the logic in @src/utils/auth.ts" }
---

## Concept

The agent can read your repo, but it cannot read your mind. The quality of the result tracks how much of the following you put in the prompt. Both vendors' own guidance lands on the same checklist:

| Part | Question it answers | Weak | Strong |
|---|---|---|---|
| **Goal** | What should change? | "fix the login bug" | "users are logged out after the session times out; make token refresh work" |
| **Context** | Which files, errors, patterns matter? | (nothing) | "see `src/auth/refresh.ts`, and follow how `src/auth/login.ts` handles errors" |
| **Constraints** | What must hold? | (nothing) | "no new dependencies; do not change the public API; do not edit existing tests" |
| **Done when** | How do we know it worked? | "looks good" | "write a failing test that reproduces it first, then make `npm test` pass" |

The last row matters most. The agent stops when the work looks done. If you give it a check it can run (a test command, a build, a linter, a script that diffs output against a fixture), it can loop on its own failures. Without one, you are the verification loop.

Three techniques that pay off immediately:

1. **Give examples.** Two or three input and output pairs remove more ambiguity than a paragraph of prose. They also become your test cases.
2. **Point at existing patterns.** "Follow how `HotDogWidget` is built" beats describing conventions from scratch.
3. **Describe the symptom, the likely location and what fixed looks like**, rather than prescribing the fix. The agent may find a better fix than the one you imagined.

A precise prompt is not a long prompt. It is one where every sentence removes a decision the agent would otherwise guess. A vague prompt is fine for exploring ("what would you improve in this file?"). It is a poor fit for work you intend to merge.

Here is one task written both ways.

```text title="vague"
add a date range parser
```

```text title="precise"
Add parseDateRange(input, today) to src/parseDateRange.ts.
- input forms: "2026-03-01 to 2026-03-15", "2026-03-15", "last 7 days", "this month".
- dates are YYYY-MM-DD strings; `today` is a YYYY-MM-DD string. Never read the system clock or the local time zone.
- returns { start, end }, both inclusive.
- throw RangeError for impossible dates (2026-02-30) and for start after end.
Examples: ("last 7 days", "2026-03-03") -> { start: "2026-02-25", end: "2026-03-03" }.
Keep it in one file with no new dependencies.
Done when `npm test` passes, including new tests you add for every example above.
```

### First Mate tip

A client ticket already contains a spec. Paste its acceptance criteria into the prompt as the "done when", and ask for one test per criterion. When a criterion is ambiguous, that is a question for the client or the PM, not something to leave the agent to guess. The vague-versus-precise gap costs the most on client MVPs where you will not revisit the code for weeks.

## Claude Code

### Reference files

Type `@` to open a path picker. Press Tab or Enter to accept the highlighted path.

```text title="claude prompts"
Explain the logic in @src/utils/auth.js
What's the structure of @src/components?
Compare @src/old.ts and @src/new.ts and list behavior differences
```

Referencing a file adds its content up front so Claude does not have to go and find it. It also adds the `CLAUDE.md` in that file's directory and parent directories. Referencing a directory gives a listing, not every file's content. You can reference several files in one message.

### Attach images

Add a screenshot, mockup or diagram in any of these ways:

- Drag and drop the image into the Claude Code window.
- Copy an image and paste it with `Ctrl+V` (`Alt+V` on Windows and WSL).
- Put the path in the prompt: `Analyze this image: /path/to/screenshot.png`.

Then say what to look at and what result you want:

```text title="claude prompt"
[paste screenshot] Implement this design. Then take a screenshot of the result,
compare it to the original, list the differences and fix them.
```

### Pipe data in

For one-shot use, pipe into `-p` (print mode, the non-interactive flag):

```bash title="terminal"
cat build.log | claude -p "why did this build fail? one paragraph, then the fix"
```

### Plan before you code

For a change that touches several files or that you are unsure about, separate research from edits. Press `Shift+Tab` until the status bar shows `plan mode`, or start in it:

```bash title="terminal"
claude --permission-mode plan
```

Claude reads and explores without editing. Review the plan, edit it (`Ctrl+G` opens it in your editor), then approve. If you could describe the diff in one sentence, skip planning.

### Course-correct early

If you have corrected Claude more than twice on the same issue, the conversation is cluttered with failed attempts. Run `/clear` and restart with a sharper prompt that includes what you learned.

## Codex CLI

### Reference files

Type `@` in the composer to search for a file in the workspace and add its path to the prompt. You can also attach a file explicitly:

```text title="codex prompts"
Explain the logic in @src/utils/auth.ts
/mention src/lib/api.ts
```

Use the four-part shape from the Concept section. The Codex best-practices guide names the same parts: goal, context (with `@` mentions), constraints, and done-when.

```text title="codex prompt"
Goal: token refresh fails after session timeout; fix it.
Context: @src/auth/refresh.ts, follow the error handling in @src/auth/login.ts.
Constraints: no new dependencies, do not change the public API, do not edit existing tests.
Done when: a new failing test reproduces the bug first, then `npm test` passes.
```

### Attach images

Paste an image into the interactive composer, or pass files when you start:

```bash title="terminal"
codex -i screenshot.png "Explain this error and suggest the smallest fix"
codex --image before.png,after.png "Compare these states and list the regressions"
```

Separate multiple paths with commas or repeat `--image`. PNG and JPEG work. Write the prompt around the image: say what it shows, which area matters, and what the output and constraints are. Do not rely on the image alone to carry the task.

### Pipe data in

`codex exec` is the non-interactive command. If stdin is piped and you also pass a prompt, stdin is appended to the prompt as a `<stdin>` block:

```bash title="terminal"
cat build.log | codex exec "why did this build fail? one paragraph, then the fix"
```

### Plan before you code

For hard or ambiguous tasks, use Plan mode: toggle it with `/plan` or `Shift+Tab`. Codex gathers context, asks clarifying questions and proposes a plan before implementation. You can also paste content or attach images while using inline `/plan` arguments.

### Verify with `/review`

After the work is done, run `/review` to have Codex review your working tree for bugs and risky patterns, then use `/diff` to read the exact changes.
