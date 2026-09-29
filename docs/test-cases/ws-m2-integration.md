# WS-M2: Integration, cross-feature journeys and merge gates

Scope: the home page (DESIGN §6.1: Continue CTA C-4, level cards, top-3 digest N-6), cross-links between lessons, bookmarks and progress, the full-route sweeps (axe, responsive, hydration, performance), S-3 end to end, the app-wide DB-down and error views (DESIGN §6.9, §6.10), the PRD §12 merge gates as implemented in M0 (`scripts/gate-status.sh`, `scripts/gate-merge.sh`, `.github/`), and the PRD §2 definition of done.
Owner paths: `src/app/page.tsx`. Tests go in `tests/e2e/m2/` and `tests/unit/m2/`. Selectors follow [DESIGN.md §11](../design/DESIGN.md#11-selector-contract) exactly; fixtures, helpers and hooks follow [README.md](README.md) §2–§4.
Unless a case says otherwise, e2e cases run on `fx-base` with `FM_TEST_MODE=1`, cookie `fm_test_now=2026-09-30T13:00:00+08:00` and a fresh context. Cases marked **prod** run on the `next start` Playwright project (AMB-27); the rest run on the default M0 project (`npm run dev`).

**ROUTES** (used by every sweep): `/`, `/curriculum`, `/lessons/l1-first-session`, `/lessons/l1-permissions`, `/lessons/l2-memory`, `/exercises`, `/news`, `/news/archive`, `/bookmarks`, `/progress`, `/does-not-exist` (404), `/lessons/does-not-exist` (lesson 404) and `/__ui/throw` (route error boundary; README §4 hook 7, AMB-M1).

**Scoping rule:** a lesson page has two tablists. Always scope tab locators: `getByRole('tablist', { name: 'Tool' }).getByRole('tab', { name: 'Codex CLI' })`.

---

## Suite 1: Home page Continue CTA (C-4)

### TC-M2-01: Continue links to the last viewed lesson
- **ACs:** C-4.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; `ls-empty`
- **Steps:**
  1. Visit `/lessons/l2-context-files` and wait until `getByRole('button', { name: 'Mark complete' })` is enabled (hydrated).
  2. Visit `/` and wait for hydration.
  3. Locate `getByRole('link', { name: /^Continue: .+/ })`.
- **Expected:** The accessible name is exactly `Continue: <title of l2-context-files>` (PRD wording, DESIGN §6.1), `href` is `/lessons/l2-context-files`, and `readProgress(page).lastViewed.slug === 'l2-context-files'`, with `lastViewed.at` a valid ISO timestamp. Clicking the link lands on that lesson (one click). The card also shows the title as an `h2`.

### TC-M2-02: Continue with no history links to the first L1 lesson
- **ACs:** C-4.2
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; `ls-empty`
- **Steps:**
  1. Visit `/`.
  2. Read `getByRole('link', { name: /^Continue: .+/ })`.
- **Expected:** Name `Continue: <title of l1-first-session>`, `href` `/lessons/l1-first-session` (level 1, sort 1). Exactly one Continue link on the page.

### TC-M2-03: Continue updates when a different lesson is viewed
- **ACs:** C-4.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; `ls-empty`
- **Steps:**
  1. Visit `/lessons/l2-context-files`, then `/lessons/l1-permissions` (hydrate each).
  2. Visit `/`.
- **Expected:** Continue links to `/lessons/l1-permissions`: the most recent view wins, not the furthest lesson. `lastViewed.slug === 'l1-permissions'`.

### TC-M2-04: Continue when lastViewed points to an archived or deleted lesson
- **ACs:** C-4.1, C-4.2, P-4.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; two runs: `seedProgress` with `lastViewed = { slug: 'l2-retired', at: '2026-09-29T01:00:00.000Z' }` (archived), then with `lastViewed.slug = 'deleted-lesson-slug'` (`ls-orphans`)
- **Steps:**
  1. For each state, visit `/` with `collectConsole(page)`.
- **Expected:** Continue silently falls back to the C-4.2 default, `Continue: <title of l1-first-session>` → `/lessons/l1-first-session`, in both runs (DESIGN §6.1, "Last-viewed lesson no longer exists"). No notice, no console errors. `readProgress().lastViewed` is unchanged until another lesson is viewed.
- **Notes:** The archived case is still AMB-13 (DESIGN only covers "no longer exists").

### TC-M2-05: Continue CTA is hydration-safe and swaps in place
- **ACs:** C-4.1, P-5.1, S9-09, D-4.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; `seedProgress` with `lastViewed = { slug: 'l2-context-files', at: … }`; a `layout-shift` PerformanceObserver injected by init script
- **Steps:**
  1. `request.get('/')` (no JS) and inspect the HTML.
  2. Load `/` in the browser with `collectConsole(page)`; wait for hydration; read the Continue link.
  3. Sum `layout-shift` values without `hadRecentInput`.
- **Expected:**
  - Step 1: the server HTML renders the C-4.2 default: a link whose text is `Continue: <title of l1-first-session>` with `href="/lessons/l1-first-session"` (DESIGN §6.1, pre-hydration). It contains no `role="progressbar"` and no `l2-context-files` link target in the Continue card.
  - Step 2: after mount the same link reads `Continue: <title of l2-context-files>` and points there. There are zero hydration warnings (`/hydrat/i`), zero `console.error` and zero `pageerror`.
  - Step 3: the cumulative layout shift from the swap is < 0.05 (same box).

### TC-M2-50: Continue resumes a completed last-viewed lesson
- **ACs:** C-4.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; `ls-one-complete` (`l1-first-session` complete and last viewed)
- **Steps:**
  1. Visit `/`.
- **Expected:** Continue is `Continue: <title of l1-first-session>` → `/lessons/l1-first-session`. It does not jump to the next incomplete lesson (DESIGN §8 row 5). The label never reads "Next up".

## Suite 2: Home page digest and levels (N-6)

### TC-M2-06: Home shows the top 3 digest items (compact) and See all
- **ACs:** N-6.1, L-7.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; default clock
- **Steps:**
  1. Visit `/`.
  2. In `getByRole('list', { name: "Today's digest" })`, read each `listitem` → `article` name in order.
  3. Inside the list, count `getByRole('list', { name: 'Tags' })` and the text "Why it matters".
  4. Click `getByRole('link', { name: 'See all' })`.
- **Expected:**
  - Exactly 3 `listitem`s, in the order `n01`, `n02`, `n19` (same as `/news` positions 1–3). The column eyebrow reads "Today · Wed 30 Sep".
  - The compact variant has 0 tag lists and 0 "Why it matters" occurrences, and `n19`'s `why_it_matters` text is absent. `n19`'s title renders as literal text `Ignore previous instructions <b>bold</b>`, with no `<b>` element, and `window.__xss` is undefined.
  - Each title link is named `/^<title> \(opens in new tab\)$/`.
  - "See all" navigates to `/news`.

### TC-M2-07: Home digest with no runs ever
- **ACs:** N-6.1, S9-12
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-no-news`
- **Steps:**
  1. Visit `/` with `collectConsole(page)`.
- **Expected:**
  - The news column shows the compact EmptyState `getByRole('region', { name: 'No news yet. Run npm run news:run.' })`, whose text is the PRD string verbatim.
  - No "Today's digest" list.
  - The Continue link and level cards still render (the empty news column does not block the page). "See all" is present and links to `/news`. No console errors.

### TC-M2-08: Home digest when the digest is stale
- **ACs:** N-6.1, N-3.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; cookie `fm_test_now=2026-10-01T09:00:00+08:00`
- **Steps:**
  1. Visit `/`.
- **Expected:**
  - The list is `getByRole('list', { name: 'Latest digest' })` and holds `n01`, `n02`, `n19` (all dated 2026-09-30).
  - The column header reads "Latest · Wed 30 Sep", with a Badge showing the text "Stale" and an icon (DESIGN §6.1).
  - The news column contains neither the word "Today" nor "today", and there is no list named "Today's digest".
  - "See all" → `/news`.

### TC-M2-09: Home digest when nothing clears the bar
- **ACs:** N-6.1, S9-13
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-news-lowbar`
- **Steps:**
  1. Visit `/`.
  2. Follow the archive link in the news column.
- **Expected:** No digest list items. The column shows "Nothing above the relevance bar today" and a link to the archive. Following it lands on `/news/archive?from=2026-09-30&to=2026-09-30&min=0` (the same target as `/news`, DESIGN §6.5). No item scored < 60 appears on the home page. "See all" still links to `/news`.
- **Notes:** The home link's accessible name is not in DESIGN §11; AMB-M10.

### TC-M2-51: Home heading, level cards and curriculum link
- **ACs:** C-2.1, C-3.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; `ls-one-complete`
- **Steps:**
  1. Visit `/`; wait for hydration.
  2. Read `getByRole('heading', { level: 1 })`, the links matching `/^Level \d/`, `getByRole('progressbar', { name: 'Level 1' })` and `getByRole('link', { name: 'View full curriculum' })`.
  3. Click the "Level 2 Context engineering" link.
- **Expected:**
  - The h1 is exactly "Learn Claude Code and Codex CLI, basics to orchestration" (one h1).
  - There are 2 level links named "Level 1 Foundations" and "Level 2 Context engineering" (visible "L1"/"L2" is `aria-hidden`).
  - The Level 1 progressbar has `aria-valuenow="50"` with visible text "1 / 2"; Level 2 has `aria-valuenow="0"` and "0 / 2".
  - "View full curriculum" → `/curriculum`. Step 3 lands on `/curriculum#level-2`.
  - The document title is "Home · First Mate AI Playground" or the DESIGN §5.3 equivalent for `/`.

### TC-M2-52: Home with no curriculum seeded and home loading skeleton
- **ACs:** S9-02, S9-03
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** Run A: `fx-no-content`. Run B: `fx-base` with `fm_test_delay=/:1500` (README §4 hook 5)
- **Steps:**
  1. Run A: visit `/`.
  2. Run B: visit `/` and check `getByTestId('home-skeleton')` before the delay ends, then after.
- **Expected:**
  - Run A: the Continue card and the levels area are replaced by one `region` "No lessons seeded yet. Run npm run seed." There is no Continue link and no progressbar.
  - Run B: `home-skeleton` is visible with `aria-busy="true"` during the delay. It is replaced by the real Continue card, 2 level cards and 3 news rows, with CLS < 0.05.

## Suite 3: Content changes without redeploy (S-3)

### TC-M2-10: Edited lesson title shows after seed, no rebuild
- **ACs:** S-3.1, S-2.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** **prod** (`npm run build && next start`; AMB-27). A temp copy of the fixture content directory (`CONTENT_DIR` pointed at it; AMB-B1), seeded from that copy. Record the `next start` PID and `.next/BUILD_ID`.
- **Steps:**
  1. Visit `/lessons/l1-first-session`; record `getByRole('heading', { level: 1 })`.
  2. In the temp copy, set the frontmatter `title` of the file whose frontmatter `slug` is `l1-first-session` to `Edited title M2-10` (the file name is free).
  3. Run `npm run seed` (exit 0).
  4. Reload the lesson; visit `/curriculum`.
- **Expected:** The h1 is `Edited title M2-10`. The curriculum row `getByRole('link', { name: 'Edited title M2-10' })` exists. The document title starts with `Edited title M2-10 · L1`. The PID and `.next/BUILD_ID` are unchanged.

### TC-M2-11: Removed lesson disappears and returns 404 without redeploy
- **ACs:** S-3.1, S-2.3, C-1.3, S9-05, L-6.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** As TC-M2-10
- **Steps:**
  1. Delete the file whose frontmatter slug is `l2-memory` from the temp copy; run `npm run seed`.
  2. Reload `/curriculum`; `request.get('/lessons/l2-memory')`; visit it.
  3. Visit `/lessons/l2-context-files`; read `getByRole('navigation', { name: 'Lesson' })`.
  4. Restore the file; run `npm run seed`; reload `/lessons/l2-memory`.
- **Expected:**
  - Step 2: no `l2-memory` row. HTTP 404. The page shows h1 "Lesson not found", body text containing `"l2-memory" isn't in the current curriculum.` and `getByRole('link', { name: 'Go to curriculum' })`, with the header and footer present.
  - Step 3: `l2-context-files` is now last, so the nav shows `getByRole('link', { name: 'Back to curriculum' })` and no `/^Next: /` link.
  - Step 4: HTTP 200 and the lesson renders, with no restart (same PID).

### TC-M2-12: Content edit does not disturb stored progress
- **ACs:** S-3.1, P-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** As TC-M2-10; `ls-one-complete`
- **Steps:**
  1. Edit the title of `l1-first-session`; run `npm run seed`.
  2. Reload `/curriculum` and wait for hydration.
- **Expected:** The `Edited title M2-10` row shows the "Completed" badge (progress is keyed by slug, not title). The Level 1 section shows "1 / 2", and `getByRole('progressbar', { name: 'Level 1' })` has `aria-valuenow="50"`.

## Suite 4: Cross-feature journeys

### TC-M2-13: Mark complete, then the curriculum reflects it without reload
- **ACs:** L-5.1, C-1.2, C-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; `ls-empty`; after the first load set `window.__noReload = 1`
- **Steps:**
  1. Visit `/curriculum`; click `getByRole('link', { name: '<title of l1-first-session>' })`.
  2. Click `getByRole('button', { name: 'Mark complete' })`.
  3. Click `getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Curriculum' })` (client-side).
- **Expected:**
  - After step 2: `getByText('Completed ✓ · Undo')` is visible, `getByRole('button', { name: 'Undo' })` exists, and `#fm-live` reads "Lesson marked complete".
  - After step 3: the row shows the "Completed" badge, the Level 1 section shows "1 / 2", and `getByRole('progressbar', { name: 'Level 1' })` has `aria-valuenow="50"`. `window.__noReload === 1`.

### TC-M2-14: Completing the checklist does not complete the lesson
- **ACs:** E-2.3, L-5.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** `fx-base`; `ls-empty`
- **Steps:**
  1. On `/lessons/l1-first-session`, inside `getByRole('group', { name: 'Checklist' })`, check "Test is green", "No test files edited" and "Diff reviewed".
  2. Visit `/curriculum` and `/`.
- **Expected:**
  - The exercise region shows the "Exercise complete" badge, and `#fm-live` reads "Exercise complete". `getByRole('button', { name: 'Mark complete' })` is still present.
  - The curriculum row has no "Completed" badge; Level 1 shows "0 / 2".
  - `readProgress().lessons` has no `l1-first-session` key, and `readProgress().checklists['ex-fx-auto']` is `{c1:true,c2:true,c3:true}`.

### TC-M2-15: Bookmark a lesson and a news item, then view bookmarks
- **ACs:** L-8.1, N-5.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; `ls-empty`
- **Steps:**
  1. On `/lessons/l2-context-files`, click `getByRole('button', { name: 'Bookmark' })`.
  2. On `/news`, click `getByRole('button', { name: 'Bookmark: <title of n02>' })`.
  3. Visit `/bookmarks`.
- **Expected:**
  - Step 1: the button has `aria-pressed="true"`. Step 2: that button has `aria-pressed="true"`.
  - Step 3 shows `getByRole('region', { name: 'Lessons (1)' })`, which contains a link to `/lessons/l2-context-files`, and `getByRole('region', { name: 'News (1)' })`, which contains `n02`'s card.
  - `readProgress().bookmarks.lessons['l2-context-files']` and `readProgress().bookmarks.news[<n02.id>]` are ISO timestamps (records, not arrays).

### TC-M2-16: Bookmarked news item later removed from the DB
- **ACs:** N-5.1, S9-20
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; bookmark `n02` as in TC-M2-15; then delete `n02` with the service-role client
- **Steps:**
  1. Visit `/bookmarks` with `collectConsole(page)`.
  2. Click `getByRole('button', { name: 'Remove bookmark' })`.
- **Expected:**
  - Step 1: the News region shows "Item no longer available" with no link, and the lesson bookmark still renders. There are no console errors, and the id stays in `bookmarks.news` until step 2.
  - Step 2: the row is replaced by an inline `getByRole('button', { name: 'Undo' })`, `#fm-live` reads "Removed from bookmarks", and the id is gone from storage.

### TC-M2-17: Export, reset, import round trip
- **ACs:** P-6.1, P-6.2, P-7.1, P-1.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`. Start from `ls-one-complete`, plus `checklists['ex-fx-auto'] = {c1:true}`, a lesson bookmark (`bookmarks.lessons['l2-context-files']`) and `prefs.tool = 'codex'`. Browser clock `page.clock.setFixedTime('2026-09-30T13:00:00+08:00')`. Clipboard permissions granted.
- **Steps:**
  1. On `/progress`, click `getByRole('button', { name: 'Export progress' })`; capture `page.waitForEvent('download')`.
  2. Fill `getByRole('textbox', { name: 'Type reset to confirm' })` with `reset`; click `getByRole('button', { name: 'Reset all progress' })`.
  3. Check that `/curriculum` shows "0 / 2" for Level 1.
  4. Back on `/progress`, `setInputFiles` on `getByLabel('Import progress file')` with the downloaded file; read the preview; click `getByRole('button', { name: 'Replace my progress' })`.
  5. Visit `/curriculum`, `/lessons/l1-first-session` and `/bookmarks`.
- **Expected:**
  - **Export:** the filename is `fm-playground-progress-2026-09-30.json` (AMB-M4), `#fm-live` reads "Progress exported and copied", and the clipboard text deep-equals the file.
  - **Reset:** `getByRole('status').filter({ hasText: 'All progress has been reset.' })` is visible.
  - **Preview:** `getByRole('status').filter({ hasText: 'Importing replaces everything saved in this browser.' })` also reports 1 lesson and 1 bookmark. The test matches `/1 lessons?/` and `/1 bookmarks?/`, because pluralisation is unspecified.
  - **After import:** a success notice starts with "Progress imported:", and focus moves to it. Level 1 shows "1 / 2". The lesson shows `getByText('Completed ✓ · Undo')`, checkbox "Test is green" is checked, the Codex CLI tab in the "Tool" tablist is selected with `?tool=codex` in the URL (pref-driven, DESIGN §4.4 step 2), and the Lessons region lists `l2-context-files`.
  - `readProgress()` deep-equals the exported JSON.

### TC-M2-18: Tool preference across lesson navigation
- **ACs:** L-2.2, L-2.3
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; `ls-empty`
- **Steps:**
  1. Open `/lessons/l1-first-session?tool=codex`.
  2. Click `getByRole('navigation', { name: 'Lesson' }).getByRole('link', { name: /^Next: / })` (to `l1-permissions`).
  3. Open `/lessons/l2-context-files`; click the "Codex CLI" tab in the "Tool" tablist; click the Next link.
- **Expected:**
  - Step 1: Codex CLI is selected in both the "Tool" and "Starting prompt" tablists. `readProgress()` is null or has `prefs.tool === 'claude'`: a URL alone never writes the pref (DESIGN §4.4 step 3, §8 row 2).
  - Step 2: `l1-permissions` opens on Claude Code with a clean URL (no `?tool`).
  - Step 3: `prefs.tool === 'codex'`. `l2-memory` opens with Codex CLI selected after mount, and the URL gains `?tool=codex` via `replaceState` (`history.length` unchanged by the switch).

### TC-M2-19: Keyboard-only journey
- **ACs:** D-2.2, D-2.3, L-2.1, L-4.1, L-5.1, L-6.1, C-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`; `ls-empty`; clipboard permissions granted. The test may not call `page.mouse`, `click()` or `tap()`.
- **Steps:**
  1. Visit `/curriculum`; press Tab once, which should focus `getByRole('link', { name: 'Skip to content' })`; press Enter.
  2. Tab to `getByRole('link', { name: '<title of l1-first-session>' })`; press Enter.
  3. Tab until the selected tab in the "Tool" tablist is focused; press ArrowRight.
  4. Tab to `getByRole('button', { name: 'Copy code: bash' })` (`blk-bash`); press Enter.
  5. Tab to "Mark complete"; press Enter.
  6. Tab to `getByRole('navigation', { name: 'Lesson' }).getByRole('link', { name: /^Next: / })`; press Enter.
- **Expected:**
  - Step 1: the skip link is the first focus stop and `document.activeElement` becomes `main#main`.
  - Step 3: "Codex CLI" is focused **and** selected (automatic activation), and the URL has `?tool=codex`.
  - Step 4: the clipboard equals the `blk-bash` body. The button name becomes "Copied" for about 2s, and `#fm-live` contains "Copied".
  - Step 5: `getByText('Completed ✓ · Undo')` is visible, `#fm-live` reads "Lesson marked complete", and focus is on `getByRole('button', { name: 'Undo' })`, not `body` (DESIGN §9.3 C-8).
  - Step 6: `/lessons/l1-permissions` loads.
  - Every focus stop has a visible focus indicator (computed `outline-style` not `none`, or a non-empty `box-shadow`); WS-A owns the exact colours (TC-A cases). `document.activeElement` is never `body` after a keypress.

### TC-M2-20: Internal lesson links and back navigation
- **ACs:** C-3.1, L-6.1, L-7.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. On `/lessons/l1-first-session?tool=codex`, click the concept body's internal link to `/lessons/l1-permissions`.
  2. Press browser Back.
- **Expected:** The internal link has no `target` and no "(opens in new tab)" text, and it lands on `l1-permissions` in the same tab. Back returns to `l1-first-session?tool=codex` with Codex CLI still selected.

## Suite 5: Full-route sweeps

### TC-M2-21: axe sweep on every route, default state
- **ACs:** D-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`; `ls-one-complete`; `@axe-core/playwright` with tags `wcag2a, wcag2aa, wcag21aa, wcag22aa`
- **Steps:**
  1. For each route in ROUTES: load, wait for hydration, and run axe on the full page.
- **Expected:**
  - Zero `serious` or `critical` violations on every route. A failure report lists the route and the rule id.
  - Each route has exactly one `h1`, one `main`, and one exposed `navigation` "Main".

### TC-M2-22: axe sweep on lessons in both tab states
- **ACs:** D-2.1, L-3.2
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. For each of the 4 active fixture lessons, load `?tool=claude` and run axe, then load `?tool=codex` and run axe.
- **Expected:** 0 serious/critical violations in all 8 runs. This includes `l1-permissions?tool=codex`, where the Codex CLI panel shows the Notice "No native equivalent in Codex CLI (as of v0.40.0)" and the h4 "Closest workaround". Inactive panels have the `hidden` attribute.

### TC-M2-23: axe sweep on expanded and open states
- **ACs:** D-2.1, D-3.2, E-3.1, N-2.1, P-6.2, P-2.1, P-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. `/lessons/l1-first-session`: click `getByRole('button', { name: 'Compare with reference solution' })` (`aria-expanded` → `true`), then run axe.
  2. `/news`: click `getByRole('button', { name: 'Unscored (3)' })`, then run axe.
  3. At 360×800: click `getByRole('button', { name: 'Menu' })` (`aria-expanded="true"`), then run axe.
  4. `/progress`: load a valid export into "Import progress file" (preview `status`), run axe. Then load `not-json.txt`, which shows `getByRole('alert').filter({ hasText: "This file isn't a valid progress export." })`, and run axe. Then type `res` into "Type reset to confirm", click "Reset all progress" (field error "Type reset exactly to confirm."), and run axe.
  5. With `blockStorage(page)`, and separately with `ls-corrupt-json`, load `/curriculum` and run axe. The storage banner or the corrupted notice is visible.
- **Expected:** 0 serious/critical violations in every state. No `dialog` role appears anywhere.

### TC-M2-24: axe sweep in dark mode
- **ACs:** D-5.1, D-2.1
- **Level:** e2e
- **Priority:** P1
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`; `page.emulateMedia({ colorScheme: 'dark' })`
- **Steps:**
  1. Repeat TC-M2-21 for every route, and TC-M2-22 for `l1-permissions` in both tab states.
- **Expected:** 0 serious/critical violations, including `color-contrast`.

### TC-M2-25: axe sweep on §9 empty states
- **ACs:** D-2.1, S9-02, S9-12, S9-13, S9-16, S9-19
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-no-content`, `fx-no-news`, `fx-news-lowbar`, `fx-base`; `ls-empty`
- **Steps:**
  1. `fx-no-content`: `/curriculum` and `/`.
  2. `fx-no-news`: `/news` and `/`.
  3. `fx-news-lowbar`: `/news` and `/`.
  4. `fx-base`: `/news/archive?min=80&source=fx-simon&from=2026-09-30&to=2026-09-30` (no matches), and `/bookmarks` with `ls-empty`.
- **Expected:** Each page shows its region:
  - `/curriculum` and `/` (no content): "No lessons seeded yet. Run npm run seed."
  - `/news` (no news): "No news yet. Run npm run news:run."
  - `/news` (low bar): "Nothing above the relevance bar today"
  - archive: "No items match these filters", with exactly one "Clear filters" link
  - `/bookmarks`: "Nothing bookmarked yet", with links "Browse curriculum" and "Today's digest"

  Each has 0 serious/critical violations.

### TC-M2-26: No horizontal scroll on any route at four widths
- **ACs:** D-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Responsive
- **Preconditions / fixtures:** `fx-base`; `ls-one-complete`
- **Steps:**
  1. For each width in 360, 768, 1024 and 1440 (height 900) and each route in ROUTES: load, wait for hydration, and evaluate `document.documentElement.scrollWidth <= window.innerWidth` (DESIGN §9.3 D-1).
  2. At 360 wide, on `/lessons/l1-first-session`, locate the `blk-plain` scroll area (`getByLabel('Code: text')`) and evaluate its `scrollWidth > clientWidth` and its computed `overflow-x`.
- **Expected:** Step 1 is true for all 52 combinations. Step 2: the `pre` overflows internally (`overflow-x` is `auto` or `scroll`) while the page does not.

### TC-M2-27: Responsive sweep with long content
- **ACs:** D-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Responsive
- **Preconditions / fixtures:** `fx-base`. In the test, via a service-role update, set `n01.title` to a 300-character unbroken string and `n01.url` to a 200-character URL. Bookmark `n01` with `seedProgress`.
- **Steps:**
  1. At 360 wide, load `/news`, `/news/archive`, `/` and `/bookmarks`.
- **Expected:** No horizontal page scroll. The long title wraps inside its card (`overflow-wrap: anywhere`). The link's accessible name still matches `/^<full 300-char title> \(opens in new tab\)$/`.

### TC-M2-28: Manual responsive pass with screenshots
- **ACs:** D-3.1, D-3.2, G-1
- **Level:** e2e
- **Priority:** P0
- **Category:** Responsive
- **Preconditions / fixtures:** `fx-base`; real Chrome and Safari windows at 360, 768 and 1440
- **Steps:**
  1. At each width, visit ROUTES: switch lesson tabs (`?tool=claude` and `?tool=codex`), expand "Compare with reference solution" and "Unscored (3)", and at 360 open "Menu".
  2. Save full-page light screenshots `<route-slug>-<width>.png`, plus dark screenshots at 360 and 1440 for changed components (DESIGN §9.2).
- **Expected:**
  - No overlap, clipping or horizontal scroll. Tabs stay two side-by-side tabs at 360.
  - At 360 the "Menu" button toggles `aria-expanded` between false and true. At 768 and 1440 there is no Menu button and the desktop `navigation` "Main" shows all 5 links.
  - Screenshots are attached in the PR template's 360 | 768 | 1440 table (G-5).
- **Notes:** manual.

### TC-M2-29: Hydration sweep with stored progress
- **ACs:** P-5.1, S9-09, L-2.3
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; three runs: `ls-one-complete`, `ls-codex-pref`, `ls-orphans`
- **Steps:**
  1. For each route in ROUTES: attach `collectConsole(page)`, load the page, then wait for network idle plus 500 ms.
  2. For the same routes, fetch the server HTML with `request.get` and search it.
- **Expected:**
  - Step 1: across all 39 loads there are zero `console.error`, zero `pageerror` and zero `/hydrat/i` messages.
  - With `ls-codex-pref` and no `?tool`, lesson pages switch to Codex CLI after mount, and the URL gains `?tool=codex`.
  - Step 2: the server HTML contains no `role="progressbar"`, no "Completed" badge, no "Completed ✓ · Undo" and no "1 / 2". The Claude Code tab has `aria-selected="true"` on every lesson route with no `?tool` param: the server never reads prefs (DESIGN §4.4 step 1).

### TC-M2-30: No "not started" flash before hydration
- **ACs:** P-5.1, S9-09
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; `ls-one-complete`; JS chunk requests delayed 2s with `page.route('**/_next/static/chunks/**', …)`
- **Steps:**
  1. Load `/curriculum`; before JS finishes, read the Level 1 section and the `l1-first-session` row.
  2. Let JS load; read them again.
- **Expected:**
  - Step 1: `getByTestId('progress-placeholder')` elements are present, with `aria-busy="true"`. No `progressbar` role, no "0 / 2" text and no "Completed" badge. The row link already works.
  - Step 2: the placeholders are gone, `getByRole('progressbar', { name: 'Level 1' })` has `aria-valuenow="50"`, and the row shows "Completed".

### TC-M2-31: Lighthouse LCP on four routes
- **ACs:** D-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Perf
- **Preconditions / fixtures:** **prod**; `fx-base`; Lighthouse desktop preset, 3 runs per URL. Tagged `@nightly`: recorded, not merge-gating (AMB-24, AMB-27).
- **Steps:**
  1. Run Lighthouse on `/`, `/curriculum`, `/lessons/l1-first-session` and `/news`.
- **Expected:** The median LCP is < 2000 ms on each URL. The report JSON is archived as a CI artifact. A breach opens an issue; it does not block a PR.

### TC-M2-32: CLS on four routes including font load
- **ACs:** D-4.2, S9-03, S9-14
- **Level:** e2e
- **Priority:** P0
- **Category:** Perf
- **Preconditions / fixtures:** **prod**; `fx-base`; `ls-one-complete`; a `PerformanceObserver('layout-shift')` init script. The Playwright part gates merges; the Lighthouse part is `@nightly`.
- **Steps:**
  1. In Playwright, load each of the four routes with a cold cache and sum the `layout-shift` entries without `hadRecentInput` over 3s.
  2. (`@nightly`) Read Lighthouse CLS for the same routes.
- **Expected:** CLS < 0.05 on every route, including the skeleton-to-content swaps (`curriculum-skeleton`, `news-skeleton`, `home-skeleton`, `progress-placeholder`) and the Satoshi font swap.

### TC-M2-33: Stakeholder Mac performance record
- **ACs:** D-4.1, D-4.2
- **Level:** e2e
- **Priority:** P1
- **Category:** Perf
- **Preconditions / fixtures:** Stakeholder Mac, local Supabase, production build
- **Steps:**
  1. Run Lighthouse desktop on the four routes.
- **Expected:** LCP < 2.0s and CLS < 0.05, with the numbers recorded in the M2 PR.
- **Notes:** manual; AMB-24.

## Suite 6: App-wide states and route smoke

### TC-M2-34: DB down shows the full-page view on every DB route
- **ACs:** S9-01
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** **prod** (the `digest = "DB_UNAVAILABLE"` path, DESIGN §6.10); `fx-base`. After server start, stop the DB container (`docker stop supabase_db_<project>`); restart it in `afterAll`. Clipboard permissions granted. Serial: shared Supabase (AGENTS.md).
- **Steps:**
  1. Visit `/`, `/curriculum`, `/lessons/l1-first-session`, `/exercises`, `/news`, `/news/archive` and `/bookmarks`.
  2. On one of them, click `getByRole('button', { name: 'Copy code: Terminal' })`.
  3. Visit `/progress`.
- **Expected:**
  - Step 1: each page shows `getByRole('heading', { level: 1, name: 'Database unavailable' })`, and a paragraph whose text content equals `DB_UNAVAILABLE_MESSAGE` (imported from `src/lib/db/errors.ts`, not retyped). The header and `navigation` "Main" are still present. The DOM contains no stack trace, no file paths, no `ECONNREFUSED`, no connection string and no `postgres` URL.
  - Step 2: the clipboard equals `DB_UNAVAILABLE_COMMAND` (`supabase start && npm run seed`), and `#fm-live` contains "Copied".
  - Step 3: `/progress` renders normally, with h1 "Progress" and the Export button working (DESIGN §6.10).

### TC-M2-35: DB recovery through "Try again" without server restart
- **ACs:** S9-01, S9-04
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** As TC-M2-34
- **Steps:**
  1. With the DB down, load `/curriculum` (DB-down view).
  2. Start the DB; click `getByRole('button', { name: 'Try again' })` without reloading.
- **Expected:** `/curriculum` renders `getByRole('heading', { level: 1, name: 'Curriculum' })` and 2 `region`s matching `/^Level \d/` (`router.refresh()` plus `reset()`, DESIGN §6.10). The `next start` PID is unchanged and no full navigation happens.

### TC-M2-36: Route smoke for every §8 route
- **ACs:** S9-22, C-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** **prod**; `fx-base`
- **Steps:**
  1. `request.get` each route in ROUTES, then load each in the browser with `collectConsole`.
- **Expected:**
  - Real routes return HTTP 200, and each document title ends with "· First Mate AI Playground".
  - `/does-not-exist` returns 404 with h1 "Page not found" and the link "Go to curriculum".
  - `/lessons/does-not-exist` and `/lessons/l2-retired` return 404 with h1 "Lesson not found" and "Go to curriculum".
  - `/__ui/throw` shows h1 "Something went wrong", `getByRole('alert').filter({ hasText: "This page couldn't load." })`, the button "Try again" and the link "Back to curriculum", with no stack trace or server message.
  - There are no console errors except the intentional throw.

### TC-M2-37: Storage blocked across every route
- **ACs:** P-3.1, S9-10, L-2.4
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `fx-base`; `blockStorage(page)`
- **Steps:**
  1. Visit each route in ROUTES with `collectConsole`.
  2. On `/lessons/l1-first-session`, click the "Codex CLI" tab in the "Tool" tablist, then "Mark complete", then navigate client-side to `/curriculum` using the "Main" nav.
- **Expected:**
  - Step 1: every route shows `getByRole('status').filter({ hasText: "Progress can't be saved in this browser" })` with no Dismiss button, and there are no uncaught errors.
  - Step 2: the tab switches and the URL gains `?tool=codex` (DESIGN §4.4 step 6). The curriculum shows the lesson "Completed" for the session.

## Suite 7: §12 merge gates (M0 mechanism)

Gate cases run as `tests/unit/m2/gates/*.test.ts`. They execute the real bash scripts with a **stub `gh`** (an executable prepended to `PATH` that returns canned JSON per subcommand and appends argv to `$GH_STUB_LOG`), so they need no network and no real PR. Case 40 is the exception: it reads the live repo.

### TC-M2-38: CI runs the full test gate on pull requests
- **ACs:** G-1, S-5.1
- **Level:** integration
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `.github/workflows/ci.yml`
- **Steps:**
  1. Parse the workflow YAML.
  2. Check `playwright.config.ts` and `vitest.config.mts` for tag exclusion.
- **Expected:**
  - `on` includes `pull_request` and `push` to `main`.
  - Job `checks` runs `npm ci`, `typecheck`, `lint`, `test` and `build`.
  - Job `e2e` runs, in order: `supabase start`, the `.env.local` write, `npm run seed`, `npm run db:reset:test`, the Playwright install, then `npm run e2e`, and uploads `playwright-report/` on failure.
  - The default runs exclude `@live`, `@network`, `@nightly` and `@manual` (`grepInvert`, AMB-27). A fixture PR with a failing spec makes the `e2e` check fail, which `gate:merge` then refuses (TC-M2-55).

### TC-M2-39: PR template records all three gates
- **ACs:** G-5, G-1, G-2, G-3
- **Level:** integration
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `.github/pull_request_template.md`
- **Steps:**
  1. Read the template.
- **Expected:** The template contains:
  - the sections "Summary", "Workstream and owned paths", "Merge gates (PRD §12)", "Screenshots" and "Test evidence";
  - the checkbox "I edited no files outside my owned paths";
  - three gate checkboxes naming the labels `gate:browser-green`, `gate:review-green` and `gate:uiux-green`, with the UI/UX line allowing "N/A: no UI changes";
  - a screenshot table with the columns `360 | 768 | 1440`;
  - text stating that a new push invalidates earlier approvals and that merging goes through `npm run gate:merge -- <pr#>`.
- **Notes:** DESIGN §9.2 also asks for dark screenshots at 360 and 1440, but the template table has no dark row (AMB-M11).

### TC-M2-40: main branch protection
- **ACs:** G-6
- **Level:** integration
- **Priority:** P0
- **Category:** Security
- **Preconditions / fixtures:** `gh` authenticated with admin read on `RayAdrian/firstmate-ai-playground`. Tagged `@network`.
- **Steps:**
  1. `gh api repos/RayAdrian/firstmate-ai-playground/branches/main/protection`.
  2. From a throwaway clone, run `git push origin HEAD:main` with a trivial commit.
- **Expected:**
  - Step 1: `required_pull_request_reviews.required_approving_review_count >= 1` and `allow_force_pushes.enabled == false`.
  - Step 2: the push is rejected.
- **Notes:** If the plan doesn't support protection on private repos, record it as a blocker, not a pass (AMB-M8). `gate:merge` enforces gates regardless (TC-M2-55–58).

### TC-M2-41: Branch name and rebase checks
- **ACs:** G-6
- **Level:** integration
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:**
  - Proposed `scripts/gate-branch-name.sh` (M0-owned), using the AGENTS.md pattern `^(ws-[a-f]/|content/l[1-5]-|m2/|qa/|design/|fix/)[a-z0-9][a-z0-9-]*$`.
  - The stub `gh` returns `behind_by` from `repos/…/compare/main...<sha>`.
- **Steps:**
  1. Run the name check on `ws-c/lesson-tabs`, `content/l2-context-files`, `m2/home`, `qa/test-cases`, `design/tokens`, `fix/copy-button`, `feature/tabs`, `ws-g/x`, `WS-C/Tabs` and `ws-c/`.
  2. Run `npm run gate:merge -- 7` with the stub returning `behind_by: 1`, all labels, all statuses `success` and all checks `completed/success`.
- **Expected:**
  - Step 1: the first 6 pass. `feature/tabs`, `ws-g/x`, `WS-C/Tabs` and `ws-c/` fail, and each failure message names the rule.
  - Step 2: exit 1, stderr contains `branch is 1 commit(s) behind main; rebase on main and re-run the gates`, and `$GH_STUB_LOG` has no `pr merge` call.

### TC-M2-42: Owned-path enforcement
- **ACs:** G-2
- **Level:** integration
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** Proposed `scripts/gate-owned-paths.ts` with the PRD §11 ownership table plus AGENTS.md test ownership as data. Test diffs:
  - WS-C, only `src/app/lessons/**` and `tests/e2e/c/**` (pass)
  - WS-C touching `src/lib/progress/store.ts` (fail)
  - WS-C touching `tests/e2e/d/x.spec.ts` (fail)
  - any WS touching `package.json`, `src/lib/contracts/**`, `supabase/migrations/**` or `tests/support/**` after M0 (fail)
  - WS-A touching `public/brand/logo.svg` (pass only if the orchestrator added it to WS-A, DESIGN §10)
- **Steps:**
  1. Run the script with `--ws=<ws> --base=origin/main` for each diff.
- **Expected:** Pass or fail as listed. Failure output lists each offending path and its owner.

### TC-M2-43: Test-first ordering
- **ACs:** G-4
- **Level:** integration
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** Proposed `scripts/gate-test-first.ts`; AC ID → test mapping via `AC: <id>` tokens in test titles (for example `test('TC-M2-01 AC: C-4.1 …')`)
- **Steps:**
  1. Run it on a PR whose implementation commit precedes its test commit.
  2. Run it on a PR that changes implementation for a P0 AC with no tagged test in the PR or on `main`.
  3. Run it on a PR with tests in the same commit as the implementation.
- **Expected:** 1 and 2 fail, naming the AC. 3 passes.

### TC-M2-44: UI/UX gate N/A path
- **ACs:** G-3
- **Level:** integration
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** The UI-diff rule from DESIGN §9: anything under `src/app/**` or `src/components/**` that affects render output, plus `globals.css` and `tokens.css`. Diffs: `scripts/news/**` only; `src/components/ui/button.tsx`; `docs/design/tokens.css`.
- **Steps:**
  1. Classify each diff.
  2. For the scripts-only PR, run `scripts/gate-status.sh 7 uiux success <head> "N/A: no UI changes"` with the stub `gh`.
- **Expected:**
  - Step 1: scripts-only is N/A. `button.tsx` and `tokens.css` require a real review with DESIGN §9.2 evidence.
  - Step 2: exit 0 and a `POST repos/<repo>/statuses/<sha>` with `context=gate/uiux`, `state=success` and `description=N/A: no UI changes`.

### TC-M2-45: Lesson PRs carry needs-human-tool-check
- **ACs:** R-5.1
- **Level:** integration
- **Priority:** P1
- **Category:** Negative
- **Preconditions / fixtures:** A PR on branch `content/l2-context-files` touching `content/lessons/**`
- **Steps:**
  1. Run `gh pr view <n> --json labels`.
  2. Check whether any changed lesson's `last_verified_on` changed in the PR.
- **Expected:** The label `needs-human-tool-check` is present. A proposed CI check fails when content changes lack it. The human verification itself is untestable (AMB-23).

## Suite 8: Definition of done (PRD §2)

### TC-M2-46: Every P0 AC has a passing automated test
- **ACs:** G-4
- **Level:** integration
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** The README traceability matrix; the CI JUnit report of the release run (including the `@nightly` and prod projects)
- **Steps:**
  1. For each P0 AC in the README catalogue, find tests whose titles carry `AC: <id>`.
- **Expected:** Every P0 AC has ≥ 1 automated, non-`@manual` test, and all of them passed. ACs whose only automated tests are `@live` or `@network` are listed separately (I-1.2, I-3.3 live).

### TC-M2-47: All 18 lessons seeded with complete structure
- **ACs:** S-4.1, L-3.1, C-5.1
- **Level:** integration
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** Real content (M3); `npm run seed` against a fresh DB
- **Steps:**
  1. Query `lessons where archived_at is null`, then `exercises where archived_at is null`.
- **Expected:** 18 lessons across levels 1–5 (3, 3, 4, 4, 4 per PRD §7). For each lesson:
  - `claude_md` is non-null, or `claude_no_equivalent` is set and `claude_workaround_md` is non-null; likewise for Codex (DB check constraints);
  - it has 1–5 `differences`;
  - `last_verified_on` is not null and within 60 days (M7);
  - it has exactly one exercise row.

### TC-M2-48: exercises:verify green on real exercises
- **ACs:** E-4.2, E-4.3
- **Level:** integration
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** All 18 `exercises/*`, each with an `exercise.json` validated by `exerciseJsonSchema`
- **Steps:**
  1. `npm run exercises:verify`.
- **Expected:** Exit 0. The output reports ≥ 12 exercises whose `verify` is not `"manual"`, each failing on `starter/` and passing on `solution/`.

### TC-M2-49: Five consecutive scheduled mornings
- **ACs:** I-5.1, I-5.4, I-4.6
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** launchd installed on the stakeholder Mac (M3 burn-in)
- **Steps:**
  1. After 5 mornings, run `select (started_at at time zone 'Asia/Manila')::date as manila_date, trigger, status from ingest_runs where trigger='schedule' order by started_at`.
- **Expected:** 5 consecutive Manila dates, each with one `schedule` run of status `success` or `partial`. The logs are present in `~/Library/Logs/fm-playground/news.log`.
- **Notes:** manual.

## Suite 9: Gate scripts (added after M0 landed)

### TC-M2-53: gate-status.sh argument validation
- **ACs:** G-5
- **Level:** integration
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** Stub `gh`
- **Steps:**
  1. Run `scripts/gate-status.sh` with 4 args.
  2. Run it with gate `lint`.
  3. Run it with state `pending`.
- **Expected:**
  - Each run exits 2, and `$GH_STUB_LOG` shows no `statuses` POST.
  - Step 1 prints the usage line. Step 2 prints `gate must be browser, review or uiux`. Step 3 prints `state must be success or failure`.

### TC-M2-54: gate-status.sh refuses success on a stale SHA
- **ACs:** G-5, G-1
- **Level:** integration
- **Priority:** P0
- **Category:** Security
- **Preconditions / fixtures:** Stub `gh`: PR 7 `headRefOid` = `bbbbbbb…`; `commits/aaaaaaa` resolves to `aaaaaaa…`
- **Steps:**
  1. `scripts/gate-status.sh 7 review success aaaaaaa "ok"`.
  2. `scripts/gate-status.sh 7 review failure aaaaaaa "blocking B1"`.
  3. `scripts/gate-status.sh 7 review success bbbbbbb "<200-character description>"`.
- **Expected:**
  - Step 1: exit 1; stderr `Refusing: PR #7 head is bbbbbbb, not reviewed commit aaaaaaa. Re-review the new head.`; no POST.
  - Step 2: exit 0; POST to `statuses/aaaaaaa…` with `state=failure`, `context=gate/review`. A failure may be recorded on an old SHA.
  - Step 3: exit 0; the POSTed `description` is the first 140 characters; stdout `gate/review=success on bbbbbbb…`.

### TC-M2-55: gate:merge refuses when any gate or check is not green
- **ACs:** G-1, G-2, G-3, G-5
- **Level:** integration
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** Stub `gh` with head `ccccccc…` and `behind_by: 0`. Variants:
  - (a) label `gate:uiux-green` missing
  - (b) `gate/review=failure`
  - (c) `gate/browser` absent
  - (d) a check run `e2e=completed/failure`
  - (e) a check run `e2e=in_progress/null`
  - (f) no check runs at all
- **Steps:**
  1. Run `npm run gate:merge -- 7` for each variant.
- **Expected:** Each run exits 1, and stderr starts with `Refusing to merge PR #7 at ccccccc:`. It lists, respectively:
  - (a) `missing label gate:uiux-green`
  - (b) `status gate/review is not success on ccccccc`
  - (c) `status gate/browser is not success on ccccccc`
  - (d) `CI check e2e: completed/failure`
  - (e) `CI check e2e: in_progress/null`
  - (f) `no CI check runs found on ccccccc`

  No variant makes a `pr merge` call.

### TC-M2-56: gate:merge lists every failure at once
- **ACs:** G-5
- **Level:** integration
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** Stub `gh`: `behind_by: 2`, no labels, no statuses, one failed check
- **Steps:**
  1. `npm run gate:merge -- 7`.
- **Expected:** Exit 1. Stderr lists 8 lines: behind main, 3 missing labels, 3 statuses and 1 CI check. The script does not stop at the first failure.

### TC-M2-57: A push after approval invalidates the gates
- **ACs:** G-5, G-1, G-2, G-3
- **Level:** integration
- **Priority:** P0
- **Category:** Security
- **Preconditions / fixtures:** Stub `gh`: all three `gate/*=success`, all labels and green checks are on SHA `ddddddd…`; the PR head is now `eeeeeee…`, which has no statuses
- **Steps:**
  1. `npm run gate:merge -- 7`.
  2. `scripts/gate-status.sh 7 browser success ddddddd "old"`.
- **Expected:**
  - Step 1: exit 1, listing all 3 statuses as not success on `eeeeeee` (statuses are per SHA; labels alone never suffice).
  - Step 2: exit 1 with the "Refusing: PR #7 head is eeeeeee" message.

### TC-M2-58: gate:merge happy path is pinned to the head SHA
- **ACs:** G-5, G-6
- **Level:** integration
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** Stub `gh`:
  - `behind_by: 0`;
  - the 3 labels;
  - `gate/browser`, `gate/review`, `gate/uiux` all `success` on `fffffff…`;
  - checks `checks=completed/success`, `e2e=completed/success`, `lint=completed/skipped`.
- **Steps:**
  1. `npm run gate:merge -- 7`; with no argument; with `--`.
- **Expected:**
  - With `7`: exit 0; stdout `All gates green for PR #7 at fffffff. Merging (squash).`; `$GH_STUB_LOG` contains exactly `pr merge 7 --squash --delete-branch --match-head-commit fffffff…`.
  - With no argument, or with `--` and no number: exit 2 with the usage line and an empty `$GH_STUB_LOG`.

---

## Coverage

| AC | Cases |
|---|---|
| C-1.2 | TC-M2-13 |
| C-1.3 | TC-M2-11 |
| C-2.1 | TC-M2-13, TC-M2-51 |
| C-3.1 | TC-M2-19, TC-M2-20, TC-M2-36, TC-M2-51 |
| C-4.1 | TC-M2-01, TC-M2-03, TC-M2-04, TC-M2-05, TC-M2-50 |
| C-4.2 | TC-M2-02, TC-M2-04 |
| C-5.1 | TC-M2-47 |
| D-2.1 | TC-M2-21, TC-M2-22, TC-M2-23, TC-M2-24, TC-M2-25 |
| D-2.2, D-2.3 | TC-M2-19 |
| D-3.1 | TC-M2-26, TC-M2-27, TC-M2-28 |
| D-3.2 | TC-M2-23, TC-M2-28 |
| D-4.1 | TC-M2-31, TC-M2-33 |
| D-4.2 | TC-M2-05, TC-M2-32, TC-M2-33 |
| D-5.1 | TC-M2-24 |
| E-2.3 | TC-M2-14 |
| E-3.1 | TC-M2-23 |
| E-4.2, E-4.3 | TC-M2-48 |
| I-4.6, I-5.1, I-5.4 | TC-M2-49 |
| L-2.1 | TC-M2-19 |
| L-2.2 | TC-M2-18 |
| L-2.3 | TC-M2-18, TC-M2-29 |
| L-2.4 | TC-M2-37 |
| L-3.1 | TC-M2-47 |
| L-3.2 | TC-M2-22 |
| L-4.1 | TC-M2-19 |
| L-5.1 | TC-M2-13, TC-M2-14, TC-M2-19 |
| L-6.1 | TC-M2-11, TC-M2-19, TC-M2-20 |
| L-7.1 | TC-M2-06 |
| L-7.2 | TC-M2-20 |
| L-8.1 | TC-M2-15 |
| N-2.1 | TC-M2-23 |
| N-3.1 | TC-M2-08 |
| N-5.1 | TC-M2-15, TC-M2-16 |
| N-6.1 | TC-M2-06, TC-M2-07, TC-M2-08, TC-M2-09 |
| P-1.1 | TC-M2-17 |
| P-2.1 | TC-M2-23 |
| P-3.1 | TC-M2-23, TC-M2-37 |
| P-4.1 | TC-M2-04, TC-M2-12 |
| P-5.1 | TC-M2-05, TC-M2-29, TC-M2-30 |
| P-6.1, P-6.2 | TC-M2-17, TC-M2-23 (P-6.2) |
| P-7.1 | TC-M2-17 |
| R-5.1 | TC-M2-45 |
| S-2.2 | TC-M2-10 |
| S-2.3 | TC-M2-11 |
| S-3.1 | TC-M2-10, TC-M2-11, TC-M2-12 |
| S-4.1 | TC-M2-47 |
| S-5.1 | TC-M2-38 |
| S9-01 | TC-M2-34, TC-M2-35 |
| S9-02 | TC-M2-25, TC-M2-52 |
| S9-03 | TC-M2-32, TC-M2-52 |
| S9-04 | TC-M2-35 |
| S9-05 | TC-M2-11 |
| S9-09 | TC-M2-05, TC-M2-29, TC-M2-30 |
| S9-10 | TC-M2-37 |
| S9-12 | TC-M2-07, TC-M2-25 |
| S9-13 | TC-M2-09, TC-M2-25 |
| S9-14 | TC-M2-32 |
| S9-16, S9-19 | TC-M2-25 |
| S9-20 | TC-M2-16 |
| S9-22 | TC-M2-36 |
| G-1 | TC-M2-28, TC-M2-38, TC-M2-39, TC-M2-54, TC-M2-55, TC-M2-57 |
| G-2 | TC-M2-39, TC-M2-42, TC-M2-55, TC-M2-57 |
| G-3 | TC-M2-39, TC-M2-44, TC-M2-55, TC-M2-57 |
| G-4 | TC-M2-43, TC-M2-46 |
| G-5 | TC-M2-39, TC-M2-53, TC-M2-54, TC-M2-55, TC-M2-56, TC-M2-57, TC-M2-58 |
| G-6 | TC-M2-40, TC-M2-41, TC-M2-58 |

## Ambiguities raised in this file

| ID | Ambiguity | Interpretation assumed |
|---|---|---|
| AMB-M1 | There's no production-safe way to trigger the route error boundary. | Use README §4 hook 7 (`/__ui/throw` under `FM_TEST_MODE=1`, AMB-A1). Needs M0/WS-A agreement. |
| AMB-M2 | ~~Pre-hydration Continue.~~ **Resolved** by DESIGN §6.1: the server renders the C-4.2 default and swaps it in place after mount. | TC-M2-05. |
| AMB-M3 | ~~Home digest states.~~ **Resolved** by DESIGN §6.1 (no digest → compact EmptyState; stale → "Latest · <date>" plus a "Stale" badge; nothing ≥ 60 → copy plus an archive link). | TC-M2-07/08/09. |
| AMB-M4 | The date in the export filename `<YYYY-MM-DD>`: browser-local or Manila? DESIGN §6.8 doesn't say. | Manila, matching DESIGN §7 ("Dates: absolute, Asia/Manila"). The test fixes the browser clock so both readings agree except near midnight. |
| AMB-M5 | ~~A deep-linked `?tool` across navigation.~~ **Resolved** by DESIGN §4.4 step 3 and §8 row 2: the URL never writes `prefs.tool`. | TC-M2-18. |
| AMB-M6 | ~~What the DB-down copy button copies.~~ **Resolved**: `DB_UNAVAILABLE_COMMAND`, button "Copy code: Terminal". | TC-M2-34. |
| AMB-M7 | ~~Does `/progress` show the DB-down page?~~ **Resolved** by DESIGN §6.10: it renders normally. | TC-M2-34. |
| AMB-M8 | Branch protection on a private repo may need a paid GitHub plan. | Missing protection is a blocker to raise. `gate:merge` still enforces the gates. |
| AMB-M9 | ~~Branch names without a letter.~~ **Resolved** by AGENTS.md (`ws-<letter>/`, `content/l<n>-`, `m2/`, `qa/`, `design/`, `fix/`). No script enforces it yet. | TC-M2-41 proposes `scripts/gate-branch-name.sh`. |
| AMB-M10 | The accessible name of the home "nothing above the bar" archive link isn't in DESIGN §11 (on `/news` it is "See today's items in the archive"). | Same name and target as on `/news`. Add a §11 row. |
| AMB-M11 | DESIGN §9.2 requires dark screenshots (360 and 1440) and both tab states, but the PR template table has only 360 / 768 / 1440 light. | The template gains a dark row (M0-owned `.github/`). |
| AMB-M12 | The import preview and success copy pluralisation ("1 lessons" or "1 lesson") is unspecified. | Tests match `/1 lessons?/`. |
