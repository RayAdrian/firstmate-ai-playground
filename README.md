# First Mate AI Playground

An internal playground for learning Claude Code and Codex CLI, from your first agent session to gated multi-agent pipelines, plus a daily AI news digest scored for its relevance to First Mate.

- **Curriculum:** 5 levels, 18 lessons and 18 hands-on exercises. Each lesson shows Claude Code and Codex CLI side by side.
- **News:** a daily digest of model, tooling and framework news, each item with a "why it matters for First Mate" note.
- **Workflows:** setups that worked for a First Mate engineer (a hook, a subagent, a gate script and the prompt behind it), written down so you can copy them. Readers can star a workflow and react to it.

The site runs on Vercel with a hosted Supabase project. Development and tests use a local Supabase stack. There is no sign-in: your progress lives in your browser.

## Quick start (engineers)

You need Node 22.12+, Docker and the [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
git clone https://github.com/RayAdrian/firstmate-ai-playground.git
cd firstmate-ai-playground
npm ci
supabase start                      # local Postgres on ports 544xx
cp .env.example .env.local          # fill from: supabase status -o env (API_URL, ANON_KEY, SERVICE_ROLE_KEY)
npm run seed                        # load the curriculum and the shared workflows
npm run news:import                 # load the latest news digests from the news-snapshots branch
npm run dev                         # http://localhost:3000
```

If your local stack was created before the reactions work, also run `supabase migration up --local` and then `npm run db:local-roles` once. The migration creates the `community_writer` role without a login, and `db:local-roles` gives it its local one. Never run `supabase db reset` on a shared stack.

Re-run `npm run news:import` any time to pull newer digests. Progress is saved in your browser; export or import it at `/progress`.

Exercises live in `exercises/`. Each lesson's exercise panel has a one-line setup command that copies the starter into `~/fm-ex/<exercise>`.

## Daily news job (maintainer Mac only)

One Mac runs the scoring job. Local development databases import its snapshots with `npm run news:import`. The owner points the job at the hosted project with the hosted profile (PRD §18.8, DP-4).

- `npm run news:run`: fetch, dedupe and score now (uses `claude -p` with no tools).
- `npm run news:schedule:install -- --dry-run`: preview the LaunchAgent. Drop `--dry-run` to install. It runs hourly and acts once a day after 07:00 Asia/Manila, then publishes to the `news-snapshots` branch.
- `npm run news:schedule:uninstall`: remove it. Logs are in `~/Library/Logs/fm-playground/news.log`.

## Contributing

**Before you start:** the repo is private and the owner is the only collaborator today. Ask the owner for collaborator access, because you need it to push a branch and open a PR. Do not assume a fork works: forks of a private repo depend on the owner's settings.

There are six ways to contribute. Pick yours, then follow its section.

| I want to... | Section | Lane | Who merges |
|---|---|---|---|
| Share a setup that worked for me | [Share a workflow](#share-a-workflow) | Content lane, no AI gates | Owner or a steward |
| Fix or improve a lesson, diagram or exercise | [Fix or improve a lesson](#fix-or-improve-a-lesson) | Code lane, three gates | Owner or a steward |
| Change the app or its scripts | [Change app code](#change-app-code) | Code lane, three gates | Owner or a steward |
| Suggest a news source | [Suggest a news source](#suggest-a-news-source) | Issue first, then code lane | Owner or a steward |
| Report a bug or an idea | [Report a bug or an idea](#report-a-bug-or-an-idea) | GitHub issue | n/a |
| Star or react to a workflow | [Stars and reactions](#stars-and-reactions-on-the-site) | On the site | n/a |

The rules live in `AGENTS.md` (also loaded as `CLAUDE.md`). The spec is [docs/PRD.md](docs/PRD.md) and the design system is [docs/design/DESIGN.md](docs/design/DESIGN.md). [CONTRIBUTING.md](CONTRIBUTING.md) has a shorter version of the workflow path.

### How merging works

There are two lanes. Both merge only with `npm run gate:merge -- <pr#>`, run from the primary checkout by the owner or a steward. Never use the merge button or `gh pr merge`: they cannot check the lane or that the content checks ran.

- **Content lane.** Every changed file is a direct child of `content/workflows/` named `*.md`, `_taxonomy.yaml` or `_takedowns.txt`. It needs green CI and nothing else: no gate statuses, no labels, no approval, and it need not be up to date with `main`. Human review at merge is the confidentiality control.
- **Code lane.** Anything else, including a rename into or out of that folder. It needs the three gates posted as commit statuses on the exact head commit (`gate/browser`, `gate/review`, `gate/uiux`), the three `gate:*-green` labels, green CI, and a branch that is not behind `main`. A PR that mixes both kinds of file is code lane and also runs the content checks.

Any push to a PR invalidates earlier approvals, so re-run the gates on the new head commit.

**CI is manual.** GitHub Actions does not run on this account (billing limit), so a maintainer runs it:

```bash
npm run ci:local -- <pr#>
```

It pins the PR head SHA, builds a temporary worktree at that SHA, runs the steps of `.github/workflows/ci.yml` (or only `workflows:validate` and gitleaks for a content-lane PR), and posts the commit status `ci/local` on that SHA. It uses the shared database lock, restores your seeded data afterwards, and logs to `/private/tmp/ci-local-pr<PR>-<sha7>.log`. Content-lane runs need `gitleaks` installed (`brew install gitleaks`). If you are not a maintainer, ask one to run it on your PR.

### Share a workflow

This is the main way to contribute. A workflow is one markdown file, `content/workflows/<slug>.md`, that another engineer can copy and run. The contract is PRD §16.6 and the skeleton is `content/workflows/_TEMPLATE.md`.

> **Confidentiality.** No client or prospect names, no client code, no internal URLs or ticket IDs, no secrets, no people outside First Mate. This applies to the file, every commit message, the branch name and the PR body. CI checks secrets and format only. Human review at merge is the only check for client names. If a secret was ever committed, rotate it: deleting it from git does not un-leak it.

**Fastest path: the skill.** From a clean checkout of this repo, run `/share-workflow` in Claude Code (or `$share-workflow` in Codex).

1. It runs a preflight (`npm run workflows:share -- preflight`): the origin must be this repo, the working tree clean, `gh` signed in and `origin/main` fetchable.
2. It asks three questions: what problem it solved, what changed, which files make up the setup.
3. It reads only the setup files you list, drafts the file with client detail generalised, redacts emails, hostnames, home paths and IPv4 addresses, and runs the validator and secret scan. You see the whole draft first.
4. You type `client-safe` to confirm. Only that step writes `client_safe: confirmed`.
5. It commits only that file on branch `workflow/<slug>`, pushes, and opens the PR with the `workflow` label. It never merges.

Codex needs network approval for `git push` and `gh pr create`. If that fails, use the manual path.

**Manual path.**

1. Copy `content/workflows/_TEMPLATE.md` to `content/workflows/<slug>.md`. The slug is kebab-case, 60 characters at most.
2. Fill in every `<placeholder>`. Keep the `##` sections in order and add no others.
3. Check it:

   ```bash
   npm run workflows:validate                                  # all workflows, no database needed
   npm run workflows:validate -- content/workflows/<slug>.md   # just yours
   npm run workflows:scan -- content/workflows/<slug>.md       # secrets, emails, IPs, home paths
   ```

   The scan never looks for client names. Fix everything they print.
4. Go through the confidentiality note above. Only then set `client_safe: confirmed`.
5. Create the branch `workflow/<slug>`, commit only that file, and open the PR with `gh pr create --template workflow.md --label workflow`.

**The file.** Frontmatter fields, all required unless noted:

| Field | Rule |
|---|---|
| `title` | 8 to 80 characters |
| `problem` | One sentence, 20 to 200 characters |
| `tools` | `claude-code`, `codex`, or both |
| `use_cases` | 1 to 3 values from `content/workflows/_taxonomy.yaml` |
| `stacks` | 1 to 4 values from `_taxonomy.yaml`; `any` must be the only value if used |
| `related_lesson` | Optional. A lesson slug that exists |
| `tool_versions` | One semver key (`claude_code`, `codex_cli`) for each tool in `tools`, none for others |
| `verified_on` | ISO date, not in the future |
| `client_safe` | Exactly `confirmed` |
| `author` | Forbidden. Attribution comes from git |

Optional `diagram` (see [Diagrams](#diagrams)) and `watch` (`<lesson-slug>/<media-id>`) fields also exist. The body has these `##` sections, in this order and no others: `Result` (with `### Before` and `### After`), `Setup` (0 to 6 code blocks, each marked `<lang> path=<path> kind=<kind>`), `Prompt`, `Steps` (1 to 5 items) and `Why it works` (40 to 800 characters). The whole file is 20 KB at most. If anything turns off permissions or pipes `curl` into a shell, `Why it works` must have a line starting `Warning:`. The validator prints the exact rule for anything you miss.

**Review and merge.** The owner or a steward reviews within 3 business days (Monday to Friday, Asia/Manila) using the "Merger review" list in the PR template. Then:

1. A maintainer runs `npm run ci:local -- <pr#>`, which posts `ci/local` as `success`.
2. The owner or a steward runs `npm run gate:merge -- <pr#>`.
3. The workflow shows on the live site after the owner re-seeds the hosted database (`FM_ENV_FILE=.env.hosted.local npm run seed`, PRD §18.8 DP-2). Locally, `npm run seed` loads it.

**Attribution.** The author name shown on the site comes from the commit that adds the file on `main`. PRs merge as a squash, so that commit carries the PR opener's GitHub profile name, not your local `git config user.name`. Set your name at github.com/settings/profile before you open the PR. Emails are never read or shown. Seed workflows listed in `content/workflows/_seed-authors.txt` show "First Mate" instead (a code-lane file, since it is not one of the content-lane names).

**Update a workflow.** Edit the file in a new PR on a `workflow/<slug>` branch and re-run validate and scan. To re-verify an unchanged workflow, bump `verified_on` and `tool_versions`. A workflow shows "May be outdated" after 60 days and is archived after 180 (still readable, hidden from lists). Anyone can report one with the "Report outdated" link on its page, which opens a GitHub issue from the `workflow-outdated` template.

**Take a workflow down.** For a leaked client detail or secret, follow `docs/runbooks/workflow-takedown.md` straight away and tell the owner. In short: rotate any leaked secret first, then the owner or a steward merges a content-lane PR that deletes the file and adds the SHA-256 `content_hash` of every version of it to `content/workflows/_takedowns.txt`. The next `npm run seed`, on every database including the hosted one, hard-deletes the row. A plain delete without a hash only marks the workflow removed. The runbook also covers rewriting git history, which needs a merge freeze.

### Fix or improve a lesson

Lessons are in `content/lessons/l<n>/*.md` and exercises in `exercises/ex-<n>-*/`. These go through the **code lane** with all three gates. Use a branch named `content/l<n>-<desc>`.

1. **Check the facts against the real tools.** The lessons teach `claude` and `codex` side by side, and both ship often. Run `claude --version` and `codex --version`, try the commands you are changing, and read the current docs. Do not write behaviour from memory.
2. **Edit the lesson.** Frontmatter follows `src/lib/contracts/lesson.ts`. The body has exactly `## Concept`, `## Claude Code` and `## Codex CLI`, and any other `##` heading is an error. After you re-verify, update `tool_versions` and `last_verified_on` in the frontmatter.
3. **Validate without a database:**

   ```bash
   npm run seed -- --dry-run          # validates content, exercises, workflows and lesson diagrams
   npm run exercises:verify           # only if you touched an exercise: starter must fail, solution must pass
   ```

4. **See it.** Run `npm run seed`, then `npm run dev`, and open the lesson at 360px and 1440px in light and dark mode.
5. Open the PR and ask for the three gates. `npm run content:stale` lists lessons verified more than 60 days ago or behind the latest Claude Code or Codex release in the feed (it needs the local database).

#### Diagrams

A lesson can have a diagram where a picture teaches something the text cannot (spec: PRD §17).

- Use a fenced code block whose info string is `diagram`, with YAML inside that matches the schema in `src/lib/contracts/diagram.ts`.
- It goes inside `## Concept`, after the prose it summarises. The lesson must read completely without it. At most 2 per lesson.
- There are four types: `flow`, `stack`, `boundary` and `lanes`. One question per diagram, answered by its `summary`. Put nouns in nodes and verbs on edges. Name a risk in words, never by colour alone.
- Labels are short: a node label is at most 2 lines of 24 characters, a `sub` is 28 characters, an edge label is 16. The schema enforces these caps.
- `checkLabelsFit` (`src/lib/diagram/fit.ts`) measures every label against its box in both the wide and the narrow layout. The lesson seed and the workflow validator both call it, so `npm run seed -- --dry-run` reports a label that does not fit, with the diagram id and the field.
- Workflows use the `diagram` frontmatter field, never a fenced block in the body.

#### Lesson media

Sources are in `media/` and the output is committed under `public/media/lessons/<lesson-slug>/`. Never hand-edit anything in `public/media/`: change the source and regenerate. See `media/README.md` and `media/tapes/README.md`.

```bash
npm run media:render                       # Remotion animations (needs ffmpeg)
npm run media:record                       # VHS recordings that make no model calls (needs vhs)
npm run media:record -- l4-mcp-servers     # one item
```

Rendering and recording need an engineer's Mac. CI only validates the committed files (manifests and size limits) as part of `npm test`. The `l3-headless-agents` recording makes real model calls, so a maintainer records it by hand with their logged-in CLIs. It is never run in CI.

### Change app code

This covers `src/`, `scripts/`, `supabase/`, `tests/` and the root config.

1. **Read `AGENTS.md` first**, then the PRD section for the feature. This Next.js version has breaking changes, so read the matching guide in `node_modules/next/dist/docs/` before using an API you are unsure of.
2. **One worktree per branch**, from a fresh `main`:

   ```bash
   git fetch origin
   git worktree add ../fm-<desc> -b fix/<desc> origin/main
   ```

   Branch names: `ws-<letter>/<desc>` for workstreams, `content/l<n>-<desc>`, `workflow/<slug>`, `m2/<desc>`, `qa/<desc>`, `design/<desc>`, `fix/<desc>`.
3. **Edit only paths your workstream owns** (PRD §11). `package.json`, `src/lib/contracts/`, `supabase/migrations/`, `src/lib/db/` and `tests/support/` are frozen: change them only in a dedicated M0-owned PR. Never import `src/lib/db/service.ts` from `src/`.
4. **Test first.** Each P0 acceptance criterion has its test in the same PR. Tests live in `tests/unit/<ws>/` and `tests/e2e/<ws>/`.
5. **Run the checks** before you open the PR:

   ```bash
   npm run typecheck && npm run lint && npm run test && npm run build
   npm run db:reset:test && PLAYWRIGHT_PORT=3457 npm run e2e
   npm run seed && npm run news:import      # restore your real data
   ```

   Check the UI by hand at 360, 768 and 1440px and attach screenshots to the PR.
6. **Rebase on `main`, then push.** Chain them with `&&`, never `;`: a failed rebase followed by a push once overwrote a PR branch.
7. **Open the PR** with the template. It lists the workstream, the owned paths and the three gates.
8. **Gates.** Independent gate agents post `gate/browser`, `gate/review` and `gate/uiux` on the exact head SHA with `scripts/gate-status.sh <pr#> <browser|review|uiux> <success|failure> <sha> "<desc>"`, and add the labels. `success` is refused if the head has moved past `<sha>`. Do not post your own gates.
9. A maintainer runs `npm run ci:local -- <pr#>`, then the owner or a steward runs `npm run gate:merge -- <pr#>`.

#### Local setup gotchas

- **All worktrees share one Supabase stack** (ports 544xx). Run `npm run db:reset:test` and the gate E2E one at a time.
- **`db:reset:test` and `npm run e2e` wipe your data.** Afterwards run `npm run seed && npm run news:import` to get it back. `ci:local` does this for you.
- **Ports.** `npm run dev` uses :3000. If it is taken, use `PLAYWRIGHT_PORT=3457 npm run e2e`. Do not kill other people's servers by name.
- **`.env.local` is always the local stack.** Never point it at the hosted project, so `npm run dev`, tests and agents can never touch hosted data. A script that must reach hosted uses a separate profile: `FM_ENV_FILE=.env.hosted.local npm run seed`. Scripts print their target host on start. `db:reset:test` and `db:local-roles` refuse a non-local database.
- **Hosted deploys are owner-only.** `supabase db push` is a manual owner step, never CI, and never with `--include-seed`. Do not put a role secret in a migration. The service-role key is never set on Vercel.
- **Stored progress has a version.** Do not run a build older than the forward-compatibility guard against a browser that holds a version 2 progress document. Rebase an old worktree first.
- **One E2E file:** run `npm run db:reset:test`, then `PLAYWRIGHT_PORT=3457 npx playwright test tests/e2e/f/news.spec.ts --no-deps`.

### Suggest a news source

Sources are listed in `content/news/sources.yaml`, each with a name, slug, URL, `type` (`rss`, `atom` or `html`) and `enabled`.

1. Open a GitHub issue with the source name, the feed URL, and one line on why it matters to First Mate.
2. To add it yourself, edit `content/news/sources.yaml` and run `npm run news:sources:check` (needs network) to confirm the feed is reachable and parses. Then open a code-lane PR.
3. A new source takes effect when the maintainer's next `npm run news:run` upserts the file. Noisy feeds can use `filters.keywords`.

A source of type `html` needs a scraper in `scripts/news/`, so ask first.

### Report a bug or an idea

Open an issue at <https://github.com/RayAdrian/firstmate-ai-playground/issues>.

- **Bug:** what you did, what you expected, what happened, the page URL, your browser, and a screenshot if it is visual. Do not paste secrets or client information.
- **Outdated lesson or workflow:** name the slug and the step that failed, with `claude --version` and `codex --version`. For a workflow, use the "Report outdated" link on its page.
- **Idea:** the problem first, then what you would change. Small and specific beats large.

A leaked client detail or secret is not an issue. Tell the owner directly and see the takedown runbook.

### Stars and reactions on the site

Workflows have a Star and four reactions: Worked for me, Learned something, Saved me time and Game-changer.

- There is no sign-in. Your browser gets a random id kept in `localStorage`, which is never shown or exported.
- A display name is optional. You are asked once and can skip. It appears as plain text next to your reactions, and you can change or clear it from the workflow page.
- It is not a place for confidential information. Do not put client names or secrets in your display name.
- Counts are best effort. Clearing your browser data makes you a new person, and the site does not claim the counts are verified.

### What reviewers look for

- The PR is in the right lane and touches only paths its workstream owns.
- Tests came first and cover the acceptance criteria, with real output in the PR.
- `typecheck`, `lint`, `test` and `build` pass, and E2E with axe passes.
- No client names, code, internal URLs, ticket IDs or secrets anywhere, including commit messages and the branch name.
- Workflows are real and specific: it was run, `verified_on` and `tool_versions` are plausible, and a reader can reproduce it from Setup and Steps. It is not a duplicate of an existing workflow. Risky flags carry a `Warning:` line.
- Lessons match current `claude` and `codex` behaviour, and `tool_versions` and `last_verified_on` were updated.
- Diagrams pass `npm run seed -- --dry-run`, work at 360px and name risks in words.
- Nothing is hand-edited in `public/media/`, and nothing in tests or `.env.local` touches hosted data.
- Plain words, sentence-case headings and no marketing tone.
