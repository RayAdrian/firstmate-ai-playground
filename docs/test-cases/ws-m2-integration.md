# WS-M2: Integration, cross-feature journeys and merge gates

Scope: the home page (C-4 Continue CTA, N-6 top-3 digest), cross-links between lessons, bookmarks and progress, the full-route sweeps (axe, responsive, hydration, Lighthouse), S-3 end to end, the app-wide DB-down state and the PRD §12 merge gates and §2 definition of done.
Runs after M1 merges (PRD §11 M2). Every e2e case runs against `next start` on `fx-base` with `FM_TEST_MODE=1` and cookie `fm_test_now=2026-09-30T13:00:00+08:00` unless the case says otherwise.
Contract, fixtures, selectors and helpers: [README.md](README.md). Route list used by every sweep below is **ROUTES**: `/`, `/curriculum`, `/lessons/l1-first-session`, `/lessons/l1-permissions`, `/lessons/l2-memory`, `/exercises`, `/news`, `/news/archive`, `/bookmarks`, `/progress`, `/lessons/does-not-exist` (not-found) and the error route (AMB-M1).

---

## Suite 1: Home page Continue CTA (C-4)

### TC-M2-01: Continue links to the last viewed lesson
- **ACs:** C-4.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; `ls-empty`
- **Steps:**
  1. Visit `/lessons/l2-context-files` and wait for hydration (the Mark complete button is enabled).
  2. Visit `/`.
  3. Locate `getByRole('link', { name: /^Continue: / })`.
- **Expected:** The link's accessible name is exactly `Continue: <title of l2-context-files>` (title from `tests/fixtures`), its `href` is `/lessons/l2-context-files`, and `readProgress(page).lastViewed` identifies `l2-context-files`. Clicking it lands on that lesson in one click.

### TC-M2-02: Continue with no history links to the first L1 lesson
- **ACs:** C-4.2
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; `ls-empty`
- **Steps:**
  1. Visit `/`.
  2. Read the Continue link.
- **Expected:** Name `Continue: <title of l1-first-session>`, `href` `/lessons/l1-first-session` (level 1, sort 1).

### TC-M2-03: Continue updates when a different lesson is viewed
- **ACs:** C-4.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; `ls-empty`
- **Steps:**
  1. Visit `/lessons/l2-context-files`, then `/lessons/l1-permissions`.
  2. Visit `/`.
- **Expected:** Continue links to `/lessons/l1-permissions` (most recent view wins, not the furthest lesson).

### TC-M2-04: Continue when lastViewed points to an archived or deleted lesson
- **ACs:** C-4.1, C-4.2, P-4.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; two runs: `seedProgress` with `lastViewed` = `l2-retired` (archived), then `lastViewed` = `deleted-lesson-slug`
- **Steps:**
  1. For each state, visit `/` with `collectConsole(page)`.
- **Expected:** Continue links to `/lessons/l1-first-session` in both runs (AMB-13). No console errors. `readProgress` still holds the original `lastViewed` value until another lesson is viewed (state is not destroyed).
- **Notes:** AMB-13.

### TC-M2-05: Continue CTA is hydration-safe
- **ACs:** C-4.1, P-5.1, S9-09
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; `seedProgress` with `lastViewed` = `l2-context-files`
- **Steps:**
  1. Fetch `/` with `request.get` (no JS) and inspect the HTML.
  2. Load `/` in the browser with `collectConsole(page)`.
- **Expected:** Server HTML contains no `Continue: <title of l2-context-files>` (neutral placeholder or the CTA without a lesson-specific target). After hydration the link shows `l2-context-files`. No hydration warnings.
- **Notes:** The server HTML must not show the C-4.2 fallback lesson either, which would flash the wrong target (AMB-M2).

## Suite 2: Home page digest (N-6)

### TC-M2-06: Home shows the top 3 digest items and See all
- **ACs:** N-6.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, clock 2026-09-30T13:00+08:00
- **Steps:**
  1. Visit `/`.
  2. In the home digest region (`getByRole('region', { name: /digest/i })`), list the item title links in order.
  3. Click `getByRole('link', { name: 'See all' })`.
- **Expected:** Exactly 3 items, in order `n01`, `n02`, `n19` (same order as `/news` positions 1–3). `n19`'s `why_it_matters` renders as literal text with no `<img>` element and `window.__xss` undefined. "See all" navigates to `/news`.

### TC-M2-07: Home digest with no runs ever
- **ACs:** N-6.1, S9-12
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-no-news`
- **Steps:**
  1. Visit `/` with `collectConsole(page)`.
- **Expected:** Home renders; the digest region shows "No news yet. Run `npm run news:run`." (same copy as `/news`) and no item list. Curriculum overview and Continue CTA still render. No console errors.
- **Notes:** PRD does not define the home empty state; AMB-M3.

### TC-M2-08: Home digest when the digest is stale
- **ACs:** N-6.1, N-3.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`, cookie `fm_test_now=2026-10-01T09:00:00+08:00`
- **Steps:**
  1. Visit `/`.
- **Expected:** The 3 items are from 2026-09-30 (`n01`, `n02`, `n19`) and the region labels them as not today (for example "Showing Wed 30 Sep"; 2026-09-30 is a Wednesday, so the PRD example "Tue 30 Sep" is illustrative only), consistent with `/news` N-3 copy). It never labels them "Today".
- **Notes:** AMB-M3.

### TC-M2-09: Home digest when nothing clears the bar
- **ACs:** N-6.1, S9-13
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-news-lowbar`
- **Steps:**
  1. Visit `/`.
- **Expected:** No items listed (none ≥ 60); the region shows "Nothing above the relevance bar today" and a link to `/news/archive` filtered to 2026-09-30. Items scored 59 and below never appear on the home page.

## Suite 3: Content changes without redeploy (S-3)

### TC-M2-10: Edited lesson title shows after seed, no rebuild
- **ACs:** S-3.1, S-2.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** A temp copy of the fixture content directory (`CONTENT_DIR` pointed at it); `fx-base` seeded from that copy; `next start` running with PID recorded; `.next/BUILD_ID` value recorded
- **Steps:**
  1. Visit `/lessons/l1-first-session`; record the h1 text.
  2. Edit the frontmatter `title` of `l1-first-session` in the temp copy to `Edited title M2-10`.
  3. Run `npm run seed` (exit 0).
  4. Reload the lesson; then visit `/curriculum`.
- **Expected:** The h1 is `Edited title M2-10`, and the curriculum row shows the same title. The `next start` PID is unchanged and `.next/BUILD_ID` is unchanged (no restart, no rebuild).

### TC-M2-11: Removed lesson disappears and returns 404 without redeploy
- **ACs:** S-3.1, S-2.3, C-1.3, S9-05
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** As TC-M2-10
- **Steps:**
  1. Delete `l2-memory`'s markdown file from the temp copy; run `npm run seed`.
  2. Reload `/curriculum`; visit `/lessons/l2-memory`.
  3. Visit `/lessons/l2-context-files` and read the Next link.
  4. Restore the file; run `npm run seed`; reload `/lessons/l2-memory`.
- **Expected:** Step 2: `l2-memory` is absent from the curriculum and its URL returns HTTP 404 with the branded not-found page and a link to `/curriculum`. Step 3: `l2-context-files` is now the last lesson, so it shows "Back to curriculum" (L-6.1). Step 4: the lesson renders again (200) with no restart.

### TC-M2-12: Content edit does not disturb stored progress
- **ACs:** S-3.1, P-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** As TC-M2-10; `ls-one-complete`
- **Steps:**
  1. Edit the title of `l1-first-session`; run `npm run seed`.
  2. Reload `/curriculum`.
- **Expected:** `l1-first-session` still shows completed (progress keyed by slug, not title) and the L1 header shows "1 / 2".

## Suite 4: Cross-feature journeys

### TC-M2-13: Mark complete then curriculum reflects it without reload
- **ACs:** L-5.1, C-1.2, C-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; `ls-empty`; record `performance.getEntriesByType('navigation').length` and a `window.__noReload = 1` marker
- **Steps:**
  1. Visit `/curriculum`; click the `l1-first-session` row link.
  2. Click "Mark complete".
  3. Navigate back to `/curriculum` using the app's header nav link (client-side).
- **Expected:** The `l1-first-session` row shows completed, the L1 header shows "1 / 2" and `getByRole('progressbar', { name: /Level 1/ })` has `aria-valuenow="50"`. `window.__noReload` is still `1` (no full reload).

### TC-M2-14: Checklist complete does not complete the lesson
- **ACs:** E-2.3, L-5.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** `fx-base`; `ls-empty`
- **Steps:**
  1. On `/lessons/l1-first-session`, check "Test is green", "No test files edited" and "Diff reviewed".
  2. Visit `/curriculum` and `/`.
- **Expected:** The exercise panel shows "Exercise complete". The lesson button still reads "Mark complete". The curriculum row shows not started; L1 header "0 / 2"; `readProgress().lessons` has no `l1-first-session` key.

### TC-M2-15: Bookmark a lesson and a news item, then view bookmarks
- **ACs:** L-8.1, N-5.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; `ls-empty`
- **Steps:**
  1. On `/lessons/l2-context-files`, toggle the header bookmark on.
  2. On `/news`, bookmark `n02`.
  3. Visit `/bookmarks`.
- **Expected:** Both entries are listed, `n02` first (bookmarked later, AMB-10). The lesson entry links to `/lessons/l2-context-files`; the news entry links to `n02`'s source URL. `readProgress().bookmarks.lessons` contains `l2-context-files` and `bookmarks.news` contains `n02`'s `id`.

### TC-M2-16: Bookmarked news item later removed from DB
- **ACs:** N-5.1, S9-20
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; bookmark `n02` as in TC-M2-15; then delete `n02` with the service-role client
- **Steps:**
  1. Visit `/bookmarks` with `collectConsole(page)`.
- **Expected:** The entry shows "Item no longer available"; the lesson bookmark still renders; no console errors; the id stays in storage.

### TC-M2-17: Export, clear, import round trip
- **ACs:** P-6.1, P-6.2, P-1.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; `ls-one-complete` plus `checklists.ex-fx-auto = {c1:true}`, a lesson bookmark and `prefs.tool = "codex"`
- **Steps:**
  1. On `/progress`, click Export; capture the download (`page.waitForEvent('download')`).
  2. Reset all progress (type `reset`, confirm).
  3. Check `/curriculum` shows "0 / 2" for L1.
  4. Import the downloaded file; confirm the preview; confirm.
  5. Visit `/curriculum`, `/lessons/l1-first-session`, `/bookmarks`.
- **Expected:** Download filename `fm-playground-progress-2026-09-30.json` (Manila date of the test clock; AMB-M4). Preview reads 1 lesson and 1 bookmark. After import, L1 shows "1 / 2", the lesson shows "Completed ✓ · Undo", checkbox "Test is green" is checked, the Codex CLI tab is selected by default, and the bookmark is listed. `readProgress()` deep-equals the exported JSON.

### TC-M2-18: Tool preference across lesson navigation
- **ACs:** L-2.2, L-2.3
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; `ls-empty`
- **Steps:**
  1. Open `/lessons/l1-first-session?tool=codex`.
  2. Click the Next link (to `l1-permissions`).
  3. Open `/lessons/l2-context-files`, click the Codex CLI tab, then click Next.
- **Expected:** Step 1: Codex tab selected. Step 2 (under AMB-14, a URL param alone does not write `prefs.tool`): Claude Code is selected on `l1-permissions`, and the Next href carries no `?tool`. Step 3: after an explicit click, `prefs.tool = "codex"` and `l2-memory` opens on Codex CLI.
- **Notes:** Flagged as AMB-M5: users may expect a deep-linked tool to follow them. The decision on AMB-14 decides step 2.

### TC-M2-19: Keyboard-only journey
- **ACs:** D-2.2, D-2.3, L-2.1, L-4.1, L-5.1, C-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`; `ls-empty`; clipboard permissions granted; no `page.mouse` or `click()` calls allowed in the test
- **Steps:**
  1. Visit `/curriculum`; press Tab once; press Enter on "Skip to content".
  2. Tab to the `l1-first-session` row link; Enter.
  3. Tab until focus is on the selected tab; press ArrowRight; press Enter/Space if needed (manual activation).
  4. Tab to the first code block's Copy button; Enter.
  5. Tab to "Mark complete"; Enter.
- **Expected:** Step 1: focus moves into `main`. Step 3: "Codex CLI" is focused and selected, URL has `?tool=codex`. Step 4: clipboard text equals the block text; `getByRole('status')` reads "Copied". Step 5: button reads "Completed ✓ · Undo". Every focused element along the way shows a focus ring (TC-A cases own the exact 2px style; here assert `outline-style != none` or a box-shadow on each focus stop). No focus is lost to `body` at any step.

### TC-M2-20: Internal lesson links and back navigation
- **ACs:** C-3.1, L-6.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. On `/lessons/l1-first-session`, click the concept body's internal link to `/lessons/l1-permissions`.
  2. Press browser Back.
- **Expected:** Internal link opens in the same tab (no `target=_blank`), lands on `l1-permissions`; Back returns to `l1-first-session` with its selected tab intact.

## Suite 5: Full-route sweeps

### TC-M2-21: axe sweep on every route, default state
- **ACs:** D-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`; `ls-one-complete`; `@axe-core/playwright` with tags `wcag2a, wcag2aa, wcag21aa, wcag22aa`
- **Steps:**
  1. For each route in ROUTES, load it, wait for hydration, run axe on the full page.
- **Expected:** Zero violations with impact `serious` or `critical` on every route. Report lists route + rule id on failure.

### TC-M2-22: axe sweep on lessons in both tab states
- **ACs:** D-2.1, L-3.2
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. For each fixture lesson (4 active), load `?tool=claude` and run axe; load `?tool=codex` and run axe.
- **Expected:** 0 serious/critical in all 8 runs, including `l1-permissions?tool=codex` (no-equivalent notice).

### TC-M2-23: axe sweep on expanded and open states
- **ACs:** D-2.1, D-3.2, E-3.1, N-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. `/lessons/l1-first-session`: expand "Compare with reference solution"; run axe.
  2. `/news`: expand "Unscored (3)"; run axe.
  3. At 360px: open the Menu (`aria-expanded="true"`); run axe.
  4. `/progress`: open the import preview and the reset confirmation; run axe on each.
  5. With `blockStorage(page)` and with `ls-corrupt-json`, load `/curriculum`; run axe (banner and notice visible).
- **Expected:** 0 serious/critical in every state.

### TC-M2-24: axe sweep in dark mode
- **ACs:** D-5.1, D-2.1
- **Level:** e2e
- **Priority:** P1
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`; `page.emulateMedia({ colorScheme: 'dark' })`
- **Steps:**
  1. Repeat TC-M2-21 for every route.
- **Expected:** 0 serious/critical, including `color-contrast`.

### TC-M2-25: axe sweep on §9 empty states
- **ACs:** D-2.1, S9-02, S9-12, S9-13, S9-16, S9-19
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-no-content`, `fx-no-news`, `fx-news-lowbar`, `ls-empty`
- **Steps:**
  1. `fx-no-content`: `/curriculum`, `/`.
  2. `fx-no-news`: `/news`, `/`.
  3. `fx-news-lowbar`: `/news`.
  4. `fx-base`: `/news/archive?min=80&source=fx-simon&from=2026-09-30&to=2026-09-30` (no matches); `/bookmarks` with `ls-empty`.
- **Expected:** Each page shows its §9 copy and has 0 serious/critical violations.

### TC-M2-26: No horizontal scroll on any route at four widths
- **ACs:** D-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Responsive
- **Preconditions / fixtures:** `fx-base`; `ls-one-complete`
- **Steps:**
  1. For each width in 360, 768, 1024, 1440 (height 900) and each route in ROUTES: load, wait for hydration, evaluate `document.scrollingElement.scrollWidth <= document.scrollingElement.clientWidth`.
  2. On `/lessons/l1-first-session` at 360, find the longest code block and evaluate its `scrollWidth > clientWidth` and computed `overflow-x`.
- **Expected:** Step 1 true for all 40 combinations. Step 2: the code block overflows internally (`overflow-x` is `auto` or `scroll`) while the page does not.

### TC-M2-27: Responsive sweep with long content
- **ACs:** D-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Responsive
- **Preconditions / fixtures:** `fx-base` plus, via service-role update in the test, `n01.title` set to a 300-character unbroken string and a news source URL 200 chars long
- **Steps:**
  1. At 360px load `/news`, `/news/archive`, `/`, `/bookmarks` (with `n01` bookmarked).
- **Expected:** No horizontal page scroll; the long title wraps or truncates with the full title still in the link's accessible name.

### TC-M2-28: Manual responsive pass with screenshots
- **ACs:** D-3.1, D-3.2, G-1
- **Level:** e2e
- **Priority:** P0
- **Category:** Responsive
- **Preconditions / fixtures:** `fx-base`; a real Chrome/Safari window resized to 360, 768 and 1440
- **Steps:**
  1. For each width, visit ROUTES (all except the error route), open the menu at 360 and 768, switch lesson tabs, expand the solution disclosure.
  2. Save full-page screenshots named `<route-slug>-<width>.png`.
- **Expected:** No overlap, clipping or horizontal scroll; tabs stay tabs below 768; menu button shows `aria-expanded` true/false as it toggles. Screenshots are linked in the PR description (G-5).
- **Notes:** manual.

### TC-M2-29: Hydration sweep with stored progress
- **ACs:** P-5.1, S9-09
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; run once with `ls-one-complete`, once with `ls-codex-pref`, once with `ls-orphans`
- **Steps:**
  1. For each route in ROUTES: `collectConsole(page)`, load, wait for network idle and 500 ms.
  2. For the same routes, fetch the server HTML with `request.get` and search it.
- **Expected:** Step 1: zero `console.error`, zero `pageerror`, zero messages matching `/hydrat/i` across all 36 loads. Step 2: server HTML contains no "Completed ✓", no "1 / 2" progress count with a non-zero numerator, no `aria-valuenow` other than neutral, no `aria-selected="true"` on the Codex tab when no `?tool` is set.

### TC-M2-30: No "not started" flash before hydration
- **ACs:** P-5.1, S9-09
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; `ls-one-complete`; JS bundle requests delayed 2s with `page.route('**/_next/static/**', ...)`
- **Steps:**
  1. Load `/curriculum`; screenshot and read the `l1-first-session` row before JS finishes.
  2. Let JS load; read the row again.
- **Expected:** Before hydration the row shows a neutral placeholder, not the text "Not started". After hydration it shows completed.

### TC-M2-31: Lighthouse LCP on four routes
- **ACs:** D-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Perf
- **Preconditions / fixtures:** `fx-base`; `npm run build && next start`; Lighthouse desktop preset, 3 runs per URL
- **Steps:**
  1. Run Lighthouse on `/`, `/curriculum`, `/lessons/l1-first-session`, `/news`.
- **Expected:** Median LCP < 2000 ms on each URL. Report JSON archived as a CI artifact. (AMB-24)

### TC-M2-32: CLS on four routes including font load
- **ACs:** D-4.2, S9-03, S9-14
- **Level:** e2e
- **Priority:** P0
- **Category:** Perf
- **Preconditions / fixtures:** As TC-M2-31, plus a Playwright run with `ls-one-complete` and a `PerformanceObserver('layout-shift')` injected via init script
- **Steps:**
  1. Read Lighthouse CLS for the four routes.
  2. In Playwright, load each route with a cold cache and sum `layout-shift` entries without `hadRecentInput` for 3s.
- **Expected:** CLS < 0.05 in both measurements on every route, including the hydration swap from placeholders to stored progress.

### TC-M2-33: Stakeholder Mac performance record
- **ACs:** D-4.1, D-4.2
- **Level:** e2e
- **Priority:** P1
- **Category:** Perf
- **Preconditions / fixtures:** Stakeholder Mac, local Supabase, production build
- **Steps:**
  1. Run Lighthouse desktop on the four routes.
- **Expected:** LCP < 2.0s and CLS < 0.05; numbers recorded in the M2 PR.
- **Notes:** manual; AMB-24.

## Suite 6: App-wide states and route smoke

### TC-M2-34: DB down shows the full-page error on every DB route
- **ACs:** S9-01
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `fx-base`; after server start, stop the DB (`docker stop supabase_db_<project>` or `supabase stop`), restart it in `afterAll`
- **Steps:**
  1. With `collectConsole(page)` (errors expected server-side only), visit `/`, `/curriculum`, `/lessons/l1-first-session`, `/exercises`, `/news`, `/news/archive`, `/bookmarks`.
  2. Click the copy button on the error page.
  3. Visit `/progress`.
- **Expected:** Step 1: every page shows "Can't reach the local database. Run `supabase start` then `npm run seed`." with no stack trace, no file paths, no `ECONNREFUSED` text in the DOM. Step 2: clipboard holds the command text (AMB-M6 on exact copied text). Step 3: `/progress` (localStorage-only) either renders normally or shows the same page (AMB-M7).

### TC-M2-35: DB recovery without server restart
- **ACs:** S9-01, S9-04
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** As TC-M2-34
- **Steps:**
  1. With DB down, load `/curriculum` (error page).
  2. Start the DB; reload (or click Retry if present).
- **Expected:** `/curriculum` renders the 2 fixture levels; `next start` PID unchanged.

### TC-M2-36: Route smoke for every §8 route
- **ACs:** S9-22, C-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. `request.get` each route in ROUTES; load each in the browser with `collectConsole`.
- **Expected:** HTTP 200 for all real routes; `/lessons/does-not-exist` and `/lessons/l2-retired` return 404 with the branded not-found page (site header, link to `/curriculum`); the error route shows the branded error boundary with a retry control and no stack trace; no console errors except the intentionally thrown one on the error route.

### TC-M2-37: Storage blocked across every route
- **ACs:** P-3.1, S9-10
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `fx-base`; `blockStorage(page)`
- **Steps:**
  1. Visit each route in ROUTES with `collectConsole`.
  2. On `/lessons/l1-first-session`, click "Mark complete", then navigate client-side to `/curriculum`.
- **Expected:** Every route renders with the banner "Progress can't be saved in this browser"; no uncaught errors. Step 2: the curriculum shows the lesson completed for the session.

## Suite 7: §12 merge gates

### TC-M2-38: CI runs the full test gate on pull requests
- **ACs:** G-1, S-5.1
- **Level:** integration
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `.github/workflows/*.yml`
- **Steps:**
  1. Parse the workflow YAML.
  2. Open a throwaway PR with a deliberately failing Playwright test; observe checks.
- **Expected:** A workflow triggered on `pull_request` to `main` runs, in order: `supabase start`, `npm run db:reset:test`, `npm run test` (Vitest), `npm run e2e` (Playwright including the axe specs). The failing test makes the required check red and the PR unmergeable.

### TC-M2-39: PR template records all three gates
- **ACs:** G-5, G-1, G-2, G-3
- **Level:** integration
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `.github/pull_request_template.md`
- **Steps:**
  1. Read the template.
- **Expected:** It has three labelled status lines (Browser E2E, Code-review agent, UI/UX review agent) each accepting green/red/"N/A: no UI changes" (UI/UX only), and a screenshot-links section for 360, 768 and 1440.

### TC-M2-40: main branch protection
- **ACs:** G-6
- **Level:** integration
- **Priority:** P0
- **Category:** Security
- **Preconditions / fixtures:** `gh` authenticated with repo admin read
- **Steps:**
  1. `gh api repos/RayAdrian/firstmate-ai-playground/branches/main/protection`.
  2. From a clone, `git push origin HEAD:main` with a trivial commit.
- **Expected:** Step 1: `required_pull_request_reviews.required_approving_review_count >= 1`; required status checks include the E2E workflow; `allow_force_pushes.enabled == false`. Step 2: push is rejected.
- **Notes:** If the plan lacks branch protection for private repos, this fails; record as a blocker (AMB-M8).

### TC-M2-41: Branch name and rebase checks
- **ACs:** G-6
- **Level:** integration
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** Proposed `scripts/gates/check-branch.sh` (M0-owned `.github/`), PR branches `ws-c/lesson-tabs` (valid), `feature/tabs` (invalid), a valid branch 1 commit behind `main`
- **Steps:**
  1. Run the check on each branch.
- **Expected:** Valid name matches `^ws-[a-z0-9]+/[a-z0-9-]+$` and passes; `feature/tabs` fails with a message naming the rule; the stale branch fails because `git merge-base HEAD origin/main` ≠ `origin/main`.
- **Notes:** This PR (`qa/test-cases`) and `ws-m2`/`ws-g1` names do not fit `ws-<letter>`; see AMB-M9.

### TC-M2-42: Owned-path enforcement
- **ACs:** G-2
- **Level:** integration
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** Proposed `scripts/gates/check-owned-paths.ts` with the §11 ownership table as data; test diffs: WS-C diff touching only `src/app/lessons/**` (pass), WS-C diff touching `src/lib/progress/store.ts` (fail), any WS diff touching `package.json` after M0 (fail)
- **Steps:**
  1. Run the script with `--ws=c --base=origin/main` for each diff.
- **Expected:** Pass/fail as listed; failure output lists each offending path and its owner.

### TC-M2-43: Test-first ordering
- **ACs:** G-4
- **Level:** integration
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** Proposed `scripts/gates/check-test-first.ts`; mapping of AC ID → test file via `// AC: <id>` tags in test titles
- **Steps:**
  1. Run on a PR whose implementation commit precedes its test commit.
  2. Run on a PR that changes implementation for a P0 AC with no tagged test in the PR or on `main`.
  3. Run on a PR with tests in the same commit as implementation.
- **Expected:** 1 and 2 fail naming the AC; 3 passes.

### TC-M2-44: UI/UX gate N/A path
- **ACs:** G-3
- **Level:** integration
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** A PR touching only `scripts/news/**`; a PR touching `src/components/ui/**`
- **Steps:**
  1. Run the UI-diff detector used by the gate.
- **Expected:** The scripts-only PR records "N/A: no UI changes" and passes; the UI PR requires a real UI/UX review status and screenshot links.

### TC-M2-45: Lesson PRs carry needs-human-tool-check
- **ACs:** R-5.1
- **Level:** integration
- **Priority:** P1
- **Category:** Negative
- **Preconditions / fixtures:** A PR touching `content/lessons/**`
- **Steps:**
  1. Query `gh pr view <n> --json labels`.
  2. Check whether any changed lesson's `last_verified_on` changed in the PR.
- **Expected:** Label `needs-human-tool-check` present; a CI check fails when content changes lack it. The human verification itself is untestable (AMB-23).

## Suite 8: Definition of done (PRD §2)

### TC-M2-46: Every P0 AC has a passing automated test
- **ACs:** G-4
- **Level:** integration
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** The README traceability matrix; CI test report (JUnit)
- **Steps:**
  1. For each P0 AC in the README catalogue, find tests tagged with its ID in the JUnit report.
- **Expected:** Every P0 AC has ≥ 1 automated test (not a manual-only case) and all of them passed in the release run.

### TC-M2-47: All 18 lessons seeded with complete structure
- **ACs:** S-4.1, L-3.1, C-5.1
- **Level:** integration
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** Real content (M3), `npm run seed` against a fresh DB
- **Steps:**
  1. Query `lessons where archived_at is null`.
- **Expected:** 18 rows across levels 1–5 (3, 3, 4, 4, 4 per §7); each has `claude_md` or `claude_no_equivalent`, `codex_md` or `codex_no_equivalent`, 1–5 `differences`, `last_verified_on` not null and within 60 days (M7), and one exercise row.

### TC-M2-48: exercises:verify green on real exercises
- **ACs:** E-4.2, E-4.3
- **Level:** integration
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** All 18 `exercises/*`
- **Steps:**
  1. `npm run exercises:verify`.
- **Expected:** Exit 0; output reports ≥ 12 automated, each failing on starter and passing on solution.

### TC-M2-49: Five consecutive scheduled mornings
- **ACs:** I-5.1, I-5.4, I-4.6
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** launchd installed on the stakeholder Mac (M3 burn-in)
- **Steps:**
  1. After 5 mornings, query `select (started_at at time zone 'Asia/Manila')::date as manila_date, trigger, status from ingest_runs where trigger='schedule' order by started_at`.
- **Expected:** 5 consecutive Manila dates each with one `schedule` run of status `success` or `partial`, and no manual run in between. Logs present in `~/Library/Logs/fm-playground/news.log`.
- **Notes:** manual.

---

## Coverage

| AC | Cases |
|---|---|
| C-1.2 | TC-M2-13 |
| C-1.3 | TC-M2-11 |
| C-2.1 | TC-M2-13 |
| C-3.1 | TC-M2-19, TC-M2-20, TC-M2-36 |
| C-4.1 | TC-M2-01, TC-M2-03, TC-M2-04, TC-M2-05 |
| C-4.2 | TC-M2-02, TC-M2-04 |
| C-5.1 | TC-M2-47 |
| D-2.1 | TC-M2-21, TC-M2-22, TC-M2-23, TC-M2-24, TC-M2-25 |
| D-2.2, D-2.3 | TC-M2-19 |
| D-3.1 | TC-M2-26, TC-M2-27, TC-M2-28 |
| D-3.2 | TC-M2-23, TC-M2-28 |
| D-4.1 | TC-M2-31, TC-M2-33 |
| D-4.2 | TC-M2-32, TC-M2-33 |
| D-5.1 | TC-M2-24 |
| E-2.3 | TC-M2-14 |
| E-3.1 | TC-M2-23 |
| E-4.2, E-4.3 | TC-M2-48 |
| I-4.6, I-5.1, I-5.4 | TC-M2-49 |
| L-2.1 | TC-M2-19 |
| L-2.2, L-2.3 | TC-M2-18 |
| L-3.1 | TC-M2-47 |
| L-3.2 | TC-M2-22 |
| L-4.1 | TC-M2-19 |
| L-5.1 | TC-M2-13, TC-M2-14, TC-M2-19 |
| L-6.1 | TC-M2-20 |
| L-8.1 | TC-M2-15 |
| N-2.1 | TC-M2-23 |
| N-3.1 | TC-M2-08 |
| N-5.1 | TC-M2-15, TC-M2-16 |
| N-6.1 | TC-M2-06, TC-M2-07, TC-M2-08, TC-M2-09 |
| P-1.1 | TC-M2-17 |
| P-3.1 | TC-M2-37 |
| P-4.1 | TC-M2-04, TC-M2-12 |
| P-5.1 | TC-M2-05, TC-M2-29, TC-M2-30 |
| P-6.1, P-6.2 | TC-M2-17 |
| R-5.1 | TC-M2-45 |
| S-2.2 | TC-M2-10 |
| S-2.3 | TC-M2-11 |
| S-3.1 | TC-M2-10, TC-M2-11, TC-M2-12 |
| S-4.1 | TC-M2-47 |
| S-5.1 | TC-M2-38 |
| S9-01 | TC-M2-34, TC-M2-35 |
| S9-02, S9-12, S9-13, S9-16, S9-19 | TC-M2-25 (also S9-12: TC-M2-07; S9-13: TC-M2-09) |
| S9-03, S9-14 | TC-M2-32 |
| S9-04 | TC-M2-35 |
| S9-05 | TC-M2-11 |
| S9-09 | TC-M2-05, TC-M2-29, TC-M2-30 |
| S9-10 | TC-M2-37 |
| S9-20 | TC-M2-16 |
| S9-22 | TC-M2-36 |
| G-1 | TC-M2-28, TC-M2-38, TC-M2-39 |
| G-2 | TC-M2-39, TC-M2-42 |
| G-3 | TC-M2-39, TC-M2-44 |
| G-4 | TC-M2-43, TC-M2-46 |
| G-5 | TC-M2-39 |
| G-6 | TC-M2-40, TC-M2-41 |

## Ambiguities raised in this file

| ID | Ambiguity | Interpretation assumed |
|---|---|---|
| AMB-M1 | There is no way to reach the `error` boundary on demand in a production build, so S9-22's error route cannot be E2E'd. | Under `FM_TEST_MODE=1`, `/__test/throw` (or `?__fm_throw=1`) throws inside a route segment. Needs an M0 decision. |
| AMB-M2 | The Continue CTA depends on localStorage, so its server HTML cannot know the target. PRD §9 says "neutral placeholders"; it does not say whether the CTA renders at all before hydration. | Render a neutral CTA skeleton, not the C-4.2 fallback, then swap after mount. |
| AMB-M3 | The home page digest (N-6) has no defined empty, stale or low-bar states. | Reuse the `/news` §9 copy and N-3 stale labelling. |
| AMB-M4 | The export filename `<YYYY-MM-DD>` date: browser local date or Manila? | Manila, matching the rest of the app (AMB-04). |
| AMB-M5 | A deep-linked `?tool=codex` does not persist across Next navigation under AMB-14, which may surprise users. | Test AMB-14 as written; UX review decides. |
| AMB-M6 | The DB-down page's copy button: copies the whole sentence or only the commands? | Only `supabase start && npm run seed`. |
| AMB-M7 | Whether `/progress` (no DB data) shows the DB-down page. | Renders normally; it needs no DB. |
| AMB-M8 | Branch protection on a private repo requires a paid GitHub plan. If unavailable, G-6 can only be enforced by convention. | Treat missing protection as a blocker to raise, not a pass. |
| AMB-M9 | §12 names branches `ws-<letter>/<short-desc>`, but M2, M1b (G1–G5) and QA work (this PR, `qa/test-cases`) have no letter. | Accept `ws-[a-z0-9]+/...` plus `qa/...` and `content/...`; the orchestrator must confirm. |
