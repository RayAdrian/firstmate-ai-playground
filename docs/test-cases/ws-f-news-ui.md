# WS-F: News UI test cases

Scope: `/news` (Today's digest, Unscored section, stale and empty states) and `/news/archive` (filters, pagination), plus the news bookmark toggle (storage contract owned by WS-D). Owned paths: `src/app/news/`, `src/components/news/`.
Every case runs on `fx-base` (README §3.1) with the server clock cookie `fm_test_now=2026-09-30T13:00:00+08:00` (README §4.1) unless the case says otherwise. Expected results come from the PRD; none are verified against source yet (no code exists).
Home-page top 3 (N-6.1) is in [ws-m2-integration.md](ws-m2-integration.md). The `/bookmarks` rendering of a removed item (S9-20) is in [ws-d-progress.md](ws-d-progress.md).

**Helpers used here (proposed, service-role, `tests/helpers/db.ts`):** `setServerNow(context, iso)` sets the `fm_test_now` cookie; `deleteRuns([...aliases])`; `insertRun({...})`; `patchItems({ alias: { ...fields } })`; `insertItems([...])`. `newsFixture` is the row export from `tests/fixtures/news.ts` (WS-B), used as the oracle for per-item tags, titles, URLs and `published_at`. Every test that mutates the DB runs `db:reset:test` (or the named variant) in `beforeEach`. See AMB-F1.

**Computed facts from `fx-base` at the default clock** (use these, don't recompute ad hoc):
- Digest (2026-09-30, `run-0930`): `n01, n02, n19, n03, n04, n05, n06, n07, n08, n09` (scores 95, 90, 88, 85, 85, 80, 75, 72, 70, 66). Excluded although ≥ 60: `n10` (64), `n11` (61), `n12` (60). Excluded < 60: `n13` (59), `n14` (30).
- Unscored for 2026-09-30: `n15`, `n16` (pending), `n17` (failed) = 3. `n18` (skipped) is excluded.
- Archive counts with no filter but `min` (AMB-09): `min=0` → 30, `min=40` → 21, `min=60` → 18, `min=80` → 9. `source=fx-simon` → 1 (`n27`). `source=fx-anthropic` → 0. `from=2026-09-28&to=2026-09-28` → 4 (`n27`–`n30`). `from=2026-09-29&to=2026-09-30` → 26.

---

## Suite F1: Today's digest header and selection (N-1.1)

### TC-F-01: Header shows latest successful run date and time
- **ACs:** N-1.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; clock 2026-09-30T13:00:00+08:00.
- **Steps:**
  1. `goto('/news')`.
  2. Read the page `h1` region and the header line beneath it.
- **Expected:** The header contains the text `Wed 30 Sep · updated 08:03` (AMB-21 format, AMB-04: time = `finished_at` of `run-0930` in Asia/Manila). The text `12:31` and `12:30` (the failed `run-0930-fail`) appear nowhere on the page. No "No digest yet today" text is present.
- **Notes:** `updated 08:00` would mean `started_at` was used; that fails this case per AMB-04.

### TC-F-02: A later failed run does not replace the digest
- **ACs:** N-1.1
- **Level:** integration
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** `fx-base`. Call the digest query function (the one `/news/page.tsx` uses) directly against local Supabase with now = 2026-09-30T13:00:00+08:00.
- **Steps:**
  1. Call the query.
  2. `insertRun({ started_at: '2026-09-30T14:00+08:00', finished_at: '2026-09-30T14:01+08:00', trigger: 'manual', status: 'failed' })`, call again.
- **Expected:** Both calls return `digest_date = 2026-09-30` and run = `run-0930`. The run id never equals `run-0930-fail` or the new failed run.

### TC-F-03: Partial run counts as a digest run
- **ACs:** N-1.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; `deleteRuns(['run-0930', 'run-0930-fail'])`; clock 2026-09-29T13:00:00+08:00.
- **Steps:**
  1. `goto('/news')`.
- **Expected:** Header contains `Tue 29 Sep · updated 08:04` (from `partial` `run-0929`). The ranked list is `n20` (91), `n24` (81), `n21` (70), in that order, 3 items. `n22` (45) and `n23` (20) are absent. The Unscored toggle reads `Unscored (2)` (`n25`, `n26`). No stale message.
- **Notes:** Items with `digest_date = 2026-09-30` still exist in the DB. They must not appear, because the query is keyed on the selected `digest_date`, not "items newer than". See AMB-F2 on future-dated rows.

### TC-F-04: `/news` renders dynamically (new run visible on reload, no rebuild)
- **ACs:** N-1.1, S9-12
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-no-news`; `next start` already running; clock 2026-09-30T13:00:00+08:00.
- **Steps:**
  1. `goto('/news')`; assert the S9-12 empty state (TC-F-30).
  2. Without restarting the server: `insertRun({ status: 'success', started_at: '2026-09-30T08:00+08:00', finished_at: '2026-09-30T08:03+08:00' })` and `insertItems` one scored item (score 77, `digest_date` 2026-09-30, title `Dynamic render probe`).
  3. `page.reload()`.
- **Expected:** After reload the list contains exactly one item titled `Dynamic render probe`, header `Wed 30 Sep · updated 08:03`. No rebuild or restart happened between steps.

---

## Suite F2: Ranked list contents and order (N-1.2)

### TC-F-05: Exact top-10 order with cap
- **ACs:** N-1.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, default clock.
- **Steps:**
  1. `goto('/news')`.
  2. Collect `getByRole('list', { name: "Today's digest" }).getByRole('listitem')` and each item's title link text.
- **Expected:** Exactly 10 list items. Titles, in order, match `newsFixture` titles for `n01, n02, n19, n03, n04, n05, n06, n07, n08, n09`. Titles of `n10`, `n11`, `n12`, `n13`, `n14` do not appear anywhere inside the list.

### TC-F-06: Tie on score broken by `published_at` descending
- **ACs:** N-1.2
- **Level:** unit
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** The pure sort/select function used by the digest (or the SQL `order by` via integration). Input: `n03` and `n04` rows from `newsFixture` (both 85, `n03.published_at` later), passed in both input orders.
- **Steps:**
  1. Sort `[n04, n03]`.
  2. Sort `[n03, n04]`.
- **Expected:** Both return `[n03, n04]`.
- **Notes:** Also asserted end-to-end by TC-F-05 (positions 4 and 5). Equal score **and** equal `published_at` is unspecified: AMB-F3.

### TC-F-07: Score 60 included, 59 excluded
- **ACs:** N-1.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base`; `patchItems` sets score 50 on `n01`–`n11` and `n19`, so only `n12` (60), `n13` (59) and `n14` (30) remain on 2026-09-30 among 60-ish scores.
- **Steps:**
  1. `goto('/news')`.
- **Expected:** The digest list has exactly 1 item, the `n12` title, showing score `60`. The `n13` title is not in the list, nor in the Unscored section.

### TC-F-08: Exactly 10 and exactly 11 qualifying items
- **ACs:** N-1.2
- **Level:** integration
- **Priority:** P1
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base`; digest query called directly.
- **Steps:**
  1. `patchItems` sets score 50 on `n10`, `n11`, `n12` (qualifying set = 10). Call the query.
  2. Reset; `patchItems` sets score 50 on `n11`, `n12` (qualifying set = 11). Call the query.
- **Expected:** Step 1 returns 10 rows ending with `n09`. Step 2 returns 10 rows ending with `n09`; `n10` (64) is excluded as the 11th.

### TC-F-09: Only `scored` items are ranked
- **ACs:** N-1.2, N-2.1
- **Level:** integration
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** `fx-base`; `patchItems({ n15: { score: 99 } })` (a pending item that somehow carries a score, simulating a half-written row).
- **Steps:**
  1. Call the digest query.
- **Expected:** `n15` is not in the ranked result. It is in the Unscored result.

---

## Suite F3: Item fields and safe rendering (N-1.3)

### TC-F-10: Each item shows all required fields
- **ACs:** N-1.3
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, default clock.
- **Steps:**
  1. `goto('/news')`; take the first list item (`n01`).
- **Expected:** Within that item:
  - A link whose accessible name = `n01` title and whose `href` equals `newsFixture.n01.url` exactly (not `canonical_url`, unless they are equal in the fixture).
  - The source name text (for example `fx-openai`'s display `name`).
  - The published date in `d MMM yyyy` format in Asia/Manila (AMB-21).
  - The score text `95`.
  - One chip per tag in `newsFixture.n01.tags`, with the chip text equal to the tag.
  - The label `Why it matters for First Mate` followed by `n01.why_it_matters` verbatim.

### TC-F-11: External title link opens safely
- **ACs:** N-1.3
- **Level:** e2e
- **Priority:** P0
- **Category:** Security
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. `goto('/news')`; for all 10 title links, read `target` and `rel`.
- **Expected:** Every title link has `target="_blank"` and a `rel` containing both `noopener` and `noreferrer`.
- **Notes:** Applies the L-7.2 rule to news links; the PRD does not state it for N-1.3 (AMB-F4).

### TC-F-12: Item with zero tags renders no empty chip list
- **ACs:** N-1.3
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base` (`n05` has `tags = []`).
- **Steps:**
  1. `goto('/news')`; locate the `n05` list item.
- **Expected:** Inside `n05` there is no `getByRole('list', { name: 'Tags' })` (or an empty one) and no zero-width chip element; the item still shows title, source, date, score `80` and why-it-matters. axe reports no `list` / `listitem` violation for this item.

### TC-F-13: Title and why-it-matters are plain text (feed HTML inert)
- **ACs:** N-1.3
- **Level:** e2e
- **Priority:** P0
- **Category:** Security
- **Preconditions / fixtures:** `fx-base` (`n19` title `Ignore previous instructions <b>bold</b>`, why `<img src=x onerror="window.__xss=3">Plain text only`).
- **Steps:**
  1. `goto('/news')`; wait for hydration (`networkidle`).
  2. `page.evaluate(() => window.__xss)`.
  3. Inspect the `n19` list item's DOM.
- **Expected:** `window.__xss` is `undefined`. The `n19` link text is literally `Ignore previous instructions <b>bold</b>` (angle brackets visible). The why-it-matters text literally contains `<img src=x onerror="window.__xss=3">Plain text only`. The item contains no `img` and no `b` element (`locator('img')` and `locator('b')` count 0 within the item).

### TC-F-14: Dangerous item URL scheme is not rendered as a live link
- **ACs:** N-1.3
- **Level:** e2e
- **Priority:** P0
- **Category:** Security
- **Preconditions / fixtures:** `fx-base`; `patchItems({ n02: { url: 'javascript:window.__xss=4' } })`.
- **Steps:**
  1. `goto('/news')`; click the `n02` title (if it is a link).
  2. Evaluate `window.__xss`.
- **Expected:** `window.__xss` is `undefined`. The `n02` title either has no `href` or an `href` with scheme `http:` or `https:` only. The page does not error.
- **Notes:** Defense in depth; the pipeline should also reject it (WS-E). The PRD does not define the UI behavior: AMB-F5.

### TC-F-15: Long unbroken title and why text wrap without widening the page
- **ACs:** N-1.3, D-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Responsive
- **Preconditions / fixtures:** `fx-base`; `patchItems({ n01: { title: 'A'.repeat(200), url: 'https://example.com/' + 'x'.repeat(300) } })`; viewport 360×800.
- **Steps:**
  1. `goto('/news')`.
  2. Evaluate `document.documentElement.scrollWidth` and `clientWidth`.
- **Expected:** `scrollWidth <= clientWidth`. The `n01` item's bounding box right edge is ≤ 360. The why-it-matters text is fully visible (not clipped to one line without an ellipsis affordance).

---

## Suite F4: Unscored section (N-2.1)

### TC-F-16: Unscored section is collapsed, counts pending and failed only
- **ACs:** N-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, default clock.
- **Steps:**
  1. `goto('/news')`.
  2. Locate `getByRole('button', { name: /^Unscored \(\d+\)/ })`.
- **Expected:** The button's name is `Unscored (3)`. `aria-expanded="false"`. The titles of `n15`, `n16`, `n17` are not visible (`toBeHidden`). The button is below the ranked list in document order (its bounding box `y` is greater than the last digest list item's).

### TC-F-17: Expanded Unscored shows titles without score or why-it-matters
- **ACs:** N-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. `goto('/news')`; click `Unscored (3)`.
- **Expected:** `aria-expanded="true"`. The controlled region shows exactly 3 items: `n15`, `n16`, `n17` titles (order not asserted; AMB-F6). None of the 3 items contains a score number, the label `Why it matters for First Mate`, or tag chips. The `n18` (skipped) title and the `n25`/`n26` (other day) titles are not present anywhere on the page.

### TC-F-18: Unscored items never enter the ranked list
- **ACs:** N-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. `goto('/news')`; expand Unscored.
  2. Collect titles inside `getByRole('list', { name: "Today's digest" })`.
- **Expected:** None of `n15`, `n16`, `n17`, `n18` titles is inside the digest list. The digest list still has exactly 10 items (TC-F-05 order).

### TC-F-19: No unscored items on the digest date
- **ACs:** N-2.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-news-lowbar` (5 scored items, none pending or failed).
- **Steps:**
  1. `goto('/news')`.
- **Expected:** Per interpretation in AMB-F7: no `Unscored (0)` button is rendered. No empty disclosure is present.

### TC-F-20: Unscored toggle keyboard operation
- **ACs:** N-2.1, D-2.2
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. `goto('/news')`; Tab until `Unscored (3)` is focused (`toBeFocused`).
  2. Press `Enter`; press `Space`.
- **Expected:** After Enter, `aria-expanded="true"` and the 3 titles are visible; after Space, `aria-expanded="false"`. Focus stays on the button after each press. The button has `aria-controls` pointing to the id of the region it shows.

---

## Suite F5: Stale digest and time zone (N-3.1)

### TC-F-21: No run today shows stale message with the latest date
- **ACs:** N-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `fx-base`; clock 2026-10-01T09:00:00+08:00.
- **Steps:**
  1. `goto('/news')`.
- **Expected:** The header contains `No digest yet today. Showing Wed 30 Sep`. The command `npm run news:run` is visible inside a code element with a copy button (`getByRole('button', { name: /^Copy/ })`). The ranked list is the 2026-09-30 digest (TC-F-05 order, 10 items).

### TC-F-22: Stale command copy writes exact text
- **ACs:** N-3.1, L-4.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** as TC-F-21; context `grantPermissions(['clipboard-read', 'clipboard-write'])`.
- **Steps:**
  1. Click the copy button next to `npm run news:run`.
  2. `navigator.clipboard.readText()`.
- **Expected:** Clipboard equals `npm run news:run` exactly (no trailing newline, no `$ ` prompt). `getByRole('status')` contains `Copied`.

### TC-F-23: Manila midnight boundary decides staleness (UTC still the previous day)
- **ACs:** N-3.1, N-1.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. Clock 2026-10-01T07:59:00+08:00 (= 2026-09-30T23:59Z). `goto('/news')`.
  2. Clock 2026-09-30T23:59:00+08:00. `goto('/news')`.
  3. Clock 2026-10-01T00:00:00+08:00. `goto('/news')`.
- **Expected:** Step 1: `No digest yet today. Showing Wed 30 Sep` (an implementation that uses the UTC date would wrongly show no stale message). Step 2: no stale message, header `Wed 30 Sep · updated 08:03`. Step 3: `No digest yet today. Showing Wed 30 Sep`.

### TC-F-24: Early Manila morning, previous day's run is stale even though UTC dates match
- **ACs:** N-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base`; `deleteRuns(['run-0930', 'run-0930-fail'])`; clock 2026-09-30T00:30:00+08:00 (= 2026-09-29T16:30Z).
- **Steps:**
  1. `goto('/news')`.
- **Expected:** `No digest yet today. Showing Tue 29 Sep`. The list shows the 2026-09-29 digest (`n20`, `n24`, `n21`).

### TC-F-25: Browser time zone does not change displayed dates or times
- **ACs:** N-1.1, N-1.3, N-3.1, P-5.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; default clock; `collectConsole(page)`. Run twice: browser context `timezoneId: 'America/Los_Angeles'` (where it is still 2026-09-29 22:00) and `timezoneId: 'UTC'`. `patchItems({ n01: { published_at: '2026-09-29T16:30:00Z' } })` (= 30 Sep 00:30 Manila).
- **Steps:**
  1. `goto('/news')`; wait for hydration.
- **Expected:** In both contexts: header `Wed 30 Sep · updated 08:03` (not `Tue 29 Sep`, not `17:03` or `00:03`); no stale message; `n01` published date shows `30 Sep 2026`. `collectConsole` records no hydration warnings (a client-side re-format in local time would mismatch server HTML).

---

## Suite F6: Archive filters and URL state (N-4.1)

### TC-F-26: Unfiltered archive, first page, newest first
- **ACs:** N-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. `goto('/news/archive')`.
  2. Read each result's published date (or the `datetime` attribute of its `time` element).
- **Expected:** 25 results. Their `published_at` values are non-increasing (AMB-09) and equal the first 25 of `newsFixture` sorted by `published_at` desc. `getByRole('link', { name: 'Next page' })` has `href` containing `page=2`. Unscored items appear with no score and no why-it-matters (AMB-09 interpretation: `min=0` default includes them).

### TC-F-27: Minimum score filter, each allowed value
- **ACs:** N-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. For each value `0, 40, 60, 80`: select it in `getByLabel('Minimum score')` via the UI.
  2. Read the URL and the total result count (sum across pages, or a results-count text if present).
- **Expected:** URL contains `min=<value>` (for `0`, `min=0` or no `min`; AMB-F8). Totals: 30, 21, 18, 9. Every result at `min=40/60/80` shows a score ≥ that value; `n13` (59) is present at 40, absent at 60; `n12` (60) is present at 60; `n05` (80) is present at 80. The select offers exactly the 4 options `0, 40, 60, 80`.

### TC-F-28: Source filter and date range filter
- **ACs:** N-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. Choose `fx-simon` in `getByLabel('Source')`.
  2. Clear; set `getByLabel('From')` = 2026-09-28 and `getByLabel('To')` = 2026-09-28.
  3. Set From 2026-09-29, To 2026-09-30.
- **Expected:** Step 1: URL has `source=fx-simon`; exactly 1 result, `n27`. Step 2: URL has `from=2026-09-28&to=2026-09-28`; exactly 4 results, `n27`–`n30` (inclusive range on `digest_date`, AMB-09). Step 3: 26 results over 2 pages (25 + 1): boundary +1 over the page size.

### TC-F-29: Tag multi-select semantics
- **ACs:** N-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; expected sets computed from `newsFixture.tags`.
- **Steps:**
  1. In `getByRole('group', { name: 'Tags' })`, check `security`.
  2. Also check `tooling`.
- **Expected:** Step 1: URL carries `security`; every result has a `security` chip; count = fixture items tagged `security`. Step 2: URL carries both tags; the result set equals the **OR** (union) of items tagged `security` or `tooling`. See AMB-F9: if the decision is AND, swap to intersection; the fixture must contain at least one item with both tags and one with only one, so the two readings give different counts (WS-B to guarantee).

### TC-F-30: Combined filters are applied together
- **ACs:** N-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. `goto('/news/archive?min=80&from=2026-09-29&to=2026-09-30')`.
- **Expected:** Results are exactly `n01, n02, n03, n04, n05, n19, n20, n24` (8 items, score ≥ 80 within those digest dates), ordered by `published_at` desc. `n27` (99, 2026-09-28) is absent.

### TC-F-31: URL round-trip on reload and history navigation
- **ACs:** N-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. `goto('/news/archive')`; set min 60 via the UI; then check tag `security`.
  2. `page.reload()`.
  3. `page.goBack()`.
  4. `page.goForward()`.
- **Expected:** Step 2: the min select shows 60, `security` is checked, results equal the min 60 ∩ security set. Step 3: URL no longer has the tag; min 60 still applied; tag checkbox unchecked; results match. Step 4: tag restored in URL, checkbox and results. Each filter change is its own history entry (AMB-F10).

### TC-F-32: Changing a filter returns to page 1
- **ACs:** N-4.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. `goto('/news/archive?page=2')` (5 results).
  2. Select min 80.
- **Expected:** URL has no `page` or `page=1`; 9 results shown. The page is not an empty page 2 (AMB-F10).

### TC-F-33: Invalid parameter values degrade to defaults without error
- **ACs:** N-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** `fx-base`; `collectConsole(page)`.
- **Steps:** For each URL, `goto` and record the response status:
  1. `/news/archive?min=55`
  2. `/news/archive?min=abc`
  3. `/news/archive?page=0`, `?page=-1`, `?page=abc`
  4. `/news/archive?from=2026-13-45`, `?to=yesterday`
  5. `/news/archive?tag=not-a-tag`
- **Expected:** Every response is HTTP 200 (never 500), no `pageerror`. 1–2: min treated as 0 (30 results total); the select shows `0`. 3: page 1 shown (25 results). 4: the malformed bound is ignored (30 results). 5: `not-a-tag` is ignored and no checkbox for it appears; 30 results (AMB-F11 on reject vs ignore).

### TC-F-34: Out-of-range page and inverted date range
- **ACs:** N-4.1, S9-16
- **Level:** e2e
- **Priority:** P1
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. `goto('/news/archive?page=999')`.
  2. `goto('/news/archive?from=2026-09-30&to=2026-09-28')`.
- **Expected:** 1: HTTP 200, the S9-16 empty state `No items match these filters` with `Clear filters` (AMB-F12). 2: HTTP 200, no 500, either the S9-16 empty state or the dates swapped (26 results); the decision is AMB-F12, and the test asserts whichever is chosen.

### TC-F-35: Injection strings in parameters are inert
- **ACs:** N-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Security
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. `goto("/news/archive?tag=' OR 1=1--&source=%3Cscript%3Ewindow.__xss%3D5%3C%2Fscript%3E&from=2026-09-01'")`.
  2. Evaluate `window.__xss`.
- **Expected:** HTTP 200. `window.__xss` is `undefined`. No `script` element whose text contains `__xss` exists. The result set is either empty (S9-16) or the unfiltered set; it is never "all rows" by way of the SQL string being executed (the `tag` value is treated as an unknown tag). Server logs show no SQL error.

### TC-F-36: Unknown source slug shows the empty state
- **ACs:** N-4.1, S9-16
- **Level:** e2e
- **Priority:** P1
- **Category:** Negative
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. `goto('/news/archive?source=no-such-source')`.
  2. `goto('/news/archive?source=fx-anthropic')`.
- **Expected:** Both: HTTP 200, `No items match these filters` and `getByRole('button' or 'link', { name: 'Clear filters' })` visible. (Step 2 is a real source with 0 items.)

### TC-F-37: Pagination is 25 per page across multiple pages
- **ACs:** N-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-news-archive-60` (90 items).
- **Steps:**
  1. `goto('/news/archive')`; follow `Next page` until it is absent.
- **Expected:** Pages 1–3 have 25 results each; page 4 has 15. Page 4 has no `Next page` link; page 1 has no `Previous page` link. No item appears on two pages; the union of all pages = all 90 fixture items. Filter params present in the URL are preserved in the `Next page` `href`.

### TC-F-38: Pagination preserves filters
- **ACs:** N-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. `goto('/news/archive?from=2026-09-29&to=2026-09-30')`; click `Next page`.
- **Expected:** URL contains `from=2026-09-29`, `to=2026-09-30` and `page=2`. Exactly 1 result, and it is the oldest by `published_at` of the 26.

---

## Suite F7: Archive and news empty, loading and error states

### TC-F-39: Clear filters resets URL and results
- **ACs:** S9-16, N-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. `goto('/news/archive?source=fx-anthropic&min=80')`.
  2. Activate `Clear filters`.
- **Expected:** Step 1 shows `No items match these filters`. After step 2 the URL is `/news/archive` with no query string; 25 results on page 1; all filter controls are at defaults (no tag checked, min `0`, source empty, dates empty).

### TC-F-40: No runs ever
- **ACs:** S9-12
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `fx-no-news`.
- **Steps:**
  1. `goto('/news')`.
  2. Repeat after `insertRun({ status: 'failed', ... })` for 2026-09-30.
- **Expected:** Both: the text `No news yet. Run `npm run news:run`.` (command in a code element, copyable). No digest header date, no `Unscored` button, no stale message. Step 2 interpretation: only failed runs = "no news yet" (AMB-F13).

### TC-F-41: Nothing above the relevance bar today
- **ACs:** S9-13
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-news-lowbar`; default clock.
- **Steps:**
  1. `goto('/news')`.
  2. Click the archive link in the empty state.
- **Expected:** Header `Wed 30 Sep · updated 08:03`. Text `Nothing above the relevance bar today`. No ranked list items. The link `href` is `/news/archive?from=2026-09-30&to=2026-09-30` (AMB-F14); after clicking, the archive shows exactly the 5 lowbar items.

### TC-F-42: Loading skeletons on `/news` and `/news/archive`
- **ACs:** S9-14, S9-17
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; test hook to delay the DB read by 1500 ms (AMB-F15). Unit fallback: render `src/app/news/loading.tsx` and `src/app/news/archive/loading.tsx`.
- **Steps:**
  1. `goto('/news', { waitUntil: 'commit' })`; screenshot within 300 ms.
  2. Same for `/news/archive`.
- **Expected:** Skeleton cards (`getByTestId('news-skeleton')`, at least 3) are visible with `aria-busy="true"` on their container; no "No news yet" text flashes. After data arrives the skeletons are gone; CLS for the load < 0.05 (PerformanceObserver `layout-shift` sum).

### TC-F-43: Archive error boundary with retry
- **ACs:** S9-18
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `fx-base`; test hook to make the archive query throw once (AMB-F15). Unit fallback: render `src/app/news/archive/error.tsx` with an `Error` and a `reset` spy.
- **Steps:**
  1. `goto('/news/archive')` with the hook armed.
  2. Click `getByRole('button', { name: 'Retry' })`.
- **Expected:** Step 1: a `role=alert` error message inside the app shell (nav still present), a Retry button, no stack trace or file path text (no `at ` frames, no `.ts`/`.tsx` paths, no `digest` hash dumped). Step 2: results render (25 items). In the unit fallback, clicking Retry calls `reset` once.

### TC-F-44: DB down on `/news` uses the app-wide error
- **ACs:** S9-15, S9-01
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** Separate Playwright project whose `webServer` starts with `supabase-down` env.
- **Steps:**
  1. `goto('/news')`; `goto('/news/archive')`.
- **Expected:** Both show `Can't reach the local database. Run `supabase start` then `npm run seed`.` with a copy button. No stack trace, no `ECONNREFUSED`, no URL with port `54399` in visible text. No stale digest or empty-news text is shown instead.

---

## Suite F8: News bookmarks (N-5.1)

### TC-F-45: Toggle bookmark on a digest item
- **ACs:** N-5.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; `ls-empty`.
- **Steps:**
  1. `goto('/news')`; in the `n01` item click `getByRole('button', { name: /Bookmark/ })`.
  2. `readProgress(page)`.
  3. Reload; click the toggle again; `readProgress(page)`.
- **Expected:** After step 1 the button has `aria-pressed="true"` and its name indicates the bookmarked state. `bookmarks.news` contains an entry keyed by `n01`'s DB `id` (uuid, not alias or URL) with a `bookmarkedAt` ISO timestamp (AMB-10). After reload `aria-pressed="true"` persists; after the second click it is `false` and the entry is gone. No other key of `fm-playground:v1` changes.

### TC-F-46: Bookmark from the archive and from Unscored
- **ACs:** N-5.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; `ls-empty`.
- **Steps:**
  1. `goto('/news/archive?from=2026-09-28&to=2026-09-28')`; bookmark `n27`.
  2. `goto('/news')`; expand Unscored; bookmark `n15` if a toggle is present.
- **Expected:** `bookmarks.news` has `n27`'s id. For `n15`, per AMB-F16 interpretation, the toggle is present and the id is stored. `/bookmarks` (WS-D) lists both.

### TC-F-47: Bookmark state is hydration-safe and survives blocked storage
- **ACs:** N-5.1, P-5.1, P-3.1, S9-09
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`. Run A: `seedProgress` with `bookmarks.news = [n01 id]`, `collectConsole`. Run B: `blockStorage(page)`.
- **Steps:**
  1. Run A: fetch `/news` raw HTML with `request.get`; then `goto('/news')`.
  2. Run B: `goto('/news')`; click the `n01` bookmark toggle.
- **Expected:** A: the raw HTML contains no `aria-pressed="true"` on any bookmark toggle; after hydration `n01`'s toggle is `aria-pressed="true"`; no hydration warnings or console errors. B: the page renders the full digest; the banner `Progress can't be saved in this browser` is shown; the toggle flips to `aria-pressed="true"` for the session; no uncaught error.

---

## Suite F9: Accessibility and responsiveness

### TC-F-48: axe on every news state
- **ACs:** D-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base` plus variants as listed; `@axe-core/playwright`, tags `wcag2a, wcag2aa, wcag21aa, wcag22aa`.
- **Steps:** Run axe on:
  1. `/news` default; `/news` with Unscored expanded; `/news` stale (clock 2026-10-01T09:00+08:00).
  2. `/news` on `fx-no-news` and `fx-news-lowbar`.
  3. `/news/archive` default; `?tag=security&min=60`; `?source=fx-anthropic` (empty).
- **Expected:** 0 violations with impact `serious` or `critical` in every state.

### TC-F-49: Heading structure and landmarks
- **ACs:** D-2.1
- **Level:** e2e
- **Priority:** P1
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. On `/news` and `/news/archive`, collect all headings with their levels (`getByRole('heading')`).
- **Expected:** Exactly one `h1` per page. No level is skipped going down (for example `h1` → `h3` without `h2`). `/news` has a heading for the Unscored section region. The digest list is inside `getByRole('main')`.

### TC-F-50: Keyboard-only filtering and focus after apply and paginate
- **ACs:** N-4.1, D-2.2
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. `goto('/news/archive')`; using only `Tab`, `Shift+Tab`, `Space`, arrow keys and `Enter`: check the `security` tag, set Minimum score to 60, set From/To, apply (via the Apply button or auto-apply; AMB-F17).
  2. Tab to `Next page` (on an unfiltered page) and press `Enter`.
- **Expected:** Every filter control is reachable and operable by keyboard with a visible 2px accent focus ring (computed `outline` or `box-shadow`). After applying, `document.activeElement` is not `body` (focus stays on the control changed, or moves to the results heading), and a `role=status` region announces the result count (AMB-F17). After paginating, focus moves to the results heading or list start, not to `body`.

### TC-F-51: Metadata and score contrast use the accessible tokens
- **ACs:** D-1.1, D-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. On `/news`, read the computed `color` and effective background of the `n01` published date, source name, score text and tag chip text.
- **Expected:** None of the text colors equals `rgb(142, 142, 143)` (`#8e8e8f`) or `rgb(236, 97, 42)` (`#ec612a`, accent-2) unless the text is ≥ 24px regular or ≥ 18.66px bold. Each computed contrast ratio against its background is ≥ 4.5:1.

### TC-F-52: No horizontal scroll and wrapping chips at 360/768/1440
- **ACs:** D-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Responsive
- **Preconditions / fixtures:** `fx-base`; `patchItems({ n01: { tags: ['new-model','tooling','framework','security','business'] } })`. Viewports 360×800, 768×1024, 1440×900 (and 1024×768 per D-3.1).
- **Steps:**
  1. At each width, `goto('/news')` (Unscored expanded) and `goto('/news/archive')`.
  2. Compare `scrollWidth` to `clientWidth`; read the `n01` chip bounding boxes.
- **Expected:** `scrollWidth <= clientWidth` on every page and width. At 360 the 5 chips wrap to more than one row (distinct `y` values) and each chip's right edge is within the item. Archive filter controls stack without overflow at 360. A full-page screenshot per width is saved for the G-1 manual check.

### TC-F-53: Touch hit targets on news controls
- **ACs:** D-2.5
- **Level:** e2e
- **Priority:** P1
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`; context `hasTouch: true`, viewport 360×800 (AMB-11).
- **Steps:**
  1. Measure bounding boxes of: each bookmark toggle, the Unscored button, tag checkboxes (including their label hit area), `Next page`, `Clear filters`, the stale copy button.
- **Expected:** Every measured target is ≥ 44×44 CSS px (label + checkbox combined box counts for checkboxes).

---

## Coverage

| AC | Test cases |
|---|---|
| N-1.1 | TC-F-01, TC-F-02, TC-F-03, TC-F-04, TC-F-23, TC-F-25 |
| N-1.2 | TC-F-05, TC-F-06, TC-F-07, TC-F-08, TC-F-09 |
| N-1.3 | TC-F-10, TC-F-11, TC-F-12, TC-F-13, TC-F-14, TC-F-15, TC-F-25 |
| N-2.1 | TC-F-09, TC-F-16, TC-F-17, TC-F-18, TC-F-19, TC-F-20 |
| N-3.1 | TC-F-21, TC-F-22, TC-F-23, TC-F-24, TC-F-25 |
| N-4.1 | TC-F-26 – TC-F-39, TC-F-50 |
| N-5.1 | TC-F-45, TC-F-46, TC-F-47 |
| S9-01 | TC-F-44 (route-level check; app-wide owner is WS-A) |
| S9-09 | TC-F-47 |
| S9-12 | TC-F-04, TC-F-40 |
| S9-13 | TC-F-41 |
| S9-14 | TC-F-42 |
| S9-15 | TC-F-21 (stale), TC-F-44 (DB down) |
| S9-16 | TC-F-34, TC-F-36, TC-F-39 |
| S9-17 | TC-F-42 |
| S9-18 | TC-F-43 |
| P-3.1, P-5.1 | TC-F-25, TC-F-47 (news surface only; owner WS-D) |
| L-4.1 | TC-F-22 (stale command copy) |
| D-1.1, D-2.1, D-2.2, D-2.5, D-3.1 | TC-F-15, TC-F-20, TC-F-48 – TC-F-53 (news routes; owner WS-A) |

Not covered here: N-6.1 (WS-M2), S9-20 (WS-D).

## Ambiguities raised in this file

Global ones cited above: AMB-02 (variants), AMB-03 (clock cookie), AMB-04 (Manila "today", `finished_at`), AMB-09 (archive sort, date field, `min=0`), AMB-10 (`bookmarkedAt`), AMB-11 (touch), AMB-21 (date formats).

| ID | Ambiguity | Interpretation these cases assume |
|---|---|---|
| AMB-F1 | `tests/helpers/db.ts` (service-role mutation helpers) has no owner in §11; `tests/fixtures/` is WS-B's. | WS-B owns it alongside the fixtures; WS-F adds helpers there only via B's PR. |
| AMB-F2 | "Latest `digest_date` that has a successful or partial run": relative to server now, or simply the max in the DB? Only matters when the test clock is earlier than fixture rows. | Max `digest_date` ≤ today (Manila). Tests avoid relying on it by deleting later runs (TC-F-03, TC-F-24). |
| AMB-F3 | Tie on both score and `published_at` has no final tiebreak, so order is non-deterministic. | Final tiebreak by `id` ascending; not asserted until decided. |
| AMB-F4 | N-1.3 does not say whether source links open in a new tab; L-7.2 states it only for lesson markdown. | Same rule as L-7.2 (`_blank`, `noopener noreferrer`). |
| AMB-F5 | UI behavior for an item URL with a non-http(s) scheme is unspecified. | Rendered as plain text title (no link). |
| AMB-F6 | Order of items inside "Unscored (N)" is unspecified. | `published_at` desc; not asserted. |
| AMB-F7 | With zero pending/failed items: hide the section or show "Unscored (0)"? | Hidden. |
| AMB-F8 | Whether `min=0` is written to the URL or omitted as the default. | Either is accepted; tests assert the result set, not the literal param. |
| AMB-F9 | Tag multi-select semantics: OR (any) vs AND (all). Repeated param (`?tag=a&tag=b`) vs comma list (`?tag=a,b`) is also unspecified. | OR; repeated params. The fixture must make OR and AND differ. |
| AMB-F10 | Filter changes: push vs replace history entries, and whether a filter change resets `page`. | Push per change; filter change resets to page 1. |
| AMB-F11 | Invalid params (`min=55`, bad dates, unknown tag): ignore silently, snap, or show a validation message? | Ignore (fall back to default); never 500. |
| AMB-F12 | `page` beyond the last page and `from > to` behavior. | Out-of-range page → S9-16 empty state; `from > to` → S9-16 empty state (swapping is an acceptable alternative if chosen). |
| AMB-F13 | S9-12 "No runs ever": what if runs exist but all are `failed`? | Treated as "No news yet". |
| AMB-F14 | S9-13 "link to the archive filtered to today": exact params. | `/news/archive?from=<today>&to=<today>` with no `min`. |
| AMB-F15 | No hook exists to hold `/news` in a loading state or force a non-DB error for the archive boundary. | `FM_TEST_MODE=1` cookies `fm_test_delay_ms` and `fm_test_throw=news-archive`; otherwise these cases run as unit renders of `loading.tsx` / `error.tsx`. |
| AMB-F16 | Can unscored or skipped items be bookmarked? | Yes for anything rendered with a title (digest, Unscored, archive). |
| AMB-F17 | Archive filters: auto-apply on change vs an Apply button; where focus goes after apply and paginate; whether a results count is announced. | Auto-apply; focus stays on the changed control; `role=status` announces "N results"; after paginating, focus moves to the results heading. |
