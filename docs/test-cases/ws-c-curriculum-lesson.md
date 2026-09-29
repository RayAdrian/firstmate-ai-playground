# WS-C test cases: curriculum and lesson UI

Scope: `/curriculum`, `/lessons/[slug]`, `/exercises`, and the lesson and exercise components (PRD C-1–C-5, L-1–L-8, E-1–E-3, E-5; §9 curriculum and lesson states).
Owner paths: `src/app/curriculum/`, `src/app/lessons/`, `src/app/exercises/`, `src/components/lesson/`, `src/components/exercise/`. Tests: `tests/unit/c/`, `tests/e2e/c/`.
Contract: [README.md](README.md) (case format, `fx-base`, `ls-*` fixtures, test hooks, AMB-nn). **Selectors and copy follow [DESIGN.md §11](../design/DESIGN.md#11-selector-contract) exactly**, and behavior follows DESIGN §4–§7. Unless stated, e2e cases run on `fx-base` with `fm_test_now=2026-09-30T13:00:00+08:00` and a fresh browser context with `ls-empty`.

**Locator rules used throughout.**
- A lesson page has **two tablists**: `getByRole('tablist', { name: 'Tool' })` and `getByRole('tablist', { name: 'Starting prompt' })`. Tabs and tabpanels are always scoped: `toolTabs = page.getByRole('tablist', { name: 'Tool' })`, `toolTabs.getByRole('tab', { name: 'Codex CLI' })`. The visible lesson panel is `page.locator('#' + await toolTab.getAttribute('aria-controls'))`. The exercise tabs are scoped to `exercise = page.getByRole('region', { name: /^Exercise/ })`.
- Announcements are read from `page.locator('#fm-live')`, never from a bare `getByRole('status')`.
- "Hydrated" means `page.getByTestId('progress-placeholder')` has count 0 and `getByRole('progressbar', { name: 'Level 1' })` is visible (on lessons: the "Mark complete" button is enabled).

**Fixture code blocks (WS-B must seed these exact bodies in `l1-first-session`'s concept section; cases assert them byte for byte):**

| Block | Fence | Exact body (no trailing newline) | Label / copy button |
|---|---|---|---|
| `blk-bash` | ```` ```bash ```` | `npm i -g @anthropic-ai/claude-code`⏎`claude --version` | figcaption "bash", button "Copy code: bash" |
| `blk-json` | ```` ```json title="settings.json" ```` | `{ "permissions": { "allow": ["Bash(npm test)"] } }` | "settings.json", "Copy code: settings.json" |
| `blk-plain` | ```` ``` ```` (no language) | `echo "plain block"` followed by a line of 300 `x` characters (forces horizontal overflow at 360px) | "text", "Copy code: text" |

---

## Suite 1: Curriculum page structure (C-1, C-3)

### TC-C-01: Curriculum lists fixture levels in order with title and summary
- **ACs:** C-1.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-empty`
- **Steps:**
  1. Go to `/curriculum`.
  2. Collect `getByRole('region', { name: /^Level \d/ })` in DOM order.
  3. In each region, read the `h2` and the summary text.
- **Expected:** `getByRole('heading', { level: 1, name: 'Curriculum' })` is present. There are exactly 2 regions, in this order: accessible name "Level 1 Foundations" (h2 "Foundations", text "One-line summary A"), then "Level 2 Context engineering" (h2 "Context engineering", text "One-line summary B").
- **Notes:** 5-level exactness is TC-C-02 (AMB-01). The region name is eyebrow + h2 via `aria-labelledby` (DESIGN §6.2).

### TC-C-02: Five levels render in numeric order L1–L5 regardless of input order
- **ACs:** C-1.1
- **Level:** unit
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-curriculum-5`, passed to the curriculum list component with the levels shuffled (`[3,1,5,2,4]`) and the L3 lessons shuffled by `sort` (`[3,1,4,2]`).
- **Steps:**
  1. Render the component with `ls-empty` progress.
  2. Read the regions `/^Level \d/` in DOM order, then the L3 lesson link names in DOM order.
- **Expected:** Regions are named Level 1, 2, 3, 4, 5, in that order. The L3 lessons appear in `sort` order 1, 2, 3, 4.
- **Notes:** AMB-01.

### TC-C-03: Lessons within a level follow `sort`, not title or insertion order
- **ACs:** C-1.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. Go to `/curriculum`.
  2. Inside the Level 1 region, read the link names of the lesson rows in order. Repeat for Level 2.
- **Expected:** Level 1: the `l1-first-session` title, then the `l1-permissions` title. Level 2: the `l2-context-files` title, then the `l2-memory` title. No other lesson rows. Each row link's accessible name is exactly the lesson title; the "1.1"-style number prefix is outside the link (DESIGN §6.2).

### TC-C-04: Lesson row shows title, objective, minutes and no badge when not started
- **ACs:** C-1.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-empty`
- **Steps:**
  1. Go to `/curriculum` and wait for hydration.
  2. Locate the `listitem` containing `getByRole('link', { name: <l1-first-session title> })`.
- **Expected:**
  - The row contains the title link (`href="/lessons/l1-first-session"`), the fixture objective text and "20 min".
  - The row has **no** "Completed" badge. The text "Not started" appears nowhere on the page, in any case (DESIGN §6.2: absence is the state; the literal is banned from the DOM).

### TC-C-05: Completed state comes from localStorage
- **ACs:** C-1.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `seedProgress(page, ls-one-complete)`
- **Steps:**
  1. Go to `/curriculum` and wait for hydration.
  2. Read the `l1-first-session` and `l1-permissions` rows.
- **Expected:** The `l1-first-session` row contains the badge text "Completed". The `l1-permissions` row contains no "Completed" text. The state is carried by text, not by colour alone.

### TC-C-06: Archived lesson never appears on the curriculum
- **ACs:** C-1.3
- **Level:** e2e
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** `fx-base` (contains archived `l2-retired`)
- **Steps:**
  1. Go to `/curriculum`.
  2. Search the page for any link with `href="/lessons/l2-retired"` and for the `l2-retired` title text.
- **Expected:** Zero matches. The Level 2 region has exactly 2 lesson row links.

### TC-C-07: Archived lesson excluded even when it is marked complete in storage
- **ACs:** C-1.3, C-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; `seedProgress` with `createEmptyProgress()` plus `lessons: { "l2-retired": { completedAt: "2026-09-01T00:00:00.000Z" } }`
- **Steps:**
  1. Go to `/curriculum` and wait for hydration.
  2. Read `getByRole('progressbar', { name: 'Level 2' })` and the "n / m" text beside it.
- **Expected:** No `l2-retired` row. The text reads "0 / 2" and `aria-valuenow="0"`: archived completions are not counted. No console errors.

### TC-C-08: Every active lesson is reachable in one click, none locked
- **ACs:** C-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-empty`
- **Steps:**
  1. For each slug in `[l1-first-session, l1-permissions, l2-context-files, l2-memory]`: go to `/curriculum`, then click `getByRole('link', { name: <title> })` once.
- **Expected:**
  - Each click lands on `/lessons/<slug>` with HTTP 200 and `getByRole('heading', { level: 1, name: <title> })`.
  - No row link has `aria-disabled="true"`, and no lock icon or "Locked" text exists on `/curriculum`.
  - L2 lessons are reachable with no L1 progress. Row links work before hydration (DESIGN §6.2).

## Suite 2: Level progress (C-2)

### TC-C-09: Level progress "2 / 4" with `aria-valuenow=50`
- **ACs:** C-2.1
- **Level:** unit
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-curriculum-5`; progress with 2 of the 4 L3 lesson slugs completed; component rendered after mount.
- **Steps:**
  1. Render the curriculum component.
  2. Query `getByRole('progressbar', { name: 'Level 3' })` (exact name) and the L3 count text.
- **Expected:** The count text is "2 / 4". The progressbar has `aria-valuenow="50"`, `aria-valuemin="0"`, `aria-valuemax="100"` and `aria-valuetext="2 of 4 lessons complete"` (DESIGN §4.7).
- **Notes:** AMB-01. The e2e analogue is TC-C-10.

### TC-C-10: Level progress updates in the fixture (1 / 2)
- **ACs:** C-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-one-complete`
- **Steps:**
  1. Go to `/curriculum` and wait for hydration.
  2. Read the "Level 1" and "Level 2" progressbars and their count text.
- **Expected:** Level 1: "1 / 2", `aria-valuenow="50"`. Level 2: "0 / 2", `aria-valuenow="0"`. Neither level shows the "Completed" level badge.

### TC-C-11: Boundary progress values 0 / 4 and 4 / 4
- **ACs:** C-2.1
- **Level:** unit
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-curriculum-5`
- **Steps:**
  1. Render with no L3 completions and read L3.
  2. Render with all 4 L3 lessons complete and read L3.
- **Expected:**
  - Step 1: "0 / 4", `aria-valuenow="0"`.
  - Step 2: "4 / 4", `aria-valuenow="100"`, and the level shows a success badge "Completed" (DESIGN §6.2).

### TC-C-12: Non-integer percentage rounding (1 / 3)
- **ACs:** C-2.1
- **Level:** unit
- **Priority:** P1
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-curriculum-5` modified so L4 has 3 lessons, 1 of them complete.
- **Steps:**
  1. Render and read the "Level 4" progressbar.
- **Expected:** The count text is "1 / 3". `aria-valuenow` is the integer `33` and `aria-valuetext="1 of 3 lessons complete"`.
- **Notes:** AMB-C1 (integer or decimal `aria-valuenow`).

### TC-C-13: Level with zero active lessons
- **ACs:** C-2.1
- **Level:** unit
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-curriculum-5` with all of L5's lessons archived (filtered out).
- **Steps:**
  1. Render and read the L5 section.
- **Expected:** The count text is "0 / 0" and the "Level 5" progressbar has `aria-valuenow="0"`. No `NaN`, no thrown error, no console error (DESIGN §4.7 edge rule).

### TC-C-14: Completions of unknown slugs do not inflate counts
- **ACs:** C-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`, `ls-orphans` plus `lessons["l1-first-session"] = { completedAt: "2026-09-29T01:00:00.000Z" }`
- **Steps:**
  1. Go to `/curriculum` and wait for hydration.
- **Expected:** Level 1 reads "1 / 2", not "2 / 2". There is no row for `deleted-lesson-slug` and no console error. (Keeping the orphan in storage is WS-D, P-4.1.)

## Suite 3: Verified badges (C-5)

### TC-C-15: Verified line on curriculum row and lesson header
- **ACs:** C-5.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; viewport 1440×900.
- **Steps:**
  1. Go to `/curriculum` and read the meta line of the `l1-first-session` row.
  2. Go to `/lessons/l1-first-session` and read the header meta line (between the objective and the "Concept" h2).
- **Expected:**
  - The row meta reads exactly "20 min · Verified 20 Sep 2026 · Claude Code v2.1.0 / Codex v0.40.0" (DESIGN §6.2 format).
  - The lesson header contains "Verified 20 Sep 2026" and the tool versions "2.1.0" and "0.40.0".
  - Each date is inside `<time datetime="2026-09-20">`.
- **Notes:** At 360 the meta may abbreviate the tool names to "CC" / "Codex" (DESIGN §7). AMB-C15 covers the header wireframe's "CC v2.3 / Cx v0.9" at 1440.

### TC-C-16: 61 days old shows "May be outdated"
- **ACs:** C-5.2
- **Level:** e2e
- **Priority:** P1
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base`; `fm_test_now=2026-09-30T13:00:00+08:00`; `l1-permissions` verified 2026-07-31.
- **Steps:**
  1. Go to `/curriculum` and inspect the `l1-permissions` row.
  2. Go to `/lessons/l1-permissions` and inspect the header.
- **Expected:** Both show the badge text "May be outdated", and the badge has a non-empty `title` attribute. The meta line still shows the actual date "31 Jul 2026" (DESIGN §6.2).

### TC-C-17: Exactly 60 days old shows no badge
- **ACs:** C-5.2
- **Level:** e2e
- **Priority:** P1
- **Category:** Boundary
- **Preconditions / fixtures:** As TC-C-16; `l2-context-files` verified 2026-08-01.
- **Steps:**
  1. Inspect the `l2-context-files` row and its lesson header.
- **Expected:** No "May be outdated" text anywhere in the row or the header.

### TC-C-18: Badge boundary follows the Manila server clock, not the browser time zone
- **ACs:** C-5.2
- **Level:** e2e
- **Priority:** P1
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base`; `fm_test_now=2026-09-29T23:30:00+08:00` (60 days after 2026-07-31 in Manila; still 2026-09-29 15:30 UTC); browser context `timezoneId: 'America/Los_Angeles'`.
- **Steps:**
  1. Go to `/curriculum` and inspect `l1-permissions`.
  2. Change the cookie to `fm_test_now=2026-09-30T00:30:00+08:00` (2026-09-29 16:30 UTC) and reload.
- **Expected:**
  - Step 1: no badge (60 days).
  - Step 2: the badge "May be outdated" appears (61 days in Manila, although the UTC date is still 29 Sep).
  - No hydration warning in either step (`collectConsole`).
- **Notes:** DESIGN §7 fixes Asia/Manila for dates. AMB-C3 covers calendar-day counting.

## Suite 4: Lesson layout (L-1)

### TC-C-19: Lesson sections render in the required order
- **ACs:** L-1.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. Go to `/lessons/l1-first-session`.
  2. Compare the DOM order (`compareDocumentPosition`) of:
     - `getByRole('heading', { level: 1 })`
     - `getByRole('heading', { level: 2, name: 'Concept' })`
     - `getByRole('heading', { level: 2, name: 'In your tool' })`
     - `getByRole('tablist', { name: 'Tool' })`
     - `getByRole('region', { name: 'Key differences' })`
     - `getByRole('region', { name: /^Exercise/ })`
     - `getByRole('button', { name: 'Mark complete' })`
     - `getByRole('navigation', { name: 'Lesson' })`
- **Expected:**
  - The DOM order is exactly the order listed.
  - The header (before "Concept") contains the title, the objective, "20 min", the verified line and `getByRole('button', { name: 'Bookmark' })`.
  - The h2 set is exactly "Concept", "In your tool", "Key differences", "Exercise" (DESIGN §11.3).

### TC-C-20: Lesson without an exercise omits the panel but keeps order
- **ACs:** L-1.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; `l1-permissions` has no exercise row.
- **Steps:**
  1. Go to `/lessons/l1-permissions`.
- **Expected:** There is no region `/^Exercise/`, no h2 "Exercise" and no empty placeholder box. The order header → Concept → tabs → Key differences → Mark complete → navigation "Lesson" holds.
- **Notes:** AMB-25 / AMB-C4: real content always has an exercise; this state exists only in the fixture.

## Suite 5: Tool tabs (L-2)

### TC-C-21: Tabs ARIA structure
- **ACs:** L-2.1, D-1.2
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`, `ls-empty`
- **Steps:**
  1. Go to `/lessons/l1-first-session`.
  2. Inspect `toolTabs = getByRole('tablist', { name: 'Tool' })`, both tabs inside it and their controlled panels.
- **Expected:**
  - There are exactly 2 tabs inside `toolTabs`, named "Claude Code" and "Codex CLI"; each contains an `svg[aria-hidden="true"]` icon plus the text.
  - "Claude Code" has `aria-selected="true"` and `tabindex="0"`; "Codex CLI" has `aria-selected="false"` and `tabindex="-1"`.
  - Each tab's `id` follows `tab-{scope}-{tool}` and its `aria-controls` equals its panel's `id` (`panel-{scope}-{tool}`).
  - Each panel has `role=tabpanel`, `aria-labelledby` = its tab id (so it is named "Claude Code" / "Codex CLI") and `tabindex="0"`. The inactive panel has the `hidden` attribute.
  - Both panels are present in the server HTML (`request.get`), so switching needs no fetch.
  - All ids on the page are unique, including the "Starting prompt" tablist's.

### TC-C-22: Arrow keys move focus, select and wrap (automatic activation)
- **ACs:** L-2.1, L-2.2
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** As TC-C-21
- **Steps:**
  1. Focus `toolTabs.getByRole('tab', { name: 'Claude Code' })`.
  2. Press ArrowRight.
  3. Press ArrowRight.
  4. Press ArrowLeft.
  5. Press ArrowLeft.
- **Expected:**
  - After step 2 "Codex CLI" is focused, after step 3 focus wraps to "Claude Code", after step 4 it wraps to "Codex CLI", and after step 5 it is on "Claude Code".
  - After each press, the focused tab has `aria-selected="true"` and `tabindex="0"`, and the other tab has `-1`.
  - The visible panel matches the focused tab, and the URL `tool` param matches (`codex`, `claude`, `codex`, `claude`).
- **Notes:** Automatic activation per DESIGN §4.4 (AMB-C5 resolved). The primitive-level check is `tests/unit/m0/tabs.test.tsx`.

### TC-C-23: Home and End keys
- **ACs:** L-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** As TC-C-21
- **Steps:**
  1. Focus "Claude Code" in `toolTabs` and press End.
  2. Press Home.
- **Expected:** After step 1 "Codex CLI" is focused and selected. After step 2 "Claude Code" is focused and selected. `toolTabs.boundingBox().y` changes by at most 50px across both steps.

### TC-C-24: Only the active tab is in the tab order; Tab moves into the panel
- **ACs:** L-2.1, D-2.2
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** As TC-C-21
- **Steps:**
  1. Focus "Claude Code" in `toolTabs`, press Shift+Tab and record the focused element (E0).
  2. Press Tab once.
  3. Press Tab again.
  4. Press Shift+Tab twice.
- **Expected:**
  - Step 2 focuses "Claude Code", never "Codex CLI".
  - Step 3 focuses the visible tabpanel itself (`tabindex="0"`), not "Codex CLI".
  - Step 4 returns focus to E0.
  - The focused tab shows the global focus ring (ring metrics are WS-A).

### TC-C-25: `?tool=codex` opens the Codex tab, server-rendered
- **ACs:** L-2.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-empty`
- **Steps:**
  1. `request.get('/lessons/l1-first-session?tool=codex')` and inspect the HTML.
  2. Go to the same URL in the browser.
- **Expected:**
  - Step 1: the server HTML already has `aria-selected="true"` on the Codex CLI tab, and the Claude panel has `hidden` (DESIGN §4.4 step 1).
  - Step 2: "Codex CLI" is selected and the visible panel shows the Codex body. There is no Claude-then-Codex flash, and `prefs.tool` is not written (`readProgress(page)` returns `null`, or `prefs.tool === "claude"`).

### TC-C-26: Clicking a tab writes `?tool=` with replaceState, without reload or history entries
- **ACs:** L-2.2, L-2.4
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-empty`
- **Steps:**
  1. Go to `/curriculum`, then click the `l1-first-session` link. Go to `/lessons/l1-first-session#tools` and run `window.__noReload = 'marker'`. Record `history.length`.
  2. Click "Codex CLI" in `toolTabs`.
  3. Click "Claude Code".
  4. Call `page.goBack()`.
- **Expected:**
  - After step 2 the URL is `/lessons/l1-first-session?tool=codex#tools`; after step 3 it is `?tool=claude#tools` (hash kept, DESIGN §4.4 step 4).
  - `window.__noReload === 'marker'` after every step, and no document request for the lesson route is logged by `page.on('request')`.
  - `history.length` is unchanged after steps 2 and 3.
  - Step 4 leaves the lesson and does not toggle tabs.

### TC-C-27: Tab switch keeps content above the tabs in place (≤ 50px)
- **ACs:** L-2.4
- **Level:** e2e
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base`; two runs, at 1440×900 and at 360×800.
- **Steps:**
  1. Go to `/lessons/l1-first-session`. Scroll so the top of `toolTabs` is 100px from the viewport top. Record `scrollY` and `toolTabs.boundingBox().y`.
  2. Click "Codex CLI" in `toolTabs`, wait one animation frame and record both values.
  3. Click "Claude Code" and record both values.
- **Expected:** At both widths and after both switches, `|Δ scrollY| <= 50` and `|Δ tablist y| <= 50`. Content below the tabs may move; content above it does not (DESIGN §4.4 step 5).

### TC-C-28: No `?tool` uses `prefs.tool` after mount, default Claude Code
- **ACs:** L-2.3, P-5.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; `collectConsole(page)`
- **Steps:**
  1. With `ls-empty`, go to `/lessons/l1-first-session`.
  2. In a new context with `ls-codex-pref`, `request.get` the same URL and inspect the HTML. Then go to it in the browser.
- **Expected:**
  - Step 1: Claude Code is selected and the URL has no `tool` param.
  - Step 2: the server HTML selects Claude Code (the server never reads prefs). After mount, Codex CLI is selected and the URL becomes `?tool=codex` through `replaceState`: `history.length` is unchanged and there is no reload.
  - No hydration warnings in either step (DESIGN §4.4 step 2).

### TC-C-29: Choosing a tab persists as `prefs.tool` across lessons
- **ACs:** L-2.3
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-empty`
- **Steps:**
  1. Go to `/lessons/l1-first-session` and click "Codex CLI" in `toolTabs`.
  2. `readProgress(page)`.
  3. Go to `/lessons/l2-context-files` (no param).
- **Expected:** Step 2: `prefs.tool === "codex"`. Step 3: Codex CLI is selected after mount, and the URL is `?tool=codex`.

### TC-C-30: URL param overrides the pref and does not overwrite it
- **ACs:** L-2.2, L-2.3
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`, `ls-codex-pref`
- **Steps:**
  1. Go to `/lessons/l1-first-session?tool=claude`.
  2. `readProgress(page)`.
  3. Go to `/lessons/l2-context-files?tool=codex`, then click "Claude Code" in `toolTabs`, then `readProgress(page)`.
- **Expected:**
  - Step 1: Claude Code is selected and the URL still reads `?tool=claude`.
  - Step 2: `prefs.tool === "codex"`, unchanged (DESIGN §4.4 step 3, §8 row 2).
  - Step 3: an explicit click writes `prefs.tool === "claude"`.

### TC-C-31: Invalid `?tool` values render Claude Code
- **ACs:** L-2.2, L-2.3
- **Level:** e2e
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** `fx-base`, `ls-empty`
- **Steps:**
  1. Visit each of: `?tool=cursor`, `?tool=`, `?tool=CODEX`, `?tool=%3Cscript%3E`, `?tool=codex&tool=claude`.
- **Expected:**
  - Every URL returns HTTP 200 with exactly one selected tab and no console errors. The raw param value is never echoed into the DOM.
  - The first four render Claude Code on the server (DESIGN §4.4 step 1: anything other than `claude` or `codex` renders Claude Code).
- **Notes:** The repeated param is AMB-C16. `CODEX` is resolved by DESIGN (not a valid value).

## Suite 6: Differences and no-native-equivalent (L-3)

### TC-C-32: Key differences callout outside tabs, visible in both tab states
- **ACs:** L-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. Go to `/lessons/l1-first-session`.
  2. Locate `diff = getByRole('region', { name: 'Key differences' })` and assert that it is not a descendant of any `[role=tabpanel]`.
  3. Count `diff.getByRole('listitem')`. Switch to Codex CLI, then re-check visibility and the count.
- **Expected:**
  - The region is a `section`, not an `aside` (it is not `complementary`), and contains `getByRole('heading', { level: 2, name: 'Key differences' })`.
  - It is visible in both tab states, sits outside every tabpanel and after the tablist in DOM order.
  - It has 3 list items matching the fixture `differences`, in order.

### TC-C-33: Differences count boundaries 1 and 5
- **ACs:** L-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. On `/lessons/l1-permissions`, count the list items in the "Key differences" region.
  2. Do the same on `/lessons/l2-context-files`.
- **Expected:** 1 and 5 respectively. The seed rejects 0 and 6 (WS-B).

### TC-C-34: Differences render as plain text
- **ACs:** L-3.1, L-7.1
- **Level:** unit
- **Priority:** P0
- **Category:** Security
- **Preconditions / fixtures:** Callout component with `differences = ["<b>x</b>", "a & b"]`.
- **Steps:**
  1. Render, then read `textContent` and query for `b` elements.
- **Expected:** The text is literally `<b>x</b>` and `a & b`. No `b` element is created.

### TC-C-35: Codex tab shows the no-native-equivalent notice with the workaround
- **ACs:** L-3.2, S9-08
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; `l1-permissions` has `codex_no_equivalent=true`, `codex_workaround_md="Use a sandbox profile."`, `tool_versions.codex_cli="0.40.0"`.
- **Steps:**
  1. Go to `/lessons/l1-permissions?tool=codex`.
  2. In the visible Codex panel (via `aria-controls`), read the notice, the `h4` and the prose.
- **Expected:**
  - The panel contains the notice title "No native equivalent in Codex CLI (as of v0.40.0)". The notice is server-rendered, so it has no `alert` or `status` role.
  - Next come `getByRole('heading', { level: 4, name: 'Closest workaround' })` and the text "Use a sandbox profile.", in that DOM order.
  - The panel's `textContent.trim()` is not empty. The Codex tab stays present and selectable, never removed or disabled.
- **Notes:** DESIGN §4.4 "States" resolves AMB-C8 (the full tool name "Codex CLI").

### TC-C-36: No-equivalent notice is symmetric and text-based
- **ACs:** L-3.2, D-1.2
- **Level:** unit
- **Priority:** P1
- **Category:** A11y
- **Preconditions / fixtures:** Tab panel component with `claude_no_equivalent: true`, `claude_workaround_md: "W"`, `tool_versions.claude_code: "2.1.0"`.
- **Steps:**
  1. Render the Claude panel and read its accessible text.
- **Expected:** The text is "No native equivalent in Claude Code (as of v2.1.0)", then the h4 "Closest workaround", then "W". The notice icon is `aria-hidden`, so the meaning is carried by text.

## Suite 7: Code blocks in lessons (L-4)

### TC-C-37: Every fenced block has a labelled figure and a copy button
- **ACs:** L-4.1, L-4.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. Go to `/lessons/l1-first-session`.
  2. Count the `figure` elements in the concept section, then count `getByRole('button', { name: /^Copy code: / })` inside them.
- **Expected:**
  - The concept has 3 figures, named "bash", "settings.json" and "text" (by their `figcaption`).
  - Their copy buttons are named "Copy code: bash", "Copy code: settings.json" and "Copy code: text".
  - Each figure's `pre` has `tabindex="0"` and `aria-label` "Code: bash", "Code: settings.json" and "Code: text" respectively.
  - Every `pre` on the page sits inside such a figure with exactly one copy button.

### TC-C-38: Copy writes exact block text and announces "Copied"
- **ACs:** L-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; Chromium context with `permissions: ['clipboard-read','clipboard-write']`.
- **Steps:**
  1. Go to `/lessons/l1-first-session`.
  2. Click `getByRole('button', { name: 'Copy code: bash' })`.
  3. Read `await page.evaluate(() => navigator.clipboard.readText())`.
  4. Read `page.locator('#fm-live')` and the focused element's accessible name.
  5. Wait 2.1s and re-read the button name.
- **Expected:**
  - The clipboard equals exactly `npm i -g @anthropic-ai/claude-code\nclaude --version`: the fence source text with the final newline trimmed, and no `$` prompt or highlighting markup.
  - `#fm-live` has the text "Copied".
  - Within 2s the focused element is the same button, now named "Copied". After 2s it is named "Copy code: bash" again.

### TC-C-39: Copy of the filename-labelled JSON block is exact
- **ACs:** L-4.1, L-4.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** As TC-C-38
- **Steps:**
  1. Click `getByRole('button', { name: 'Copy code: settings.json' })` and read the clipboard.
- **Expected:** The clipboard equals `{ "permissions": { "allow": ["Bash(npm test)"] } }` exactly. Quotes are not HTML-escaped and the label "settings.json" is not included.

### TC-C-40: Blocks are labelled and server-highlighted
- **ACs:** L-4.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. `request.get('/lessons/l1-first-session')` and inspect the `blk-bash` and `blk-json` markup.
  2. Go to the page and read each block's `figcaption`.
- **Expected:**
  - The captions are "bash", "settings.json" and "text".
  - The server HTML of `blk-bash` and `blk-json` already contains more than one token `span` with an inline colour style (Shiki on the server, DESIGN §4.5), and there is no client-side highlighter script.
  - `blk-plain` renders and copies.
- **Notes:** DESIGN §4.5 resolves AMB-C9 (the label "text").

### TC-C-41: Clipboard denied falls back to selection and hint
- **ACs:** L-4.1, S9-21
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `fx-base`; an init script overriding `navigator.clipboard.writeText = () => Promise.reject(new DOMException('denied','NotAllowedError'))`. Read the modifier label from `navigator.platform` (on Mac it is "⌘C", otherwise "Ctrl+C").
- **Steps:**
  1. Click `getByRole('button', { name: 'Copy code: bash' })`.
  2. Read `window.getSelection().toString()`, `document.activeElement`, the hint inside the `blk-bash` figure and `#fm-live`.
- **Expected:**
  - The selection equals the exact `blk-bash` text, and the focused element is that block's `pre`.
  - The figure contains the text "Press ⌘C to copy" (or "Press Ctrl+C to copy").
  - `#fm-live` reads "Copy blocked. Code selected. Press ⌘C to copy." (or "…Ctrl+C…").
  - The button is still named "Copy code: bash", not "Copied" or "Failed". There is no `pageerror`.
- **Notes:** Primitive-level behavior (hint timeout of 8s) is WS-A; this is the lesson integration.

## Suite 8: Mark complete (L-5)

### TC-C-42: Mark complete writes an ISO timestamp and swaps the control
- **ACs:** L-5.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-empty`
- **Steps:**
  1. Go to `/lessons/l1-first-session`, wait for hydration, then click `getByRole('button', { name: 'Mark complete' })`.
  2. `readProgress(page)`.
  3. Read the control area, the focused element and `#fm-live`.
- **Expected:**
  - `lessons["l1-first-session"].completedAt` passes `progressStateSchema`: an ISO datetime matching `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})$/`, with `Date.parse` within 5s of now.
  - `getByText('Completed ✓ · Undo')` is visible. `getByRole('button', { name: 'Undo' })` exists and is focused. There is no button whose name matches `/Completed/`.
  - `#fm-live` reads "Lesson marked complete". The header shows the success badge "Completed".

### TC-C-43: Curriculum reflects completion without a reload
- **ACs:** L-5.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-empty`
- **Steps:**
  1. Open a second page of the same context on `/curriculum` (page B).
  2. On page A, go to `/lessons/l1-first-session` and set `window.__spa='1'`.
  3. Click "Mark complete".
  4. Click the breadcrumb link "Curriculum" inside `getByRole('navigation', { name: 'Breadcrumb' })` (client navigation).
  5. Observe page B without reloading.
- **Expected:**
  - Step 4: `window.__spa === '1'`, and the Level 1 count is "1 / 2" with the row badge "Completed".
  - Step 5: page B updates to "1 / 2" through the `storage` event.
- **Notes:** The cross-tab part is AMB-C10. If the decision is "same tab only", step 5 becomes P1.

### TC-C-44: Undo removes the entry
- **ACs:** L-5.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-one-complete`
- **Steps:**
  1. Go to `/lessons/l1-first-session` and confirm `getByText('Completed ✓ · Undo')`.
  2. Click `getByRole('button', { name: 'Undo' })`, then `readProgress(page)`.
  3. Reload.
- **Expected:**
  - Step 2: `"l1-first-session" in lessons === false` (the key is deleted, not set to null). `getByRole('button', { name: 'Mark complete' })` is back and focused. `#fm-live` reads "Marked not complete".
  - Step 3: the button still reads "Mark complete".

### TC-C-45: Double-click does not create inconsistent state
- **ACs:** L-5.1, L-5.2
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`, `ls-empty`
- **Steps:**
  1. `dblclick` the "Mark complete" button.
- **Expected:** The final state is exactly one of: completed (entry present, "Completed ✓ · Undo" visible) or not completed (entry absent, "Mark complete"). The UI and storage agree, and there are no console errors.

## Suite 9: Previous/next (L-6)

### TC-C-46: First lesson has no Previous; Next goes to sort 2
- **ACs:** L-6.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. Go to `/lessons/l1-first-session` and inspect `nav = getByRole('navigation', { name: 'Lesson' })`.
- **Expected:** `nav.getByRole('link', { name: /^Previous: / })` has count 0. `nav.getByRole('link', { name: /^Next: / })` has `href="/lessons/l1-permissions"`, and its name contains the `l1-permissions` title.

### TC-C-47: Last lesson of L1 links Next to the first lesson of L2
- **ACs:** L-6.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. Go to `/lessons/l1-permissions`.
  2. Go to `/lessons/l2-context-files`.
- **Expected:**
  - Step 1: `/^Next: /` has `href="/lessons/l2-context-files"`, and `/^Previous: /` has `href="/lessons/l1-first-session"`.
  - Step 2: `/^Previous: /` has `href="/lessons/l1-permissions"` (it crosses back to L1).

### TC-C-48: Last lesson of the last level shows "Back to curriculum"; archived is never Next
- **ACs:** L-6.1, C-1.3
- **Level:** e2e
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base`. `l2-memory` (sort 2) is the last active lesson; the archived `l2-retired` is sort 3.
- **Steps:**
  1. Go to `/lessons/l2-memory` and inspect `getByRole('navigation', { name: 'Lesson' })`.
- **Expected:** There is no `/^Next: /` link. `getByRole('link', { name: 'Back to curriculum' })` has `href="/curriculum"` (any arrow icon is `aria-hidden`, so the name is exact). No link to `/lessons/l2-retired` exists anywhere on the page.
- **Notes:** The PRD says "L5's last lesson", but the fixture's last level is L2 (AMB-01). TC-C-49 covers L5 as a unit test.

### TC-C-49: Prev/next computation across 5 levels
- **ACs:** L-6.1
- **Level:** unit
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-curriculum-5`, passed to the pure prev/next helper.
- **Steps:**
  1. Compute prev/next for the last lesson of each of L1–L4, the last lesson of L5 and the first lesson of L1.
- **Expected:**
  - For n = 1..4, the last lesson of Ln leads to the first lesson of Ln+1.
  - The last lesson of L5 returns `{ kind: 'back-to-curriculum' }`.
  - The first lesson of L1 has no previous.
  - Archived lessons are skipped.

## Suite 10: Safe markdown (L-7)

### TC-C-50: Raw HTML in the lesson body renders as escaped text
- **ACs:** L-7.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Security
- **Preconditions / fixtures:** `fx-base` (the `l2-memory` concept contains `<script>window.__xss=1</script>` and `<img src=x onerror="window.__xss=2">`)
- **Steps:**
  1. Register `page.on('dialog')` and `page.on('pageerror')`.
  2. Go to `/lessons/l2-memory` and wait 1s after load.
  3. Evaluate `window.__xss`, then count the `script` elements inside `main` and the `img[src="x"]` elements in the document.
  4. `getByText('<script>window.__xss=1</script>')`.
- **Expected:** `window.__xss` is `undefined`. There is no `script` inside `main` and no `img` with `src="x"`. The literal text `<script>window.__xss=1</script>` is visible. No dialog opens.

### TC-C-51: Markdown sanitisation unit matrix
- **ACs:** L-7.1, L-7.2
- **Level:** unit
- **Priority:** P0
- **Category:** Security
- **Preconditions / fixtures:** The markdown render function (react-markdown + rehype-sanitize), with these inputs:
  - `<iframe src="https://evil">`
  - `<a href="x" onclick="y">t</a>`
  - `[t](javascript:alert(1))`
  - `[t](JAVASCRIPT:alert(1))`
  - `[t](data:text/html,<b>)`
  - `![i](javascript:alert(1))`
  - `<svg onload=alert(1)>`
  - `<style>body{display:none}</style>`
  - `# Heading in body`
- **Steps:**
  1. Render each input and inspect the output DOM.
- **Expected:**
  - The output contains no `iframe`, `svg` or `style` element and no `on*` attribute.
  - Raw-HTML inputs appear as text.
  - `javascript:` and `data:` links render as plain text, or as an `a` without `href` (not clickable). Images with such a `src` are not rendered.
  - Markdown `#` headings are shifted to start at `h3` (DESIGN §6.3).

### TC-C-52: External links open in a new tab with safe rel and an sr hint; internal links do not
- **ACs:** L-7.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Security
- **Preconditions / fixtures:** `fx-base` (the `l1-first-session` concept links to `https://docs.anthropic.com/` and `/lessons/l1-permissions`)
- **Steps:**
  1. Go to `/lessons/l1-first-session` and inspect both links.
  2. Click the external link while listening with `context.waitForEvent('page')`.
- **Expected:**
  - External link: `target="_blank"`; `rel` contains both `noopener` and `noreferrer`; the accessible name ends with "(opens in new tab)"; it has an `aria-hidden` ↗ icon.
  - Clicking opens a new page, the original URL is unchanged, and `newPage.evaluate(() => window.opener)` is `null`.
  - Internal link: no `target`, no "(opens in new tab)" text; it opens in the same tab.
- **Notes:** Resolved by DESIGN §6.3 "Markdown" (was AMB-C11).

## Suite 11: Bookmark toggle (L-8, header only)

### TC-C-53: Bookmark toggle in the lesson header persists
- **ACs:** L-8.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-empty`
- **Steps:**
  1. Go to `/lessons/l2-context-files` and wait for hydration.
  2. Locate `getByRole('button', { name: 'Bookmark' })` and assert `aria-pressed="false"`.
  3. Click it, run `readProgress(page)`, then reload.
  4. Click it again, then run `readProgress(page)`.
- **Expected:**
  - Step 2: exactly one button named "Bookmark" exists on the page. It precedes the "Concept" h2 (the header), not the tabs, the exercise or the footer.
  - Step 3: `aria-pressed="true"` and the name is still exactly "Bookmark" (the state is `aria-pressed` only). `bookmarks.lessons["l2-context-files"]` is an ISO timestamp within 5s of now. It is still pressed after the reload.
  - Step 4: `aria-pressed="false"` and the key `l2-context-files` is absent from `bookmarks.lessons`.
  - The `/bookmarks` listing is WS-D.

## Suite 12: Exercise panel (E-1–E-3)

### TC-C-54: Exercise panel shows all required fields (automated verify)
- **ACs:** E-1.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; context with clipboard permissions.
- **Steps:**
  1. Go to `/lessons/l1-first-session` and scope to `exercise = getByRole('region', { name: /^Exercise/ })`.
  2. Read the title (h3), the goal and the repo path.
  3. Click `exercise.getByRole('button', { name: 'Copy code: Setup' })` and read the clipboard.
  4. Click `exercise.getByRole('button', { name: 'Copy code: Verify' })` and read the clipboard.
- **Expected:**
  - The region name is "Exercise " followed by the `ex-fx-auto` title. The goal matches the fixture, and the repo path text is `exercises/ex-fx-auto/starter`.
  - The setup clipboard equals the seeded `setup_cmd` exactly: `cp -r exercises/ex-fx-auto/starter ~/fm-ex/ex-fx-auto && cd ~/fm-ex/ex-fx-auto && npm i`.
  - The verify clipboard equals `npm test`.
  - `exercise.getByRole('group', { name: 'Checklist' })` contains 3 checkboxes.

### TC-C-55: Manual exercise shows "Manual verification" and no verify copy button
- **ACs:** E-1.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base` (`ex-fx-manual`, `verify_cmd` null)
- **Steps:**
  1. Go to `/lessons/l2-context-files` and scope to the exercise region.
- **Expected:**
  - The badge text "Manual verification" and the text "Use the checklist below." are present.
  - `Copy code: Setup` exists, and `Copy code: Verify` has count 0.
  - There is no empty code block and no text "null" or "manual" as a command.

### TC-C-56: Starter prompts live in tabs synchronised with the tool tabs
- **ACs:** E-1.2, L-2.3
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-empty`
- **Steps:**
  1. Go to `/lessons/l1-first-session` and scope to `promptTabs = exercise.getByRole('tablist', { name: 'Starting prompt' })`.
  2. Read the visible prompt block (figure "Prompt") in the exercise region.
  3. Click `toolTabs.getByRole('tab', { name: 'Codex CLI' })`, then re-read the prompt.
  4. Click `promptTabs.getByRole('tab', { name: 'Claude Code' })`, then read the `toolTabs` selection, `readProgress(page).prefs.tool` and the URL.
- **Expected:**
  - Step 2: "Claude prompt fx", with a copy button "Copy code: Prompt".
  - Step 3: "Codex prompt fx", with no extra clicks.
  - Step 4: `toolTabs` switches to Claude Code, `prefs.tool === "claude"` and the URL has `?tool=claude`.
  - Both tablists pass the TC-C-21 structure checks with distinct ids (DESIGN §4.4 step 4; AMB-15 resolved).

### TC-C-57: Checklist items are native checkboxes with labels and persist
- **ACs:** E-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-empty`
- **Steps:**
  1. Go to `/lessons/l1-first-session` and wait for hydration. Scope to `checklist = exercise.getByRole('group', { name: 'Checklist' })`.
  2. Check `checklist.getByRole('checkbox', { name: 'Test is green' })` by clicking its label text. Tab to "No test files edited" and press Space.
  3. Read the "n of 3 done" text and `exercise.getByRole('progressbar', { name: 'Checklist' })`.
  4. `readProgress(page)`, then reload.
- **Expected:**
  - The elements are `input[type=checkbox]`, and the group is a `fieldset` whose legend is exactly "Checklist".
  - Step 3: "2 of 3 done" and `aria-valuenow="67"`.
  - Step 4: `checklists["ex-fx-auto"]` equals `{ c1: true, c2: true }` (c3 absent or false). After the reload, "Test is green" and "No test files edited" are checked and "Diff reviewed" is unchecked.

### TC-C-58: Reworded item keeps state (stable IDs)
- **ACs:** E-2.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; `seedProgress` with `checklists: { "ex-fx-auto": { c1: true } }`. A service-role update of `exercises.checklist` for `ex-fx-auto` sets c1's text to "Tests are green (reworded)". Reset the DB afterwards.
- **Steps:**
  1. Go to `/lessons/l1-first-session` and wait for hydration.
- **Expected:** `getByRole('checkbox', { name: 'Tests are green (reworded)' })` is checked, and the count reads "1 of 3 done".

### TC-C-59: Removed and unknown item IDs are ignored in display and count
- **ACs:** E-2.2, S9-11
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`, `ls-orphans` (`checklists["ex-fx-auto"] = { c1: true, zzz: true }`)
- **Steps:**
  1. Go to `/lessons/l1-first-session`, wait for hydration, then read the count text and the number of checkboxes in the "Checklist" group.
  2. Check c2 and c3.
- **Expected:**
  - Step 1: 3 checkboxes and "1 of 3 done" (not "2 of 3" or "2 of 4"). There is no row for `zzz`, no notice and no console error.
  - Step 2: the meta line is replaced by the badge "Exercise complete" (3 of 3 current items), although `zzz` remains in storage.

### TC-C-60: All checked shows "Exercise complete" once, but does not complete the lesson
- **ACs:** E-2.3, L-5.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-empty`
- **Steps:**
  1. Go to `/lessons/l2-context-files`, wait for hydration, then check "CLAUDE.md written" and "AGENTS.md mirrors it".
  2. Read `#fm-live`, `readProgress(page)` and the Mark complete control.
  3. Reload. Record `#fm-live` text 1s after hydration.
  4. Uncheck one item.
- **Expected:**
  - Step 2: the checklist header shows the badge "Exercise complete" and `#fm-live` reads "Exercise complete". `lessons["l2-context-files"]` is absent and `getByRole('button', { name: 'Mark complete' })` is still shown.
  - Step 3: the badge is shown again, but `#fm-live` does **not** announce "Exercise complete" on page load (DESIGN §4.6: only on the transition).
  - Step 4: the badge disappears and "1 of 2 done" returns.

### TC-C-61: Reference solution disclosure collapsed by default
- **ACs:** E-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; clipboard permissions.
- **Steps:**
  1. Go to `/lessons/l1-first-session`.
  2. Read `btn = getByRole('button', { name: 'Compare with reference solution' })`: its `aria-expanded`, and the element referenced by its `aria-controls`.
  3. Focus `btn` and press Enter. Read the panel, then click the panel's `getByRole('button', { name: 'Copy code: Terminal' })` and read the clipboard.
  4. Press Space on `btn`.
- **Expected:**
  - Step 2: `aria-expanded="false"`, the controlled panel has the `hidden` attribute, and `exercises/ex-fx-auto/solution` is not visible.
  - Step 3: `aria-expanded="true"`; the panel shows `exercises/ex-fx-auto/solution`; the clipboard equals exactly `git diff --no-index exercises/ex-fx-auto/starter exercises/ex-fx-auto/solution`.
  - Step 4: the panel is collapsed again (`hidden`).
  - The page contains no `details` or `summary` element (DESIGN §11 conventions).
- **Notes:** The "Terminal" label for this command is AMB-C14.

### TC-C-62: Solution notes count 2–5
- **ACs:** E-3.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. Expand the disclosure on `/lessons/l1-first-session` and on `/lessons/l2-context-files`.
  2. Count the list items under the text "What the reference solution does differently".
- **Expected:** 3 and 2 respectively, with texts matching the fixture, rendered as plain text.

## Suite 13: Exercises index (E-5)

### TC-C-63: `/exercises` lists every exercise with level, lesson link, verify type and progress
- **ACs:** E-5.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; `seedProgress` with `checklists: { "ex-fx-auto": { c1: true, c2: true } }`. Two runs: 1440×900 and 360×800.
- **Steps:**
  1. At 1440, go to `/exercises`, wait for hydration, and read `getByRole('table', { name: 'Exercises' })`.
  2. At 360, read `getByRole('article')`.
- **Expected:**
  - The h1 is "Exercises".
  - Step 1: the column headers are exactly "Level", "Exercise", "Lesson", "Verify", "Progress", and there are exactly 2 body rows.
    - `ex-fx-auto`: level "L1"; exercise link `href="/lessons/l1-first-session#exercise"`; lesson "1.1" plus its title; Verify badge "Auto"; progress "2 / 3" with a "Checklist"-sized bar.
    - `ex-fx-manual`: "L2", Verify "Manual", progress "—" with sr text "No progress yet". It never reads "0 / 2" or "not started".
  - Step 2: there is no table, and there are 2 `article`s named by exercise title, grouped under the "Level 1" and "Level 2" eyebrows.
  - No archived exercise appears.

## Suite 14: Curriculum and lesson states (§9)

### TC-C-64: Curriculum empty state
- **ACs:** S9-02
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-no-content`; clipboard permissions.
- **Steps:**
  1. Go to `/curriculum`.
  2. In `getByRole('region', { name: 'No lessons seeded yet. Run npm run seed.' })`, click its `getByRole('button', { name: /^Copy code: / })` and read the clipboard.
- **Expected:**
  - HTTP 200. The empty region exists, and its visible title reads "No lessons seeded yet. Run `npm run seed`." with the command as inline code.
  - The clipboard equals `npm run seed`.
  - There are no `/^Level \d/` regions and no console errors.
- **Notes:** The CommandLine label is AMB-C14.

### TC-C-65: Curriculum loading skeleton matches the final layout
- **ACs:** S9-03, D-4.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Perf
- **Preconditions / fixtures:** `fx-base`; cookie `fm_test_delay=curriculum:1500` (README §4 hook 5; AMB-C12).
- **Steps:**
  1. Go to `/curriculum` and capture `getByTestId('curriculum-skeleton')` while it loads.
  2. Observe `layout-shift` entries (`PerformanceObserver`) until the content renders.
- **Expected:**
  - During the delay the skeleton is visible with `aria-busy="true"` and contains `getByRole('status').filter({ hasText: 'Loading curriculum' })`.
  - It shows 2 level sections of skeleton rows.
  - The content replaces the skeleton in place, with cumulative layout shift < 0.05.

### TC-C-66: Curriculum error boundary with retry
- **ACs:** S9-04
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `fx-base`; cookie `fm_test_fail=curriculum` (throws once; AMB-C12).
- **Steps:**
  1. Go to `/curriculum` and read the page.
  2. Clear the cookie and click `getByRole('button', { name: 'Try again' })`.
- **Expected:**
  - Step 1:
    - `getByRole('heading', { level: 1, name: 'Something went wrong' })`.
    - `getByRole('alert')` containing "This page couldn't load.".
    - `getByRole('link', { name: 'Back to curriculum' })`.
    - The header navigation "Main" and `#fm-live` are still rendered.
    - No stack trace or SQL text appears in the DOM.
  - Step 2: the curriculum renders with 2 level regions, without a full reload (the "Try again" handler calls `router.refresh()` plus `reset()`, DESIGN §6.10).
- **Notes:** The DB-down full page (S9-01) is WS-A/M2.

### TC-C-67: Unknown and archived lesson slugs return the lesson 404
- **ACs:** S9-05, C-1.3
- **Level:** e2e
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. `page.goto('/lessons/does-not-exist')` and record the response status.
  2. `page.goto('/lessons/l2-retired')`.
  3. `page.goto('/lessons/%3Cscript%3E')` and `page.goto('/lessons/L1-FIRST-SESSION')`.
- **Expected:**
  - Every URL returns HTTP 404 with `getByRole('heading', { level: 1, name: 'Lesson not found' })`, the body text `"<slug>" isn't in the current curriculum. It may have been renamed or archived.`, and `getByRole('link', { name: 'Go to curriculum' })` with `href="/curriculum"`.
  - The archived lesson's title and body do not appear.
  - In step 3 the slug shows as escaped text (`"<script>"`), and no `script` element is created.
- **Notes:** Slug case sensitivity is AMB-C7.

### TC-C-68: Lesson loading skeleton
- **ACs:** S9-06
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; cookie `fm_test_delay=lesson:1500`
- **Steps:**
  1. Navigate client-side from `/curriculum` to `/lessons/l1-first-session`.
- **Expected:** `getByTestId('lesson-skeleton')` is visible with `aria-busy="true"` until the content arrives. It includes a tablist skeleton (2 blocks) and a callout block, and CLS stays < 0.05.

### TC-C-69: Lesson error boundary
- **ACs:** S9-07
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `fx-base`; cookie `fm_test_fail=lesson`
- **Steps:**
  1. Go to `/lessons/l1-first-session`.
  2. Clear the cookie and click "Try again".
- **Expected:**
  - Step 1: h1 "Something went wrong", `getByRole('alert')` containing "This page couldn't load.", a "Try again" button and no stack trace.
  - Step 2: the lesson renders with the h1 of its title.

### TC-C-70: Server HTML contains no progress state (no "not started" flash)
- **ACs:** S9-09, P-5.1, C-1.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; `ls-one-complete` in the browser context; `collectConsole(page)`.
- **Steps:**
  1. `request.get('/curriculum')` and `request.get('/lessons/l1-first-session')`, and inspect the raw HTML.
  2. Add an init script with a `MutationObserver` that records every added `[role=progressbar]` and every text node matching `/Completed|Not started|not started/`, with a timestamp.
  3. Go to `/curriculum`, then to `/lessons/l1-first-session`.
- **Expected:**
  - Step 1:
    - The curriculum HTML contains no `role="progressbar"`, no "Completed" and no "1 / 2".
    - It contains `data-testid="progress-placeholder"` elements with `aria-busy="true"`.
    - The lesson HTML has the "Mark complete" button disabled and no "Completed ✓" text. Checklist checkboxes are unchecked and disabled.
  - Step 2: every progressbar is first observed with its final `aria-valuenow` ("Level 1" = 50). "Not started" is never observed in any case.
  - Step 3: no hydration warnings.
- **Notes:** Store-level P-5.1 is WS-D.

## Suite 15: Accessibility and responsiveness

### TC-C-71: axe on curriculum, exercises and lessons in both tab states
- **ACs:** D-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`, `ls-one-complete`, `@axe-core/playwright`, tags `wcag2a, wcag2aa, wcag21aa, wcag22aa`
- **Steps:**
  1. Run axe on `/curriculum` and `/exercises`.
  2. For `l1-first-session` and `l1-permissions`, run axe with `?tool=claude`, then `?tool=codex`, then with the reference disclosure expanded and the Codex tab selected in "Starting prompt".
- **Expected:** Every run has 0 violations with impact `serious` or `critical` (including `scrollable-region-focusable` on code `pre`s and `duplicate-id`).

### TC-C-72: No horizontal page scroll; code blocks scroll within themselves
- **ACs:** D-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Responsive
- **Preconditions / fixtures:** `fx-base`; viewports 360×800, 768×1024, 1024×768 and 1440×900.
- **Steps:**
  1. At each width, load `/curriculum`, `/lessons/l1-first-session` and `/exercises`.
  2. Evaluate `document.documentElement.scrollWidth <= window.innerWidth`.
  3. On the lesson, for the `pre` named "Code: text" (`blk-plain`), evaluate `scrollWidth > clientWidth` and the computed `overflow-x`.
- **Expected:**
  - Step 2 is true on every page at every width.
  - Step 3 at 360: the `pre` overflows internally with `overflow-x` `auto` (or `scroll`), has `tabindex="0"`, and its `white-space` is not a wrapping value.
  - The "Prompt" block in the exercise panel wraps (`pre-wrap`).

### TC-C-73: Tabs remain tabs below 768px
- **ACs:** D-3.2, L-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Responsive
- **Preconditions / fixtures:** `fx-base`; viewport 360×800 with `hasTouch: true`.
- **Steps:**
  1. Go to `/lessons/l1-first-session` and tap "Codex CLI" in `toolTabs`.
  2. Repeat the TC-C-22 key presses.
- **Expected:**
  - `toolTabs` still has `role=tablist` with 2 `role=tab`, side by side (same `boundingBox().y`), and there are no accordion `aria-expanded` buttons for the tools.
  - Both labels are fully visible (not truncated to icons).
  - Tapping switches the panel, and keyboard behavior matches desktop.
  - Each tab's bounding box is at least 44×44 (coarse pointer, AMB-11).

### TC-C-74: Manual responsive pass screenshots
- **ACs:** D-3.1, D-3.2, G-1
- **Level:** e2e
- **Priority:** P0
- **Category:** Responsive
- **Preconditions / fixtures:** `fx-base`, `ls-one-complete`
- **Steps:**
  1. At 360, 768 and 1440, capture full-page screenshots of `/curriculum`, `/lessons/l1-first-session?tool=claude`, `/lessons/l1-permissions?tool=codex` and `/exercises`.
- **Expected:** The screenshots are attached to the WS-C PR. The reviewer confirms:
  - the header meta wraps without overlap;
  - the verified line and the "May be outdated" badge are readable;
  - the differences callout is full width;
  - exercise commands scroll within their block;
  - prev/next stack full width at 360.
- **Notes:** @manual.

### TC-C-75: Storage blocked: tabs still switch and the URL still updates
- **ACs:** L-2.2, L-2.3
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `fx-base`; `blockStorage(page)`
- **Steps:**
  1. Go to `/lessons/l1-first-session`.
  2. Click "Codex CLI" in `toolTabs`.
  3. Go to `/lessons/l2-context-files`.
- **Expected:**
  - Step 2: Codex is selected, the URL is `?tool=codex`, and there is no `pageerror`.
  - Step 3: Claude Code is selected (the preference could not be saved; DESIGN §4.4 step 6).
  - `getByRole('status').filter({ hasText: "Progress can't be saved in this browser" })` is visible (WS-D owns the banner).

### TC-C-76: Exercise tablist scrolled above the viewport keeps its offset on switch
- **ACs:** L-2.4
- **Level:** e2e
- **Priority:** P1
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base`; viewport 1440×900. The fixture's Claude and Codex lesson bodies differ in height by at least 300px.
- **Steps:**
  1. Go to `/lessons/l1-first-session`. Scroll so the `promptTabs` tablist is 20px below the viewport top, and record its `boundingBox().y`.
  2. Click "Codex CLI" in `promptTabs` (this also switches the taller lesson panel above it).
- **Expected:** `|Δ promptTabs y| <= 50`. The implementation compensates with `scrollBy` for the lesson panel's height change above it (DESIGN §4.4 step 5).

### TC-C-77: Lesson page landmarks, breadcrumb and document title
- **ACs:** L-1.1, D-2.1
- **Level:** e2e
- **Priority:** P1
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`; viewport 1440×900.
- **Steps:**
  1. Go to `/lessons/l2-context-files`.
  2. Read the document title, `getByRole('navigation', { name: 'Breadcrumb' })`, `getByRole('navigation', { name: 'On this lesson' })` and the "Curriculum" link in `getByRole('navigation', { name: 'Main' })`.
- **Expected:**
  - The document title is "<l2-context-files title> · L2 · First Mate AI Playground" (DESIGN §5.3).
  - The breadcrumb contains a link to `/curriculum`.
  - The "On this lesson" rail has 4 links, to `#concept`, `#tools`, `#differences` and `#exercise`.
  - The "Curriculum" nav link has `aria-current="page"` on a lesson route.
  - The page has exactly one h1, and heading levels never skip.
  - At 360 the "On this lesson" navigation is absent.

### TC-C-78: Checklist is inert before hydration
- **ACs:** E-2.1, S9-09
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; `seedProgress` with `checklists: { "ex-fx-auto": { c1: true } }`.
- **Steps:**
  1. `request.get('/lessons/l1-first-session')` and inspect the checklist markup.
  2. Go to the page in the browser and wait for hydration.
- **Expected:**
  - Step 1: all 3 checkboxes are `disabled` and unchecked, the list has `aria-busy="true"`, and there is no `role="progressbar"` named "Checklist".
  - Step 2: "Test is green" is checked and enabled, and "1 of 3 done" is shown (DESIGN §4.6).

### TC-C-79: Curriculum level jump navigation
- **ACs:** C-3.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; two runs, at 360×800 and 1440×900.
- **Steps:**
  1. Go to `/curriculum` and read `getByRole('navigation', { name: 'Levels' })`.
  2. Activate its second link with the keyboard.
- **Expected:**
  - Step 1: the navigation has 2 links, to `#level-1` and `#level-2`.
  - Step 2: the "Level 2 Context engineering" region's top is within the viewport.
  - At 360 each jump link is at least 44px tall.

---

## Coverage

| AC / state | Cases |
|---|---|
| C-1.1 | TC-C-01, 02, 03 |
| C-1.2 | TC-C-04, 05, 70 |
| C-1.3 | TC-C-06, 07, 48, 67 |
| C-2.1 | TC-C-07, 09, 10, 11, 12, 13, 14 |
| C-3.1 | TC-C-08, 79 |
| C-5.1 | TC-C-15 |
| C-5.2 | TC-C-16, 17, 18 |
| L-1.1 | TC-C-19, 20, 77 |
| L-2.1 | TC-C-21, 22, 23, 24, 73 |
| L-2.2 | TC-C-22, 25, 26, 30, 31, 75 |
| L-2.3 | TC-C-28, 29, 30, 31, 56, 75 |
| L-2.4 | TC-C-26, 27, 76 |
| L-3.1 | TC-C-32, 33, 34 |
| L-3.2 | TC-C-35, 36 |
| L-4.1 | TC-C-37, 38, 39, 41 |
| L-4.2 | TC-C-37, 39, 40 |
| L-5.1 | TC-C-42, 43, 45, 60 |
| L-5.2 | TC-C-44, 45 |
| L-6.1 | TC-C-46, 47, 48, 49 |
| L-7.1 | TC-C-34, 50, 51 |
| L-7.2 | TC-C-51, 52 |
| L-8.1 | TC-C-53 (header toggle; the `/bookmarks` list is WS-D) |
| E-1.1 | TC-C-54, 55 |
| E-1.2 | TC-C-56 |
| E-2.1 | TC-C-57, 78 |
| E-2.2 | TC-C-58, 59 |
| E-2.3 | TC-C-59, 60 |
| E-3.1 | TC-C-61 |
| E-3.2 | TC-C-62 |
| E-5.1 | TC-C-63 |
| S9-02 | TC-C-64 |
| S9-03 | TC-C-65 |
| S9-04 | TC-C-66 |
| S9-05 | TC-C-67 |
| S9-06 | TC-C-68 |
| S9-07 | TC-C-69 |
| S9-08 | TC-C-35 |
| S9-09 | TC-C-70, 78 |
| S9-11 | TC-C-59 |
| S9-21 | TC-C-41 (lesson integration) |
| D-1.2 | TC-C-21, 36 |
| D-2.1 | TC-C-71, 77 |
| D-2.2 | TC-C-24 |
| D-3.1 | TC-C-72, 74 |
| D-3.2 | TC-C-73, 74 |
| D-4.2 | TC-C-65 |
| P-5.1 | TC-C-28, 70 (cross-ref) |
| G-1 | TC-C-74 |

Out of scope here:
- C-4.x (the Continue CTA on `/`) is M2.
- The `/bookmarks` listing (second half of L-8.1) is WS-D.
- S-3.1 (no redeploy) is B/M2.

## Ambiguities raised in this file

| ID | Ambiguity | Assumed here |
|---|---|---|
| AMB-C1 | C-2.1 `aria-valuenow` for non-integer percentages (1/3): integer `33` or `33.33`? DESIGN §4.7 fixes the 0–100 scale and `aria-valuetext`, but not the rounding. | Integer, rounded half-up. |
| AMB-C2 | **Resolved: DESIGN §4.7.** A level with 0 lessons shows "0 / 0" and `aria-valuenow=0`. | — |
| AMB-C3 | C-5.2 "more than 60 days": calendar days or timestamp arithmetic? (The zone is Manila per DESIGN §7.) | Calendar days between `last_verified_on` and today's Manila date; more than 60 is outdated. |
| AMB-C4 | Superseded by global AMB-25: `fx-base` lessons without an exercise vs. frontmatter requiring `exercise`. | The panel is omitted, and the order is otherwise unchanged. |
| AMB-C5 | **Resolved: DESIGN §4.4.** Automatic activation. | — |
| AMB-C6 | **Resolved: DESIGN §4.4 step 5.** Content above the tabs never moves; the tablist offset is kept with `scrollBy`. | — |
| AMB-C7 | Partly resolved: for `?tool`, anything but lowercase `claude`/`codex` renders Claude (DESIGN §4.4). Still open: lesson slug case (`L1-FIRST-SESSION`). | Exact lowercase slugs only; others return 404. |
| AMB-C8 | **Resolved: DESIGN §4.4.** The notice uses "Codex CLI" / "Claude Code". | — |
| AMB-C9 | **Resolved: DESIGN §4.5.** A block without a language is labelled "text". | — |
| AMB-C10 | L-5.1 "reflects the change without a reload": same-tab client navigation only, or also a curriculum page already open in another tab? DESIGN is silent. | Same tab is P0; cross-tab (via the `storage` event) is asserted but may drop to P1. |
| AMB-C11 | **Resolved: DESIGN §6.3.** External links carry the sr-only text "(opens in new tab)" and a ↗ icon. | — |
| AMB-C12 | Loading and error cases need a way to delay or fail a server query on demand; no hook exists (README §4 item 5). | `FM_TEST_MODE=1` cookies `fm_test_delay=<route>:<ms>` and `fm_test_fail=<route>`. |
| AMB-C13 | The fixture code-block bodies are not in S-5; this file pins `blk-bash`, `blk-json` and `blk-plain` for WS-B. | WS-B seeds them verbatim. |
| AMB-C14 | DESIGN §4.5 lists CommandLine labels "Setup", "Verify", "Prompt" and "Terminal", but does not say which label the curriculum-empty `npm run seed` and the E-3 `git diff` command use. | "Terminal" for both (as on the DB-down page). Cases match `/^Copy code: /` for the empty state and "Copy code: Terminal" for the diff. |
| AMB-C15 | The lesson-header wireframe at 1440 shows "CC v2.3 / Cx v0.9", but DESIGN §7 allows abbreviations only in the 360 meta line; C-5.1 wants "Claude Code vX / Codex vY". | Full names at 1440; the assertion checks the date and both versions. |
| AMB-C16 | A repeated `?tool=codex&tool=claude` gives an array `searchParams.tool`; DESIGN §4.4 does not say whether that counts as "anything else". | Any single selected tab with no error is accepted. |
