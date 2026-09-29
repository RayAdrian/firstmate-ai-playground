# WS-F: News UI test cases

Scope: `/news` (Today's digest, Unscored section, stale and empty states) and `/news/archive` (filters, pagination), plus the news bookmark toggle. The storage contract for bookmarks is owned by WS-D. Owned paths: `src/app/news/`, `src/components/news/`. Tests live in `tests/e2e/f/` and `tests/unit/f/`.
Every case runs on `fx-base` (README §3.1) with the server clock cookie `fm_test_now=2026-09-30T13:00:00+08:00` (README §4.1) unless it says otherwise. Selectors and copy follow [DESIGN.md](../design/DESIGN.md) §11.3 (`/news`, `/news/archive`), §4.12 (NewsCard), §6.5, §6.6 and §7. Where DESIGN is silent the PRD applies; where both are silent, the case cites an AMB. No code exists yet, so nothing here is verified against source.
Home-page top 3 (N-6.1) is in [ws-m2-integration.md](ws-m2-integration.md). The `/bookmarks` rendering of a removed item (S9-20) is in [ws-d-progress.md](ws-d-progress.md).

**Helpers (proposed, service-role, in `tests/support/db.ts`; M0-owned, see AMB-26):**
- `setServerNow(context, iso)` sets the `fm_test_now` cookie.
- `deleteRuns([...aliases])`, `insertRun({...})`, `patchItems({ alias: { ...fields } })` and `insertItems([...])` mutate fixture rows.
- `newsFixture` is the row export from `tests/fixtures/news.ts` (WS-B). It is the oracle for per-item tags, titles, URLs, `published_at` and source names.
- `fmt(iso, pattern)` is `formatInTimeZone(iso, 'Asia/Manila', pattern)` from `date-fns-tz`. The patterns are DESIGN §7's: `EEE d MMM` (day), `EEE d MMM, HH:mm` (card on `/news`) and `EEE d MMM yyyy, HH:mm` (archive card).

Every test that mutates the DB runs `db:reset:test` (or the named variant) in `beforeEach`.

**Locators used throughout (DESIGN §11):**
| Element | Locator |
|---|---|
| Heading and region | `h1` and region: "Today's digest" (fresh) or "Latest digest" (stale) |
| Ranked list | `rankedList = getByRole('list', { name: "Today's digest" })` (an `ol`; "Latest digest" when stale) |
| Card | `card(t) = getByRole('article', { name: t })` |
| Title link | `getByRole('link', { name: new RegExp('^' + esc(t) + ' \\(opens in new tab\\)$') })` |
| Bookmark | `getByRole('button', { name: 'Bookmark: ' + t })` with `aria-pressed` |
| Tags | `card(t).getByRole('list', { name: 'Tags' })` |
| Unscored disclosure | `getByRole('button', { name: /^Unscored \(\d+\)$/ })`, wrapped in an `h2` |
| Archive link | `getByRole('link', { name: 'Browse archive' })` |
| Archive form | `form` "Filters" and `button` "Apply filters" |
| Tag checkboxes | `getByRole('group', { name: 'Tags' }).getByRole('checkbox', { name: 'Security' })` |
| Minimum score | `getByRole('combobox', { name: 'Minimum score' })`, options "Any", "40+", "60+", "80+" |
| Source | `getByRole('combobox', { name: 'Source' })`, first option "All sources" |
| Dates | `getByRole('textbox', { name: 'From' })` and `'To'` |
| Filter chips | links `/^Remove filter: /` |
| Clear | link "Clear filters" |
| Results heading | `h2` "Results" |
| Pagination | `navigation` "Pagination", with links "Previous page", "Next page" and "Page <n>" |
| Announcements | `page.locator('#fm-live')`, never a bare `getByRole('status')` |

**Computed facts from `fx-base` at the default clock** (use these; don't recompute them ad hoc):
- **Digest** (2026-09-30, `run-0930`): `n01, n02, n19, n03, n04, n05, n06, n07, n08, n09` (scores 95, 90, 88, 85, 85, 80, 75, 72, 70, 66). Excluded although ≥ 60: `n10` (64), `n11` (61), `n12` (60). Excluded because < 60: `n13` (59), `n14` (30).
- **Header meta** contains `Wed 30 Sep · updated 08:03` in a `<time datetime="2026-09-30">`. At lg it is followed by ` · 10 items ≥ 60` (DESIGN §6.5).
- **Unscored for 2026-09-30:** `n15` and `n16` (pending, badge "Unscored") plus `n17` (failed, badge "Scoring failed") = 3. `n18` (skipped) is excluded.
- **Archive totals by `min`:** `min=0` → 30 (unscored and skipped included, AMB-09), which is page 1 of 2 ("30 items · page 1 of 2"). `min=40` → 21. `min=60` → 18. `min=80` → 9.
- **Other archive filters:**
  - `source=fx-simon` → 1 (`n27`).
  - `source=fx-anthropic` → 0.
  - `from=2026-09-28&to=2026-09-28` → 4 (`n27`–`n30`).
  - `from=2026-09-29&to=2026-09-30` → 26.
  - Invalid `min` → treated as 0 (DESIGN §6.6).
- **Tag labels** (DESIGN §4.12): `new-model` → "New model", `tooling` → "Tooling", `framework` → "Framework", `business` → "Business", `security` → "Security". The fixed order puts Security last, with the `danger` variant.

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
  2. Read `getByRole('heading', { level: 1 })` and the header meta line beneath it.
- **Expected:**
  - The h1 is exactly "Today's digest".
  - `getByRole('region', { name: "Today's digest" })` exists.
  - The meta line contains `Wed 30 Sep · updated 08:03`. `Wed 30 Sep` is inside `<time datetime="2026-09-30">`.
  - The texts `12:31` and `12:30` (the failed `run-0930-fail`) appear nowhere on the page.
  - "No digest yet today" is absent.
- **Notes:** `updated 08:00` would mean `started_at` was used, which fails this case (AMB-04).

### TC-F-02: A later failed run does not replace the digest
- **ACs:** N-1.1
- **Level:** integration
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** `fx-base`. Call the digest query function (the one `src/app/news/page.tsx` uses) directly against local Supabase with now = 2026-09-30T13:00:00+08:00.
- **Steps:**
  1. Call the query.
  2. `insertRun({ started_at: '2026-09-30T14:00+08:00', finished_at: '2026-09-30T14:01+08:00', trigger: 'manual', status: 'failed' })`, then call the query again.
- **Expected:** Both calls return `digest_date = 2026-09-30` and run = `run-0930`. The run id never equals `run-0930-fail` or the new failed run.

### TC-F-03: Partial run counts as a digest run
- **ACs:** N-1.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; `deleteRuns(['run-0930', 'run-0930-fail'])`; clock 2026-09-29T13:00:00+08:00.
- **Steps:**
  1. `goto('/news')`.
- **Expected:**
  - The h1 is "Today's digest" and the meta line contains `Tue 29 Sep · updated 08:04` (from the `partial` run `run-0929`).
  - `rankedList` has exactly 3 `listitem`s, in the order `n20` (91), `n24` (81), `n21` (70). `n22` (45) and `n23` (20) are absent.
  - The Unscored button name is exactly `Unscored (2)` (`n25`, `n26`).
  - No stale notice.
- **Notes:** Items with `digest_date = 2026-09-30` still exist in the DB and must not appear: the query is keyed on the selected `digest_date`. See AMB-F2 on future-dated rows.

### TC-F-04: `/news` renders dynamically (new run visible on reload, no rebuild)
- **ACs:** N-1.1, S9-12
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-no-news`; the server already running (the `prod` project with `next start`, AMB-27); clock 2026-09-30T13:00:00+08:00.
- **Steps:**
  1. `goto('/news')` and assert the S9-12 empty region (TC-F-40).
  2. Without restarting the server, `insertRun({ status: 'success', started_at: '2026-09-30T08:00+08:00', finished_at: '2026-09-30T08:03+08:00' })`. Then `insertItems` one scored item (score 77, `digest_date` 2026-09-30, title `Dynamic render probe`).
  3. `page.reload()`.
- **Expected:** After the reload, `rankedList` contains exactly one `article`, named `Dynamic render probe`, and the header meta contains `Wed 30 Sep · updated 08:03`. No rebuild or restart happened between steps.

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
  2. Collect `rankedList.getByRole('listitem')` and, inside each, the `article`'s accessible name.
- **Expected:**
  - `rankedList` is an `ol` element with exactly 10 list items.
  - The article names, in order, equal the `newsFixture` titles for `n01, n02, n19, n03, n04, n05, n06, n07, n08, n09`.
  - The titles of `n10`–`n14` appear nowhere inside `rankedList`.
  - An sr-only `h2` "Ranked items" precedes the list inside the "Today's digest" region.

### TC-F-06: Tie on score broken by `published_at` descending
- **ACs:** N-1.2
- **Level:** unit
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** The pure sort/select function used by the digest (or the SQL `order by`, tested through integration). Input: the `n03` and `n04` rows from `newsFixture` (both score 85; `n03.published_at` is later), passed in both input orders.
- **Steps:**
  1. Sort `[n04, n03]`.
  2. Sort `[n03, n04]`.
- **Expected:** Both return `[n03, n04]`.
- **Notes:** Also asserted end to end by TC-F-05 (positions 4 and 5). A tie on both score **and** `published_at` is unspecified (AMB-F3).

### TC-F-07: Score 60 included, 59 excluded
- **ACs:** N-1.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base`; `patchItems` sets score 50 on `n01`–`n11` and `n19`. That leaves `n12` (60), `n13` (59) and `n14` (30) as the only scores near the bar on 2026-09-30.
- **Steps:**
  1. `goto('/news')`.
- **Expected:**
  - `rankedList` has exactly 1 item, the `n12` article, whose score tile text contains `60` (accessible text `Relevance score 60 out of 100`).
  - The `n13` title is not in `rankedList` and not in the Unscored panel.

### TC-F-08: Exactly 10 and exactly 11 qualifying items
- **ACs:** N-1.2
- **Level:** integration
- **Priority:** P1
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base`; the digest query called directly.
- **Steps:**
  1. `patchItems` sets score 50 on `n10`, `n11` and `n12`, which leaves 10 qualifying items. Call the query.
  2. Reset. `patchItems` sets score 50 on `n11` and `n12`, which leaves 11 qualifying items. Call the query.
- **Expected:** Step 1 returns 10 rows ending with `n09`. Step 2 returns 10 rows ending with `n09`; `n10` (64) is excluded as the 11th.

### TC-F-09: Only `scored` items are ranked
- **ACs:** N-1.2, N-2.1
- **Level:** integration
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** `fx-base`; `patchItems({ n15: { score: 99 } })`. This simulates a half-written row: a pending item that carries a score.
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
  1. `goto('/news')`. Take `card(n01.title)`.
- **Expected:** Within that `article`:
  - **Title link.** Accessible name `<n01.title> (opens in new tab)`. `href` equals `newsFixture.n01.url` exactly (not `canonical_url`, unless the fixture makes them equal).
  - **Meta line.** The source's display `name` (the `news_sources.name` of `n01`'s source), then ` · `, then `<time datetime="<n01.published_at ISO>">` whose text equals `fmt(n01.published_at, 'EEE d MMM, HH:mm')`. For example: `Wed 30 Sep, 06:10`.
  - **Score tile.** Visible `95` and `/100`. Accessible text `Relevance score 95 out of 100`: the sr-only spans are present, which `toContainText` checks.
  - **Tags.** `getByRole('list', { name: 'Tags' })` has one `listitem` per tag in `newsFixture.n01.tags`. Each item text is the mapped label ("New model", "Tooling" and so on), never the raw enum value (`new-model`).
  - **Why it matters.** The eyebrow `Why it matters` (DESIGN §4.12; AMB-F19 records the PRD's longer label), followed by a `p` whose text equals `n01.why_it_matters` verbatim.
  - **Bookmark.** A button `Bookmark: <n01.title>`.
  - **Order.** DOM and focus order: the title link comes before the bookmark button.

### TC-F-11: External title link opens safely
- **ACs:** N-1.3
- **Level:** e2e
- **Priority:** P0
- **Category:** Security
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. `goto('/news')`. For all 10 title links in `rankedList`, read `target`, `rel` and the accessible name.
- **Expected:** Every title link has:
  - `target="_blank"`;
  - a `rel` containing both `noopener` and `noreferrer`;
  - an accessible name ending with ` (opens in new tab)`;
  - a decorative `ArrowUpRight` icon marked `aria-hidden`.
- **Notes:** Resolved by DESIGN §4.12 (formerly AMB-F4).

### TC-F-12: Item with zero tags renders no empty tag list
- **ACs:** N-1.3
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base` (`n05` has `tags = []`).
- **Steps:**
  1. `goto('/news')` and locate `card(n05.title)`.
- **Expected:**
  - Inside `n05`, `getByRole('list', { name: 'Tags' })` has count 0, so no empty `ul` is rendered.
  - The card still shows the title link, the meta line, score `80` and why-it-matters.
  - axe reports no `list` or `listitem` violation for this card.

### TC-F-13: Title and why-it-matters are plain text (feed HTML inert)
- **ACs:** N-1.3
- **Level:** e2e
- **Priority:** P0
- **Category:** Security
- **Preconditions / fixtures:** `fx-base`. `n19` has the title `Ignore previous instructions <b>bold</b>` and the why-it-matters `<img src=x onerror="window.__xss=3">Plain text only`.
- **Steps:**
  1. `goto('/news')` and wait for hydration (`networkidle`).
  2. `page.evaluate(() => window.__xss)`.
  3. Inspect `card('Ignore previous instructions <b>bold</b>')`.
- **Expected:**
  - `window.__xss` is `undefined`.
  - The card's `h3` link text is literally `Ignore previous instructions <b>bold</b>`, with the angle brackets visible.
  - The why-it-matters `p` literally contains `<img src=x onerror="window.__xss=3">Plain text only`.
  - The card contains no `img` element and no `b` element (`locator('img')` and `locator('b')` both count 0 inside the article; the `ArrowUpRight` icon is an `svg`, not an `img`).

### TC-F-14: Dangerous item URL scheme is not rendered as a live link
- **ACs:** N-1.3
- **Level:** e2e
- **Priority:** P0
- **Category:** Security
- **Preconditions / fixtures:** `fx-base`; `patchItems({ n02: { url: 'javascript:window.__xss=4' } })`. The DB row schema doesn't restrict the scheme; only snapshot items are `http(s)`-validated (`newsSnapshotSchema`).
- **Steps:**
  1. `goto('/news')`. Click the `n02` title (whether or not it is a link).
  2. Evaluate `window.__xss`.
- **Expected:**
  - `window.__xss` is `undefined`.
  - `n02`'s title either has no `href` or has an `href` with scheme `http:` or `https:` only.
  - The page does not error.
- **Notes:** Defense in depth; the pipeline should also reject such URLs (WS-E). The UI behavior is unspecified (AMB-F5).

### TC-F-15: Long unbroken title and why text wrap without widening the page
- **ACs:** N-1.3, D-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Responsive
- **Preconditions / fixtures:** `fx-base`; `patchItems({ n01: { title: 'A'.repeat(200), url: 'https://example.com/' + 'x'.repeat(300), why_it_matters: 'W'.repeat(280) } })`; viewport 360×800.
- **Steps:**
  1. `goto('/news')`.
  2. Evaluate `document.documentElement.scrollWidth` and `clientWidth`.
  3. Read the bounding boxes of `n01`'s article, title and why `p`.
- **Expected:**
  - `scrollWidth <= clientWidth`.
  - The article's right edge is ≤ 360 − 16 (the gutter).
  - Below `md`, the title and why text span the full content width of the card (their `x` equals the card's content-box left edge, DESIGN §4.12 "< md" template).
  - The why text is fully visible, with no clipping and no ellipsis (the pipeline caps it at 280 characters).

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
  2. Locate `getByRole('button', { name: /^Unscored \(\d+\)$/ })`.
- **Expected:**
  - The button's name is exactly `Unscored (3)`.
  - It has `aria-expanded="false"` and an `aria-controls` whose target element has the `hidden` attribute.
  - The button sits inside an `h2` (`getByRole('heading', { level: 2, name: 'Unscored (3)' })` exists).
  - The titles of `n15`, `n16` and `n17` are not in the accessibility tree (`getByRole('article', { name: n15.title })` has count 0).
  - The button follows `rankedList` in document order.

### TC-F-17: Expanded Unscored shows unscored cards without score or why-it-matters
- **ACs:** N-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. `goto('/news')` and click `Unscored (3)`.
- **Expected:**
  - The button has `aria-expanded="true"`, and the controlled panel is visible.
  - The panel starts with the text `These items haven't been scored yet, or scoring failed. They are not ranked.`
  - The panel then contains a `ul` with exactly 3 `article`s: `n15`, `n16` and `n17`. Their order is not asserted (AMB-F6).
  - Each article has a title link, and its meta line has a badge: `Unscored` for `n15` and `n16`, `Scoring failed` for `n17`.
  - None of the 3 contains a score tile (`Relevance score` text), the eyebrow `Why it matters`, or a `Tags` list.
  - The titles of `n18` (skipped) and `n25`/`n26` (another day) are not present anywhere on the page.

### TC-F-18: Unscored items never enter the ranked list
- **ACs:** N-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. `goto('/news')` and expand Unscored.
  2. Collect the article names inside `rankedList`.
- **Expected:** None of the `n15`, `n16`, `n17` or `n18` titles is inside `rankedList`. `rankedList` still has exactly 10 items, in the TC-F-05 order. The Unscored `ul` is not a descendant of the `ol`.

### TC-F-19: No unscored items on the digest date
- **ACs:** N-2.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-news-lowbar` (5 scored items; none pending or failed).
- **Steps:**
  1. `goto('/news')`.
- **Expected:** No button matches `/^Unscored/`, and no empty disclosure is present (this is the AMB-F7 interpretation).

### TC-F-20: Unscored toggle keyboard operation
- **ACs:** N-2.1, D-2.2
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. `goto('/news')`. Press Tab until `Unscored (3)` is focused (`toBeFocused`).
  2. Press `Enter`, then press `Space`.
- **Expected:**
  - After Enter: `aria-expanded="true"` and the 3 unscored articles are visible.
  - After Space: `aria-expanded="false"` and the panel is `hidden`.
  - Focus stays on the button after each press.
  - The button's `aria-controls` equals the `id` of the panel.

---

## Suite F5: Stale digest and time zone (N-3.1)

### TC-F-21: No run today shows the stale notice with the latest date
- **ACs:** N-3.1, S9-15
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `fx-base`; clock 2026-10-01T09:00:00+08:00.
- **Steps:**
  1. `goto('/news')`.
- **Expected:**
  - The page contains the exact text `No digest yet today. Showing Wed 30 Sep`, with no trailing period, as the notice title.
  - The notice body is `Run the pipeline to fetch today's news.`
  - A CommandLine `figure` contains `npm run news:run` and a copy button matching `/^Copy code: /`. Its expected name is `Copy code: Terminal` (AMB-F18).
  - The notice sits above the header meta line.
  - The list `getByRole('list', { name: 'Latest digest' })` has the 2026-09-30 digest: 10 items in the TC-F-05 order.
- **Notes:** The heading and landmark renaming is covered in TC-F-54.

### TC-F-22: Stale command copy writes exact text
- **ACs:** N-3.1, L-4.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** As TC-F-21; context `grantPermissions(['clipboard-read', 'clipboard-write'])`.
- **Steps:**
  1. Click the copy button in the stale notice's CommandLine.
  2. `navigator.clipboard.readText()`.
- **Expected:**
  - The clipboard equals `npm run news:run` exactly: no trailing newline, no `$ ` prompt.
  - `page.locator('#fm-live')` has the text `Copied`.
  - The button's name becomes `Copied`, then reverts to `/^Copy code: /` after about 2s. Re-query with `/^Cop(y|ied)/`.

### TC-F-23: Manila midnight decides staleness (UTC still the previous day)
- **ACs:** N-3.1, N-1.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. Set the clock to 2026-10-01T07:59:00+08:00 (= 2026-09-30T23:59Z). `goto('/news')`.
  2. Set the clock to 2026-09-30T23:59:00+08:00. `goto('/news')`.
  3. Set the clock to 2026-10-01T00:00:00+08:00. `goto('/news')`.
- **Expected:**
  - Step 1: `No digest yet today. Showing Wed 30 Sep` and the h1 "Latest digest". An implementation that uses the UTC date would wrongly show no stale notice here.
  - Step 2: no stale notice, the h1 "Today's digest", and the meta line `Wed 30 Sep · updated 08:03`.
  - Step 3: `No digest yet today. Showing Wed 30 Sep`.

### TC-F-24: Early Manila morning, previous day's run is stale although the UTC dates match
- **ACs:** N-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base`; `deleteRuns(['run-0930', 'run-0930-fail'])`; clock 2026-09-30T00:30:00+08:00 (= 2026-09-29T16:30Z).
- **Steps:**
  1. `goto('/news')`.
- **Expected:** The notice reads `No digest yet today. Showing Tue 29 Sep`. `getByRole('list', { name: 'Latest digest' })` holds the 2026-09-29 digest: `n20`, `n24`, `n21`.

### TC-F-25: Browser time zone does not change displayed dates or times
- **ACs:** N-1.1, N-1.3, N-3.1, P-5.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:**
  - `fx-base`, default clock, and `collectConsole(page)`.
  - `patchItems({ n01: { published_at: '2026-09-29T16:30:00Z' } })`, which is 30 Sep 00:30 in Manila.
  - Run the case twice: once with browser context `timezoneId: 'America/Los_Angeles'` (where it is still 2026-09-29 22:00), once with `timezoneId: 'UTC'`.
- **Steps:**
  1. `goto('/news')` and wait for hydration.
- **Expected:** In both contexts:
  - The meta line is `Wed 30 Sep · updated 08:03`. It is not `Tue 29 Sep`, and the time is not `17:03` or `00:03`.
  - No stale notice.
  - `n01`'s `time` text is `Wed 30 Sep, 00:30`.
  - `collectConsole` records no hydration warnings. A client-side re-format in local time would mismatch the server HTML.
- **Notes:** DESIGN §8 row 6: news times are always shown in Manila time.

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
  2. Under the h2 "Results", read each `article`'s `time[datetime]`.
- **Expected:**
  - The h1 is "News archive".
  - There are 25 `article`s. Their `published_at` values are non-increasing (AMB-09) and equal the first 25 of `newsFixture` sorted by `published_at` desc.
  - Each card's `time` text uses `fmt(published_at, 'EEE d MMM yyyy, HH:mm')`, for example `Tue 29 Sep 2026, 06:10` (DESIGN §6.6).
  - The results area has the text `30 items · page 1 of 2`.
  - In `navigation` "Pagination": the link "Next page" has an `href` containing `page=2`; "Page 1" is text with `aria-current="page"`, not a link; there is no "Previous page" link.
  - Unscored items (`n15`–`n17`, `n25`, `n26`) that fall on page 1 use the unscored variant, with no score tile and no why-it-matters, because the default `min` is 0.

### TC-F-27: Minimum score select, each allowed value
- **ACs:** N-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. `goto('/news/archive')`. Read the options of `getByRole('combobox', { name: 'Minimum score' })`.
  2. For each of "Any", "40+", "60+" and "80+": `selectOption({ label })`, then click "Apply filters".
  3. Read the URL and the `N items · page X of Y` text.
- **Expected:**
  - Step 1: the combobox is a native `select` with exactly the 4 options "Any", "40+", "60+" and "80+" (values `0`, `40`, `60` and `80`). The default is "Any".
  - Step 2: the URL has `min=0`, `min=40`, `min=60` or `min=80` respectively. The GET form always serialises `min`.
  - Step 3: the totals are `30 items`, `21 items`, `18 items` and `9 items`.
  - Selecting an option alone does not navigate (no auto-submit, DESIGN §6.6).
  - At 40+, 60+ and 80+, every card has a score tile ≥ that value and no unscored card appears. `n13` (59) is present at 40+ and absent at 60+. `n12` (60) is present at 60+. `n05` (80) is present at 80+.

### TC-F-28: Source filter and date range filter
- **ACs:** N-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. Read the first option of `getByRole('combobox', { name: 'Source' })`. Select the `fx-simon` source's name and click "Apply filters".
  2. `goto('/news/archive')`. Fill `getByRole('textbox', { name: 'From' })` with 2026-09-28 and `'To'` with 2026-09-28, then apply.
  3. Fill From 2026-09-29 and To 2026-09-30, then apply.
- **Expected:**
  - Step 1: the first option is "All sources" (value empty). After applying, the URL has `source=fx-simon`, and there is exactly 1 article, `n27`.
  - Step 2: the URL has `from=2026-09-28&to=2026-09-28`, and there are exactly 4 articles, `n27`–`n30`. The range is inclusive on `digest_date` (AMB-09).
  - Step 3: `26 items · page 1 of 2`, with 25 articles on page 1. This is the page-size +1 boundary.

### TC-F-29: Tag multi-select semantics
- **ACs:** N-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; expected sets computed from `newsFixture.tags`.
- **Steps:**
  1. In `getByRole('group', { name: 'Tags' })`, read the checkbox names. Check "Security" and apply.
  2. Also check "Tooling" and apply.
- **Expected:**
  - Step 1: the group has exactly the checkboxes "New model", "Tooling", "Framework", "Security" and "Business", as native `input[type=checkbox][name=tag]`. After applying, the URL has `tag=security`. Every article has a "Security" item in its Tags list. The count equals the number of fixture items tagged `security`.
  - Step 2: the URL has repeated params, `tag=security&tag=tooling` (not a comma list). The result set is the **OR** (union) of items tagged `security` or `tooling`.
- **Notes:** OR vs AND is still open (AMB-F9). If the decision is AND, swap to the intersection. WS-B must guarantee that the fixture has at least one item with both tags and one with only one of them, so the two readings give different counts.

### TC-F-30: Combined filters are applied together
- **ACs:** N-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. `goto('/news/archive?min=80&from=2026-09-29&to=2026-09-30')`.
- **Expected:**
  - The articles are exactly `n01, n02, n03, n04, n05, n19, n20, n24`: 8 items with score ≥ 80 within those digest dates, ordered by `published_at` desc.
  - `n27` (99, 2026-09-28) is absent.
  - The form controls reflect the URL: "Minimum score" shows "80+", and From and To hold the dates.
  - The chips `Remove filter: …` exist for min, from and to (3 links matching `/^Remove filter: /`).

### TC-F-31: URL round-trip on reload and history navigation
- **ACs:** N-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. `goto('/news/archive')`. Select "60+" and apply. Then check "Security" and apply.
  2. `page.reload()`.
  3. `page.goBack()`.
  4. `page.goForward()`.
- **Expected:**
  - Step 2: "Minimum score" shows "60+", "Security" is checked, and the results equal the min 60 ∩ security set.
  - Step 3: the URL has `min=60` and no `tag`; the checkbox is unchecked; the results match.
  - Step 4: the tag is restored in the URL, the checkbox and the results.
- **Notes:** Each Apply is a normal GET navigation and therefore a history entry. Resolved by DESIGN §6.6 (formerly AMB-F10).

### TC-F-32: Applying filters returns to page 1
- **ACs:** N-4.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. `goto('/news/archive?page=2')`; 5 articles are shown.
  2. Select "80+" and click "Apply filters".
- **Expected:** The URL has no `page` param. The page shows `9 items · page 1 of 1` with 9 articles.
- **Notes:** DESIGN §6.6: "Submitting resets `page`."

### TC-F-33: Invalid parameter values degrade without error
- **ACs:** N-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** `fx-base`; `collectConsole(page)`.
- **Steps:** For each URL, `goto` it and record the response status:
  1. `/news/archive?min=55`
  2. `/news/archive?min=abc`
  3. `/news/archive?page=0`, `?page=-1`, `?page=abc`
  4. `/news/archive?from=2026-13-45`, `?to=yesterday`
  5. `/news/archive?tag=not-a-tag`
- **Expected:** Every response is HTTP 200, never 500, and there is no `pageerror`.
  - URLs 1–2: `min` is treated as 0 (DESIGN §6.6). The text is `30 items · page 1 of 2`, and the select shows "Any".
  - URL 3: page 1 is shown (25 articles).
  - URL 4: the malformed bound is ignored (30 items).
  - URL 5: `not-a-tag` is ignored, no checkbox for it appears, and there are 30 items.
- **Notes:** Invalid page, date and tag values are AMB-F11.

### TC-F-34: Out-of-range page and inverted date range
- **ACs:** N-4.1, S9-16
- **Level:** e2e
- **Priority:** P1
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. `goto('/news/archive?page=999')`.
  2. `goto('/news/archive?from=2026-09-30&to=2026-09-28')`.
- **Expected:**
  - Step 1: HTTP 200 and `getByRole('region', { name: 'No items match these filters' })` with the link "Clear filters". This is the AMB-F12 interpretation.
  - Step 2 is covered in detail by TC-F-56: HTTP 200, the field error "End date is before start date.", and results not filtered by date (30 items).

### TC-F-35: Injection strings in parameters are inert
- **ACs:** N-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Security
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. `goto("/news/archive?tag=' OR 1=1--&source=%3Cscript%3Ewindow.__xss%3D5%3C%2Fscript%3E&from=2026-09-01'")`.
  2. Evaluate `window.__xss`.
- **Expected:**
  - HTTP 200, and `window.__xss` is `undefined`.
  - No `script` element whose text contains `__xss` exists. If the source value is echoed (for example in a `Remove filter: …` chip name), it appears as literal text.
  - The result set is either empty (the S9-16 region) or the unfiltered set. It is never "all rows" by way of the SQL string executing: the `tag` value is treated as an unknown tag.
  - The server logs show no SQL error.

### TC-F-36: Unknown or empty source shows the empty state
- **ACs:** N-4.1, S9-16
- **Level:** e2e
- **Priority:** P1
- **Category:** Negative
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. `goto('/news/archive?source=no-such-source')`.
  2. `goto('/news/archive?source=fx-anthropic')`.
- **Expected:** Both return HTTP 200 and show `getByRole('region', { name: 'No items match these filters' })`. `getByRole('link', { name: 'Clear filters' })` has count **exactly 1**, the EmptyState's own link; the active-filter row's link is not rendered when the results are empty (DESIGN §6.6). Step 2 uses a real source that has 0 items.

### TC-F-37: Pagination is 25 per page across multiple pages
- **ACs:** N-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-news-archive-60` (90 items).
- **Steps:**
  1. `goto('/news/archive')`. Follow `getByRole('navigation', { name: 'Pagination' }).getByRole('link', { name: 'Next page' })` until it is absent.
- **Expected:**
  - Pages 1–3 have 25 articles each and page 4 has 15. Page 1 shows `90 items · page 1 of 4`.
  - Page 4 has no "Next page" link, and page 1 has no "Previous page" link.
  - On page 2, "Page 2" is text with `aria-current="page"`, while "Page 1" and "Page 3" are links.
  - No item appears on two pages, and the union of all pages equals all 90 fixture items.
  - The visible text of the pagination links is "Prev" / "Next", contained in their accessible names (WCAG 2.5.3).

### TC-F-38: Pagination preserves filters
- **ACs:** N-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. `goto('/news/archive?from=2026-09-29&to=2026-09-30')` and click "Next page".
- **Expected:** The URL contains `from=2026-09-29`, `to=2026-09-30` and `page=2`. There is exactly 1 article: the oldest of the 26 by `published_at`.

---

## Suite F7: Archive and news empty, loading and error states

### TC-F-39: Clear filters resets the URL and the results
- **ACs:** S9-16, N-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. `goto('/news/archive?source=fx-anthropic&min=80')`.
  2. Click `getByRole('link', { name: 'Clear filters' })`.
- **Expected:**
  - Step 1 shows the region `No items match these filters`.
  - After step 2, the URL is `/news/archive` with no query string.
  - Page 1 has 25 articles and the text `30 items · page 1 of 2`.
  - Every control is at its default: no tag checked, "Minimum score" = "Any", "Source" = "All sources", and From and To empty.

### TC-F-40: No runs ever
- **ACs:** S9-12
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `fx-no-news`.
- **Steps:**
  1. `goto('/news')`.
  2. Repeat after `insertRun({ status: 'failed', started_at: '2026-09-30T08:00+08:00', finished_at: '2026-09-30T08:01+08:00', trigger: 'schedule' })`.
- **Expected:** In both runs:
  - `getByRole('region', { name: 'No news yet. Run npm run news:run.' })` is visible. Its title text is the PRD string verbatim, with `npm run news:run` in inline `code`.
  - Inside the region, a CommandLine `figure` holds `npm run news:run`, with a copy button matching `/^Copy code: /`.
  - There is no header date, no `Unscored` button, no stale notice and no `rankedList`.
- **Notes:** Step 2 applies the AMB-F13 interpretation: a day with only failed runs counts as "no news yet".

### TC-F-41: Nothing above the relevance bar today
- **ACs:** S9-13
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-news-lowbar`; default clock.
- **Steps:**
  1. `goto('/news')`.
  2. Click `getByRole('link', { name: "See today's items in the archive" })`.
- **Expected:**
  - The meta line contains `Wed 30 Sep · updated 08:03`.
  - `getByRole('region', { name: 'Nothing above the relevance bar today' })` contains the body `Today's run found 5 items, all scored below 60.`
  - `rankedList` has count 0.
  - The link's `href` is exactly `/news/archive?from=2026-09-30&to=2026-09-30&min=0` (DESIGN §6.5, formerly AMB-F14).
  - After the click, the archive shows `5 items · page 1 of 1` with exactly the 5 lowbar items.

### TC-F-42: Loading skeletons on `/news` and `/news/archive`
- **ACs:** S9-14, S9-17
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:**
  - `fx-base` and the cookie `fm_test_delay=news:1500` (then `news-archive:1500`), per README §4 hook 5.
  - Unit fallback: render `src/app/news/loading.tsx` and `src/app/news/archive/loading.tsx`.
- **Steps:**
  1. `goto('/news', { waitUntil: 'commit' })`. Assert within 300 ms.
  2. Do the same for `/news/archive`.
- **Expected:**
  - `/news`: `getByTestId('news-skeleton')` is visible with `aria-busy="true"`. It contains 4 news-card skeletons, a header skeleton and one sr-only `role=status` loading text. "No news yet" never appears.
  - `/news/archive`: `getByTestId('archive-skeleton')` is visible with `aria-busy="true"` and 6 card skeletons. The filter form "Filters" is already rendered, because it is static.
  - After the data arrives, the skeletons are gone. The CLS for the load is < 0.05 (the sum of `layout-shift` entries from a PerformanceObserver).

### TC-F-43: Archive error boundary with retry
- **ACs:** S9-18
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:**
  - `fx-base` and the cookie `fm_test_fail=news-archive` (README §4 hook 5; throws once).
  - Unit fallback: render the error boundary with an `Error` and spies for `reset` and `router.refresh`.
- **Steps:**
  1. `goto('/news/archive')` with the hook armed.
  2. Click `getByRole('button', { name: 'Try again' })`.
- **Expected:**
  - Step 1, inside the app shell (`navigation` "Main" still present):
    - the h1 is `Something went wrong`;
    - `getByRole('alert')` contains `This page couldn't load.`;
    - the button `Try again` and the link `Back to curriculum` are present.
  - Step 1 shows no stack trace or file path: no `at ` frames and no `.ts`/`.tsx` paths. A `Reference: <digest>` line in muted text is allowed (DESIGN §6.10).
  - Step 2: the results render (25 articles).
  - In the unit fallback, "Try again" calls both `router.refresh()` and `reset()` exactly once.

### TC-F-44: DB down on `/news` and `/news/archive` uses the app-wide view
- **ACs:** S9-15, S9-01
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** A separate Playwright project (`next start`, AMB-27) whose server env points at `supabase-down`. Context `grantPermissions(['clipboard-read', 'clipboard-write'])`.
- **Steps:**
  1. `goto('/news')`, then `goto('/news/archive')`.
  2. On `/news`, click `getByRole('button', { name: 'Copy code: Terminal' })` and read the clipboard.
- **Expected:**
  - Both routes show the h1 `Database unavailable` and a `p` whose text equals `DB_UNAVAILABLE_MESSAGE`, imported from `src/lib/db/errors.ts` and not retyped.
  - The clipboard equals `DB_UNAVAILABLE_COMMAND` (`supabase start && npm run seed`).
  - There is no stack trace, no `ECONNREFUSED` and no URL with port `54399` in the visible text.
  - Neither the stale notice nor an empty-news region is shown instead.

---

## Suite F8: News bookmarks (N-5.1)

### TC-F-45: Toggle bookmark on a digest item
- **ACs:** N-5.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; `ls-empty`.
- **Steps:**
  1. `goto('/news')`. Click `getByRole('button', { name: 'Bookmark: ' + n01.title })`.
  2. `readProgress(page)`.
  3. Reload, click the toggle again, and call `readProgress(page)` once more.
- **Expected:**
  - After step 1, the button has `aria-pressed="true"` and the same accessible name. The name is fixed; the state is carried by `aria-pressed` and the `BookmarkCheck` icon.
  - `bookmarks.news` is a record with exactly one key, `n01`'s DB `id` (a uuid, not the alias and not the URL). Its value passes `z.string().datetime({ offset: true })` (`progressStateSchema`).
  - After the reload, `aria-pressed="true"` persists. After the second click it is `"false"` and the key is gone (`bookmarks.news` is `{}`).
  - No other key of `fm-playground:v1` changes, and the document still passes `progressStateSchema`.

### TC-F-46: Bookmark from the archive and from Unscored
- **ACs:** N-5.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; `ls-empty`.
- **Steps:**
  1. `goto('/news/archive?from=2026-09-28&to=2026-09-28')` and bookmark `n27`.
  2. `goto('/news')`. Expand Unscored and click `Bookmark: <n15.title>`.
- **Expected:**
  - `bookmarks.news` has keys for `n27`'s id and `n15`'s id.
  - The unscored card has the bookmark button: in DESIGN §4.12 the unscored variant keeps the "title bookmark" row (resolves AMB-F16).
  - `/bookmarks` (WS-D) lists both in its region `News (2)`.

### TC-F-47: Bookmark state is hydration-safe and survives blocked storage
- **ACs:** N-5.1, P-5.1, P-3.1, S9-09
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`.
  - Run A: `seedProgress` with `bookmarks.news = { [n01.id]: '2026-09-30T02:00:00.000Z' }`, plus `collectConsole`.
  - Run B: `blockStorage(page)`.
- **Steps:**
  1. Run A: fetch the raw `/news` HTML with `request.get`, then `goto('/news')`.
  2. Run B: `goto('/news')` and click `n01`'s bookmark toggle.
- **Expected:**
  - Run A, raw HTML: no bookmark button has `aria-pressed="true"`, and every bookmark button has `aria-disabled="true"` (DESIGN §4.12 pre-hydration).
  - Run A, after hydration: `n01`'s toggle is `aria-pressed="true"` without `aria-disabled`. There are no hydration warnings and no console errors.
  - Run B: the page renders the full digest, and `getByRole('status').filter({ hasText: "Progress can't be saved in this browser" })` is visible.
  - Run B: the toggle flips to `aria-pressed="true"` for the session, and there is no uncaught error.

---

## Suite F9: Accessibility and responsiveness

### TC-F-48: axe on every news state
- **ACs:** D-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base` plus the variants listed below; `@axe-core/playwright` with tags `wcag2a, wcag2aa, wcag21aa, wcag22aa`.
- **Steps:** Run axe on:
  1. `/news` by default, with Unscored expanded, and in the stale state (clock 2026-10-01T09:00+08:00).
  2. `/news` on `fx-no-news` and on `fx-news-lowbar`.
  3. `/news/archive` by default, with `?tag=security&min=60`, with `?source=fx-anthropic` (empty), and with `?from=2026-09-30&to=2026-09-28` (field error).
  4. `/news/archive` at 360px with the Filters disclosure open.
- **Expected:** 0 violations with impact `serious` or `critical` in every state.

### TC-F-49: Heading structure and landmarks
- **ACs:** D-2.1
- **Level:** e2e
- **Priority:** P1
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. On `/news` and on `/news/archive`, collect all headings with their levels (`getByRole('heading')`), with Unscored expanded.
- **Expected:**
  - Exactly one `h1` per page, and no level is skipped going down.
  - `/news`: `h1` "Today's digest", then `h2` "Ranked items" (sr-only), `h3` per card, and `h2` "Unscored (3)" wrapping the button.
  - `/news/archive`: `h1` "News archive", `h2` "Filters" (lg), `h2` "Results", and `h3` per card.
  - The digest region and the results are inside `getByRole('main')`.

### TC-F-50: Keyboard-only filtering; focus moves to Results after apply
- **ACs:** N-4.1, D-2.2
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`; viewport 1440×900.
- **Steps:**
  1. `goto('/news/archive')`. Using only `Tab`, `Shift+Tab`, `Space`, arrow keys and `Enter`:
     - check "Security";
     - set "Minimum score" to "60+";
     - type the From and To dates;
     - activate "Apply filters".
  2. After the navigation, read `document.activeElement` and the URL.
  3. Tab to "Next page" on an unfiltered page and press `Enter`.
- **Expected:**
  - Step 1: every filter control is reachable and operable by keyboard, with a visible 2px focus ring (computed `outline`).
  - Step 2: `document.activeElement` is the `h2` "Results" (`tabindex="-1"`).
  - Step 2: the URL holds only filter params. There is no focus flag in the URL; the flag lives in `sessionStorage` and is cleared after use.
  - Step 2: no `aria-live` region announces the count. The count is plain text: `N items · page X of Y`.
  - Step 3: focus is not left on `body`.
- **Notes:** The focus target after pagination is unspecified (AMB-F17).

### TC-F-51: Metadata, score and chip contrast use the accessible tokens
- **ACs:** D-1.1, D-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. On `/news`, read the computed `color` and the effective background for these parts of `n01`: the meta line (source and `time`), the score number, the "/100" text, a `tag` badge, the "Why it matters" eyebrow, and a "Security" (`danger`) badge on any item that has it.
- **Expected:**
  - No text color equals `rgb(142, 142, 143)` (`#8e8e8f`) or `rgb(236, 97, 42)` (`#ec612a`, accent-2).
  - Every computed contrast ratio against its background is ≥ 4.5:1 (DESIGN §2.4 ledger).
  - The score number is not colour-coded by value: `n01` (95) and `n09` (66) have the same computed color (DESIGN §4.12).

### TC-F-52: No horizontal scroll and wrapping chips at 360/768/1024/1440
- **ACs:** D-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Responsive
- **Preconditions / fixtures:** `fx-base`; `patchItems({ n01: { tags: ['new-model','tooling','framework','security','business'] } })`. Viewports 360×800, 768×1024, 1024×768 and 1440×900.
- **Steps:**
  1. At each width, `goto('/news')` (with Unscored expanded) and `goto('/news/archive')`.
  2. Compare `scrollWidth` with `clientWidth`, and read the bounding boxes of `n01`'s Tags list items.
- **Expected:**
  - `scrollWidth <= clientWidth` on every page at every width.
  - The 5 tag items are ordered "New model", "Tooling", "Framework", "Business", "Security", so Security is always last (DESIGN §4.12).
  - At 360, the tags wrap to more than one row (distinct `y` values), and each chip's right edge is within the card.
  - At 360, the score tile sits beside the meta line, and the title spans the full card width.
  - A full-page screenshot is saved per width for the G-1 manual check.

### TC-F-53: Touch hit targets on news controls
- **ACs:** D-2.5
- **Level:** e2e
- **Priority:** P1
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`; context `hasTouch: true` (pointer coarse), viewport 360×800 (AMB-11).
- **Steps:**
  1. Measure the bounding boxes of:
     - each bookmark button and the Unscored button;
     - the tag checkboxes, together with their label hit area;
     - the "Filters (n)" button and "Apply filters";
     - "Next page" and "Previous page", on page 2;
     - a `Remove filter: …` chip and "Clear filters";
     - the stale-notice copy button.
- **Expected:** Every measured target is ≥ 44×44 CSS px. For checkboxes, the combined box of the label and the checkbox counts. Bookmarks are `size-11` on coarse pointers (DESIGN §4.12), and chips are 44px on coarse pointers (DESIGN §4.3).

---

## Suite F10: DESIGN-specific behavior added after the design merge

### TC-F-54: Stale state renames the heading, region and list; the notice has no live role
- **ACs:** N-3.1, S9-15, D-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`; clock 2026-10-01T09:00:00+08:00.
- **Steps:**
  1. `goto('/news')`.
  2. Fetch the raw HTML with `request.get('/news')`.
- **Expected:**
  - The h1 is exactly `Latest digest`, and `getByRole('region', { name: 'Latest digest' })` and `getByRole('list', { name: 'Latest digest' })` exist. The name "Today's digest" appears on no heading, region or list.
  - The stale notice text is in the raw server HTML, because it is server-rendered.
  - Neither `getByRole('alert')` nor `getByRole('status').filter({ hasText: 'No digest yet today' })` matches anything: a server-rendered Notice has no live role (DESIGN §4.10).
  - The notice precedes the header meta line in DOM order.

### TC-F-55: Score tile semantics and the Security tag variant
- **ACs:** N-1.3
- **Level:** unit
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** Render `NewsCard` (scored variant) with `score: 87` and `tags: ['security', 'new-model', 'tooling']`.
- **Steps:**
  1. Read the tile's text content and its sr-only spans.
  2. Read the Tags list items in order, and their icons.
- **Expected:**
  - The tile's full text is `Relevance score 87 out of 100`, and the visible text is `87` and `/100`.
  - The tags read "New model", "Tooling", "Security", in that order, whatever the input order.
  - "Security" renders with the `ShieldAlert` icon (`aria-hidden`) in the `danger` variant. The other tags use the `tag` variant, with no icon.

### TC-F-56: Inverted date range shows a field error and doesn't filter by date
- **ACs:** N-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** `fx-base`; viewports 1440×900 and 360×800.
- **Steps:**
  1. `goto('/news/archive?from=2026-09-30&to=2026-09-28')`.
  2. Read the To field's `aria-describedby` target.
- **Expected:**
  - HTTP 200. The error text `End date is before start date.` renders under To, and To's `aria-describedby` references its id. It is a danger field error, not an `alert`.
  - The results are not filtered by date: `30 items · page 1 of 2`.
  - The server swaps nothing: From and To keep `2026-09-30` and `2026-09-28`.
  - At 360, the "Filters" disclosure is open by default (`aria-expanded="true"`) because the URL has a date-validation error.
- **Notes:** Resolves AMB-F12 for `from > to` (DESIGN §6.6).

### TC-F-57: Filter chips remove one param each
- **ACs:** N-4.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. `goto('/news/archive?tag=tooling&tag=security&min=60')`.
  2. Read the `href` of `getByRole('link', { name: 'Remove filter: Tooling' })` and click it.
  3. Count the `Clear filters` links.
- **Expected:**
  - Step 1 renders 3 chip links matching `/^Remove filter: /`, including "Remove filter: Tooling" and "Remove filter: Security".
  - Step 2: the chip's `href` is the current URL minus `tag=tooling`, with `tag=security` and `min=60` kept. After the click, the results equal min 60 ∩ security.
  - Step 3: exactly one `Clear filters` link, with `href="/news/archive"`.
  - The chips work before hydration: repeat step 2 with `javaScriptEnabled: false` and get the same URL.

### TC-F-58: Nothing ≥ 60 still renders Unscored
- **ACs:** S9-13, N-2.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-news-lowbar`, plus `insertItems` of one pending item on 2026-09-30.
- **Steps:**
  1. `goto('/news')`.
- **Expected:** The region `Nothing above the relevance bar today` is visible, and so is the button `Unscored (1)` below it (DESIGN §6.5: "The Unscored section still renders below it if it has items").

### TC-F-59: Archive filter disclosure below lg
- **ACs:** N-4.1, D-3.1, D-2.2
- **Level:** e2e
- **Priority:** P1
- **Category:** Responsive
- **Preconditions / fixtures:** `fx-base`; viewport 360×800.
- **Steps:**
  1. `goto('/news/archive?tag=tooling&min=60&source=fx-openai')`.
  2. Read `getByRole('button', { name: /^Filters/ })`, then press `Enter` on it.
  3. Resize to 1440×900.
- **Expected:**
  - Step 2 before the press: the button's name is `Filters (3)` (3 = the active filter count), with `aria-expanded="false"` and a `hidden` controlled panel.
  - Step 2 after the press: `aria-expanded="true"`, and the form "Filters" controls are visible and reachable by keyboard.
  - Step 3: the `/^Filters/` button is absent, and the form is always visible.

### TC-F-60: Unscored items are hidden from the archive when `min > 0`
- **ACs:** N-4.1, N-2.1
- **Level:** integration
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** `fx-base`; the archive query called directly.
- **Steps:**
  1. Query with `min = 0`, `min = 40` and `min = 1`.
- **Expected:**
  - `min = 0` includes `n15`, `n16`, `n17`, `n25`, `n26` (pending and failed) and `n18` (skipped; AMB-09).
  - `min = 40` and `min = 1` return no row with `scoring_status != 'scored'` and no row with a null score.

---

## Coverage

| AC | Test cases |
|---|---|
| N-1.1 | TC-F-01, TC-F-02, TC-F-03, TC-F-04, TC-F-23, TC-F-25 |
| N-1.2 | TC-F-05, TC-F-06, TC-F-07, TC-F-08, TC-F-09 |
| N-1.3 | TC-F-10, TC-F-11, TC-F-12, TC-F-13, TC-F-14, TC-F-15, TC-F-25, TC-F-55 |
| N-2.1 | TC-F-09, TC-F-16, TC-F-17, TC-F-18, TC-F-19, TC-F-20, TC-F-58, TC-F-60 |
| N-3.1 | TC-F-21, TC-F-22, TC-F-23, TC-F-24, TC-F-25, TC-F-54 |
| N-4.1 | TC-F-26 to TC-F-39, TC-F-50, TC-F-56, TC-F-57, TC-F-59, TC-F-60 |
| N-5.1 | TC-F-45, TC-F-46, TC-F-47 |
| S9-01 | TC-F-44 (route-level check; the app-wide owner is WS-A) |
| S9-09 | TC-F-47 |
| S9-12 | TC-F-04, TC-F-40 |
| S9-13 | TC-F-41, TC-F-58 |
| S9-14 | TC-F-42 |
| S9-15 | TC-F-21, TC-F-54 (stale), TC-F-44 (DB down) |
| S9-16 | TC-F-34, TC-F-36, TC-F-39 |
| S9-17 | TC-F-42 |
| S9-18 | TC-F-43 |
| P-3.1, P-5.1 | TC-F-25, TC-F-47 (news surface only; the owner is WS-D) |
| L-4.1 | TC-F-22 (stale command copy) |
| D-1.1, D-2.1, D-2.2, D-2.5, D-3.1 | TC-F-15, TC-F-20, TC-F-48 to TC-F-54, TC-F-59 (news routes; the owner is WS-A) |

Not covered here: N-6.1 (WS-M2) and S9-20 (WS-D).

## Ambiguities raised in this file

Global ambiguities cited above:
- AMB-02: fixture variants.
- AMB-03: the clock cookie.
- AMB-04: `finished_at` as the "updated" time.
- AMB-09: archive sort key, the date field, and whether skipped items appear at `min=0`.
- AMB-11: touch layouts.
- AMB-26: `tests/support/` ownership.
- AMB-27: `next start` project.

Resolved since the first draft, and no longer ambiguous: AMB-10 (the bookmark record shape), AMB-21 (date formats) and AMB-14/15.

| ID | Ambiguity | Status and interpretation |
|---|---|---|
| AMB-F1 | Service-role DB mutation helpers have no owner. | Now part of AMB-26: they belong in `tests/support/db.ts` (M0-owned). Until that M0 PR lands, WS-F keeps private copies in `tests/e2e/f/_support/`. |
| AMB-F2 | "Latest `digest_date` that has a successful or partial run": is it relative to server now, or simply the max in the DB? This matters only when the test clock is earlier than fixture rows. | Open. Assumed: the max `digest_date` ≤ today (Manila). The tests avoid depending on it by deleting later runs (TC-F-03, TC-F-24). |
| AMB-F3 | A tie on both score and `published_at` has no final tiebreak. | Open. Assumed: `id` ascending. Not asserted until decided. |
| AMB-F4 | New-tab and `rel` rules for news title links. | **Resolved:** DESIGN §4.12 (`_blank`, `noopener noreferrer`, "(opens in new tab)"). |
| AMB-F5 | How an item URL with a non-http(s) scheme renders. | Open. DESIGN says to render titles as text, but not what to do with the scheme. Assumed: a plain-text title with no link. |
| AMB-F6 | The order of items inside "Unscored (N)". | Open. Assumed `published_at` desc; not asserted. |
| AMB-F7 | With zero pending or failed items: hide the section, or show "Unscored (0)"? | Open. Assumed hidden. |
| AMB-F8 | Whether `min=0` is written to the URL. | **Resolved:** the GET form always serialises `min`, and the S9-13 link includes `&min=0` (DESIGN §6.5, §6.6). |
| AMB-F9 | Tag multi-select: OR or AND, and the parameter format. | Partly resolved: repeated `tag` params (DESIGN §6.6). OR vs AND is still open; OR is assumed. |
| AMB-F10 | Push vs replace for filter changes, and whether a change resets `page`. | **Resolved:** the GET form submit is a normal navigation, and submitting resets `page` (DESIGN §6.6). |
| AMB-F11 | Invalid params. | Partly resolved: an invalid `min` is treated as 0. For invalid `page`, dates and tags, ignoring them (defaults, never a 500) is assumed. |
| AMB-F12 | `page` beyond the last page, and `from > to`. | `from > to` is **resolved**: a field error and no date filtering (TC-F-56). An out-of-range `page` is open; the S9-16 empty state is assumed. |
| AMB-F13 | S9-12 "No runs ever" when runs exist but all are `failed`. | Open. Assumed to count as "No news yet". |
| AMB-F14 | The exact params of the S9-13 archive link. | **Resolved:** `/news/archive?from=<today>&to=<today>&min=0` (DESIGN §6.5). |
| AMB-F15 | A hook to force loading and error states. | Moved to README §4 hook 5 (`fm_test_delay`, `fm_test_fail`). |
| AMB-F16 | Whether unscored items can be bookmarked. | **Resolved:** the unscored variant keeps the bookmark (DESIGN §4.12). |
| AMB-F17 | Auto-apply vs an Apply button, the focus target, and a count announcement. | **Resolved** for filters: an Apply button, focus on the h2 "Results", and a plain-text count with no live region (DESIGN §6.6). The focus target after a pagination link is still open; the test only asserts it is not `body`. |
| AMB-F18 | The CommandLine label for `npm run news:run` in the stale notice and the no-runs EmptyState is not named in DESIGN. The labels on offer are "Setup", "Verify", "Prompt" and "Terminal". | Assumed "Terminal", so the button is "Copy code: Terminal". The tests match `/^Copy code: /` scoped to the notice or region. |
| AMB-F19 | The PRD N-1.3 label is "Why it matters for First Mate"; DESIGN §4.12 uses the eyebrow "Why it matters". DESIGN §8 row 9 says PRD strings ship, but this label isn't in DESIGN §7's canonical list. | Tests assert DESIGN's "Why it matters" (coordinator decision). If the PRD label is required, it goes in an sr-only suffix or the eyebrow text. |
| AMB-F20 | Unscored and archive card behavior before hydration: DESIGN says bookmark buttons render `aria-disabled` until mount. | Asserted in TC-F-47; no other pre-hydration differences are assumed. |
