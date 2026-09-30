# Spec: release notes generator

Turn a list of conventional-commit lines into a markdown release-notes section. Three parts plus glue.
Interfaces are fixed here. The tests in `tests/` are the acceptance criteria and are frozen: nobody edits them.

## Part A: parse (`src/parse.mjs`)

```js
parseCommit(line: string): { type: string, scope: string | null, breaking: boolean, subject: string } | null
parseCommits(text: string): Commit[]
```

- A conventional line looks like `type(scope)!: subject`. Scope and `!` are optional. Any amount of whitespace may follow the colon.
- `type` is lowercased. `scope` keeps its case. `breaking` is true when `!` is present.
- A line that does not match is `{ type: "other", scope: null, breaking: false, subject: <trimmed line> }`.
- A blank or whitespace-only line returns `null`.
- `parseCommits` splits on `\n` (tolerating `\r\n`), drops blank lines, and keeps order.

## Part B: group (`src/group.mjs`)

```js
groupByType(commits: Commit[]): { type: string, commits: Commit[] }[]
```

- Breaking commits go into a leading group with `type: "breaking"`, and are not repeated in their own type group.
- Then groups in this fixed order: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `chore`, `other`.
- Any type not in that list is folded into `other`.
- Empty groups are omitted. Commit order inside a group is the input order.
- Never mutate the input array or its commits.

## Part C: render (`src/render.mjs`)

```js
renderMarkdown(groups, { version: string, date: string }): string
```

- First line: `## v<version> (<date>)`, then a blank line.
- One section per group: `### <Title>`, then one bullet per commit, then a blank line.
  Titles: breaking = `Breaking changes`, feat = `Features`, fix = `Fixes`, perf = `Performance`,
  refactor = `Refactors`, docs = `Docs`, test = `Tests`, chore = `Chores`, other = `Other`.
- A bullet is `- <scope>: <subject>` when the commit has a scope, otherwise `- <subject>`.
- With no groups, the body is the single line `No user-facing changes.`
- The output ends with exactly one newline.

## Glue (`src/index.mjs`): orchestrator only

```js
releaseNotes(text: string, meta: { version: string, date: string }): string
```

`renderMarkdown(groupByType(parseCommits(text)), meta)`.

## Ownership and handoff rules

- The orchestrator writes `OWNERSHIP.json` before any worker starts. Every file under `src/` has exactly one owner.
- Workers touch only the files they own. The tests are frozen for everyone.
- Each worker leaves `handoffs/<worker>.md` with a `## Done` section and a `## Test output` section (real output, pasted).
- The orchestrator merges the worker branches one at a time, runs the full suite after each merge, then writes `src/index.mjs`.
