<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# First Mate AI Playground

Internal playground for learning Claude Code and Codex CLI, plus a daily AI news digest. Spec: `docs/PRD.md` (acceptance criteria IDs like L-2, P-1 refer to it).

## Stack
Next.js App Router, TypeScript strict, Tailwind, npm, local Supabase (ports 544xx, see `supabase/config.toml`), zod, Vitest, Playwright + axe. The app makes no LLM calls. No auth; progress lives in localStorage (`fm-playground:v1`).

## Setup (new worktree)
`npm ci`, then `cp .env.example .env.local` and fill it from `supabase status -o env` (`API_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`). All worktrees share one Supabase stack, so run `db:reset:test` and the gate E2E one at a time.

## Commands
- `supabase start` then `npm run seed`, `npm run dev`
- `npm run typecheck | lint | test | e2e | build`. If :3000 is taken, use `PLAYWRIGHT_PORT=3457 npm run e2e`.
- E2E modes (`playwright.config.ts`). Default: `next dev`, all tests except tagged ones. Tags go in the test title:
  - `@live` (real logged-in `claude`) and `@network` (real internet) are excluded unless `E2E_LIVE=1`.
  - `@nightly` (timing/perf) is excluded unless `E2E_NIGHTLY=1`. `@manual` is never run.
  - `@prod` tests need a production build. `E2E_PROD=1 npm run e2e` runs `next build && next start` on `PLAYWRIGHT_PORT` and runs only `@prod` tests (error digests, no stack traces, seed-without-rebuild). Without it `@prod` tests are skipped.
- Running a single e2e file: the fixture-mutating specs are chained playwright projects (`mutating-N`, see `playwright.config.ts`) that depend on the read-only `chromium` project, so `npx playwright test <file>` also runs everything it depends on. Add `--no-deps` to run only the file you name (for example `PLAYWRIGHT_PORT=3457 npx playwright test tests/e2e/f/news.spec.ts --no-deps`, after `npm run db:reset:test`).
- Shared E2E helpers: `import { seedProgress, readProgress, blockStorage, progressDoc, collectConsole, freezeClock, setServerNow, expectNoSeriousA11y, startFeedServer } from "../../support"` (`tests/support/`, M0-owned, frozen). `freezeClock` is client-only; `setServerNow(context, baseURL, iso)` sets the `fm_test_now` cookie.
- Server clock: server code that needs "today" must call `getNow()` / `manilaDate()` from `src/lib/time/now.ts`, never `new Date()`. `getNow()` honours the `fm_test_now` cookie only when `FM_TEST_MODE=1`. `getNow()` calls `connection()` so callers are always dynamic (never frozen at build time). Playwright's webServer sets `FM_TEST_MODE=1` in dev mode only; `E2E_PROD=1` leaves it unset unless `E2E_FM_TEST_MODE=1`. It is never set in normal dev or production. E2E probe pages (`/test-now`) return 404 unless `FM_E2E_PROBES=1`, a separate flag Playwright's webServer sets in both modes; never set it outside e2e.
- `npm run db:reset:test` (E2E fixtures), `npm run news:run`, `npm run news:import`, `npm run exercises:verify`, `npm run content:stale`
- `scripts/gate-status.sh <pr#> <browser|review|uiux> <success|failure> <sha> "<desc>"`: a gate agent posts its verdict as commit status `gate/<gate>` on `<sha>`, the commit it reviewed. `success` is refused if the PR head has moved past `<sha>`.
- `npm run gate:merge -- <pr#>`: the only merge path for both lanes. It works on one pinned commit: resolves the head SHA first, classifies the changed files for that SHA (`--name-status --find-renames --find-copies` against `origin/main`, both paths of renames and copies counted), requires every CI check run on it to be completed and successful (pending means refuse), re-reads the head and refuses if it moved, then squash-merges with `--match-head-commit <sha>`. Code lane: `gate/browser`, `gate/review` and `gate/uiux` all `success` on that SHA, the three `gate:*-green` labels, and not behind `main` (rebase first). Content lane: see Merge gates. Run it from the primary checkout.
- `npm run workflows:validate | workflows:scan | workflows:share`: shared-workflow tooling (PRD §16). Stubs that exit 1 until W1 (validate, scan) and W3 (share) land.

## Lesson media (PRD §15)
- Sources live in `media/` (excluded from root tsconfig, ESLint and vitest; its tools run their own checks): Remotion in `media/remotion/` (V1, own `package.json`), VHS tapes in `media/tapes/` (V2). Output is committed to `public/media/lessons/<lesson-slug>/<id>.{mp4,webp,vtt,txt,media.json}`. Never hand-edit `public/media/`; manifests are generated (schema: `src/lib/contracts/media.ts`).
- `npm run media:render` runs the `render` script of `media/remotion` (all items). `npm run media:record [-- <id>]` runs `media/tapes/record.sh`. The model tape `l3-headless-agents` is recorded manually by a maintainer with their logged-in CLIs (real HOME, no API keys), never in CI.
- Rendering and recording need an engineer's Mac (`brew install vhs`). CI only validates committed output through `tests/unit/m0/media-assets.test.ts` (MD-6: manifests match the contract, referenced files exist, MP4 <= 4MB, poster <= 60KB, total <= 20MB), which runs in `npm test`.
- Ownership: V1 owns `media/remotion/**` and the 4.2/5.3 folders; V2 owns `media/tapes/**` and the 1.1/3.4/4.3 folders. Don't touch another workstream's folder.

## Rules
- **Path ownership (PRD §11):** edit only the paths your workstream owns. `package.json`, contracts (`src/lib/contracts/`), migrations, `src/lib/db/` and `tests/support/` are frozen after M0; change them only in a dedicated M0-owned PR.
- **Test ownership:** each workstream owns `tests/e2e/<ws>/` and `tests/unit/<ws>/`, where `<ws>` is one of `a b c d e f m2 content v1 v2 v3 v4 w0 w1 w2 w3 w4 g0 g1 g2 g3` (M0 owns `m0`). Shared test helpers live in `tests/support/` (M0, frozen). Fixtures: `tests/fixtures/` (WS-B).
- Never import `src/lib/db/service.ts` (service-role) from `src/`; ESLint enforces it. The app uses the read-only anon client (`src/lib/db/server.ts`). Wrap reads in `dbRead()` so a down database surfaces as `DbUnavailableError` (PRD §9 message).
- Content routes must render dynamically (`export const dynamic = "force-dynamic"` or a dynamic read) so content edits show without a rebuild.
- Test-first: each P0 AC has its test in the same PR.
- **Branch names:** `ws-<letter>/<desc>` (workstreams), `content/l<n>-<desc>` (lessons), `workflow/<slug>` (shared workflows, PRD §16), `m2/<desc>`, `qa/<desc>`, `design/<desc>`, `fix/<desc>`. One git worktree per branch; rebase on `main` before gates.

## Merge gates (PRD §12), all three required on the exact head commit
1. `gate/browser` (+ label `gate:browser-green`): Playwright + axe pass on fixtures; manual check at 360/768/1440px with screenshots on the PR.
2. `gate/review` (+ `gate:review-green`): code-review agent, no blocking findings (incl. edits outside owned paths).
3. `gate/uiux` (+ `gate:uiux-green`): UI/UX agent (or "N/A: no UI changes").
Any push invalidates earlier approvals: re-run the gates and post new statuses. Never merge with `gh pr merge` directly (the merge button cannot check the lane or that the content checks ran).

**Content lane (PRD §16, WF-22).** A PR whose changed files are all direct children of `content/workflows/` named `*.md`, `_taxonomy.yaml` or `_takedowns.txt` (deletes, rename sources and copy sources included) merges when all CI checks are green, including `validate` and `gitleaks`, by the owner or a steward running `npm run gate:merge -- <pr#>`. It needs no approval, gate statuses or `gate:*-green` labels, and need not be up to date with `main`. Any other path, including a rename into or out of that folder, puts the PR in the code lane (all three gates); a mixed PR also needs the content checks. Human review at merge is the confidentiality control: CI checks secrets and format only, and there is no client-name scan.
