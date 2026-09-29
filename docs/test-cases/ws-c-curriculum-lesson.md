# WS-C test cases: curriculum and lesson UI

Scope: `/curriculum`, `/lessons/[slug]`, `/exercises`, and the lesson and exercise components (PRD C-1–C-5, L-1–L-8, E-1–E-3, E-5; §9 curriculum and lesson states).
Owner paths: `src/app/curriculum/`, `src/app/lessons/`, `src/app/exercises/`, `src/components/lesson/`, `src/components/exercise/`.
Contract: [README.md](README.md) (case format, selectors, `fx-base`, `ls-*` fixtures, test hooks, AMB-nn). Unless stated, e2e cases run on `fx-base` with `fm_test_now=2026-09-30T13:00:00+08:00` and a fresh browser context with `ls-empty`.

**Fixture code blocks (WS-B must seed these exact bodies in `l1-first-session`'s concept section; cases below assert them byte-for-byte):**

| Block | Fence | Exact body (no trailing newline) |
|---|---|---|
| `blk-bash` | ```` ```bash ```` | `npm i -g @anthropic-ai/claude-code`⏎`claude --version` |
| `blk-json` | ```` ```json title="settings.json" ```` | `{ "permissions": { "allow": ["Bash(npm test)"] } }` |
| `blk-plain` | ```` ``` ```` (no language) | `echo "plain block"` followed by a line of 300 `x` characters (forces horizontal overflow at 360px) |

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
  3. In each region read the level heading and the summary text.
- **Expected:** Exactly 2 regions, in order: "Level 1" with heading containing "Foundations" and text "One-line summary A"; "Level 2" with heading containing "Context engineering" and text "One-line summary B".
- **Notes:** 5-level exactness is TC-C-02 (AMB-01).

### TC-C-02: Five levels render in numeric order L1–L5 regardless of input order
- **ACs:** C-1.1
- **Level:** unit
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-curriculum-5`, passed to the curriculum list component with levels deliberately shuffled (`[3,1,5,2,4]`) and lessons within L3 shuffled by `sort` (`[3,1,4,2]`).
- **Steps:**
  1. Render the component with `ls-empty` progress.
  2. Read level headings in DOM order; read L3 lesson titles in DOM order.
- **Expected:** Headings are Level 1, 2, 3, 4, 5 in that order. L3 lessons appear in `sort` 1, 2, 3, 4 order.
- **Notes:** AMB-01.

### TC-C-03: Lessons within a level follow `sort`, not title or insertion order
- **ACs:** C-1.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. Go to `/curriculum`.
  2. Inside the Level 1 region, read lesson link names in order; repeat for Level 2.
- **Expected:** Level 1: `l1-first-session` title then `l1-permissions` title. Level 2: `l2-context-files` title then `l2-memory` title. No other lesson rows.

### TC-C-04: Lesson row shows title, objective, minutes and "not started"
- **ACs:** C-1.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-empty`
- **Steps:**
  1. Go to `/curriculum`; wait for hydration (`page.waitForFunction(() => document.documentElement.dataset.hydrated === '1')` or equivalent hook named by WS-A).
  2. Locate the row containing the `l1-first-session` link.
- **Expected:** Row contains the lesson title (as a link to `/lessons/l1-first-session`), the fixture objective text, "20 min", and a completion state whose accessible text is "Not started".

### TC-C-05: Completed state comes from localStorage
- **ACs:** C-1.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `seedProgress(page, ls-one-complete)`
- **Steps:**
  1. Go to `/curriculum`, wait for hydration.
  2. Read the completion state of the `l1-first-session` row and the `l1-permissions` row.
- **Expected:** `l1-first-session` shows "Completed"; `l1-permissions` shows "Not started". State is not conveyed by color alone (text or accessible name present).

### TC-C-06: Archived lesson never appears on the curriculum
- **ACs:** C-1.3
- **Level:** e2e
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** `fx-base` (contains archived `l2-retired`)
- **Steps:**
  1. Go to `/curriculum`.
  2. Search the page for any link with `href` `/lessons/l2-retired` and for the `l2-retired` title text.
- **Expected:** Zero matches. Level 2 shows exactly 2 lesson rows.

### TC-C-07: Archived lesson excluded even when it is marked complete in storage
- **ACs:** C-1.3, C-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; `seedProgress` with `lessons: { "l2-retired": { completedAt: "2026-09-01T00:00:00.000Z" } }`
- **Steps:**
  1. Go to `/curriculum`, wait for hydration.
  2. Read the Level 2 progress bar.
- **Expected:** No `l2-retired` row. Level 2 header shows "0 / 2" and `aria-valuenow="0"` (archived completions are not counted). No console errors.

### TC-C-08: Every active lesson is reachable in one click, none locked
- **ACs:** C-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-empty`
- **Steps:**
  1. For each slug in `[l1-first-session, l1-permissions, l2-context-files, l2-memory]`: go to `/curriculum`, click the lesson's link once.
- **Expected:** Each click lands on `/lessons/<slug>` with the lesson's `h1` title and HTTP 200. No link has `aria-disabled="true"`, no lock icon or "Locked" text exists anywhere on `/curriculum`, and the L2 lessons are reachable with no L1 progress.

## Suite 2: Level progress (C-2)

### TC-C-09: Level progress "2 / 4" with `aria-valuenow=50`
- **ACs:** C-2.1
- **Level:** unit
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-curriculum-5`; progress with 2 of the 4 L3 lesson slugs completed.
- **Steps:**
  1. Render the curriculum component.
  2. Query `getByRole('progressbar', { name: /Level 3/ })` and the L3 header text.
- **Expected:** Header text contains "2 / 4". Progressbar has `aria-valuenow="50"`, `aria-valuemin="0"`, `aria-valuemax="100"`.
- **Notes:** AMB-01. The e2e analogue is TC-C-10.

### TC-C-10: Level progress updates in the fixture (1 / 2)
- **ACs:** C-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-one-complete`
- **Steps:**
  1. Go to `/curriculum`, wait for hydration.
  2. Read Level 1 and Level 2 progress.
- **Expected:** Level 1: "1 / 2", `aria-valuenow="50"`. Level 2: "0 / 2", `aria-valuenow="0"`.

### TC-C-11: Boundary progress values 0 / 4 and 4 / 4
- **ACs:** C-2.1
- **Level:** unit
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-curriculum-5`
- **Steps:**
  1. Render with no L3 completions; read L3.
  2. Render with all 4 L3 lessons complete; read L3.
- **Expected:** Step 1: "0 / 4", `aria-valuenow="0"`. Step 2: "4 / 4", `aria-valuenow="100"`.

### TC-C-12: Non-integer percentage rounding (1 / 3)
- **ACs:** C-2.1
- **Level:** unit
- **Priority:** P1
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-curriculum-5` modified so L4 has 3 lessons; 1 complete.
- **Steps:**
  1. Render; read L4 progressbar.
- **Expected:** "1 / 3"; `aria-valuenow` is an integer `33` (rounded half-up) and `aria-valuetext` (if present) contains "1 of 3".
- **Notes:** AMB-C1 (integer vs decimal).

### TC-C-13: Level with zero active lessons
- **ACs:** C-2.1
- **Level:** unit
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-curriculum-5` with L5's lessons all archived (filtered out).
- **Steps:**
  1. Render; read L5 section.
- **Expected:** No `NaN`, no division-by-zero text. Header shows "0 / 0" and `aria-valuenow="0"`, or the section shows no progressbar at all; either way no console error.
- **Notes:** AMB-C2.

### TC-C-14: Completions of unknown slugs do not inflate counts
- **ACs:** C-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`, `ls-orphans` plus `l1-first-session` completed.
- **Steps:**
  1. Go to `/curriculum`, wait for hydration.
- **Expected:** Level 1 "1 / 2" (not "2 / 2"). No row for `deleted-lesson-slug`. No console errors. (Storage retention of the orphan is WS-D, P-4.1.)

## Suite 3: Verified badges (C-5)

### TC-C-15: Verified line on curriculum row and lesson header
- **ACs:** C-5.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. Go to `/curriculum`; read the `l1-first-session` row.
  2. Go to `/lessons/l1-first-session`; read the header (the region before the concept body).
- **Expected:** Both contain exactly "Verified 20 Sep 2026 · Claude Code v2.1.0 / Codex v0.40.0".
- **Notes:** Date format per AMB-21.

### TC-C-16: 61 days old shows "May be outdated"
- **ACs:** C-5.2
- **Level:** e2e
- **Priority:** P1
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base`; `fm_test_now=2026-09-30T13:00:00+08:00`; `l1-permissions` verified 2026-07-31.
- **Steps:**
  1. Go to `/curriculum`; inspect the `l1-permissions` row.
  2. Go to `/lessons/l1-permissions`; inspect the header.
- **Expected:** Both show a badge with text "May be outdated".

### TC-C-17: Exactly 60 days old shows no badge
- **ACs:** C-5.2
- **Level:** e2e
- **Priority:** P1
- **Category:** Boundary
- **Preconditions / fixtures:** as TC-C-16; `l2-context-files` verified 2026-08-01.
- **Steps:**
  1. Inspect the `l2-context-files` row and its lesson header.
- **Expected:** No "May be outdated" text anywhere in the row or header.

### TC-C-18: Badge boundary follows the Manila server clock, not the browser time zone
- **ACs:** C-5.2
- **Level:** e2e
- **Priority:** P1
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base`; `fm_test_now=2026-09-29T23:30:00+08:00` (60 days after 2026-07-31 in Manila, still 2026-09-29 15:30 UTC); browser context `timezoneId: 'America/Los_Angeles'`.
- **Steps:**
  1. Go to `/curriculum`; inspect `l1-permissions`.
  2. Change cookie to `fm_test_now=2026-09-30T00:30:00+08:00` (2026-09-29 16:30 UTC); reload.
- **Expected:** Step 1: no badge (60 days). Step 2: badge "May be outdated" (61 days in Manila even though UTC date is still 29 Sep). No hydration warning in either step (`collectConsole`).
- **Notes:** AMB-04, AMB-C3 (which zone "days" uses).

## Suite 4: Lesson layout (L-1)

### TC-C-19: Lesson sections render in the required order
- **ACs:** L-1.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. Go to `/lessons/l1-first-session`.
  2. Get bounding boxes / DOM order (`compareDocumentPosition`) of: `getByRole('heading', { level: 1 })`, the concept body (first paragraph of the concept), `getByRole('tablist', { name: 'Tool' })`, `getByRole('region', { name: 'Key differences' })`, `getByRole('region', { name: /^Exercise/ })`, `getByRole('navigation', { name: 'Lesson' })` (prev/next).
- **Expected:** DOM order is exactly header → concept → tabs → Key differences → exercise → prev/next. The header contains title, objective, "20 min" and the verified line.

### TC-C-20: Lesson without an exercise omits the panel but keeps order
- **ACs:** L-1.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; `l1-permissions` has no exercise.
- **Steps:**
  1. Go to `/lessons/l1-permissions`.
- **Expected:** No `region` named `/^Exercise/` and no empty placeholder box; order header → concept → tabs → Key differences → prev/next holds.
- **Notes:** AMB-C4 (PRD implies every lesson has an exercise; fixture lesson without one).

## Suite 5: Tool tabs (L-2)

### TC-C-21: Tabs ARIA structure
- **ACs:** L-2.1, D-1.2
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`, `ls-empty`
- **Steps:**
  1. Go to `/lessons/l1-first-session`.
  2. Inspect `getByRole('tablist', { name: 'Tool' })`, both tabs and `getByRole('tabpanel')`.
- **Expected:** Exactly 2 tabs, names "Claude Code" and "Codex CLI". Claude Code has `aria-selected="true"`, `tabindex="0"`; Codex CLI has `aria-selected="false"`, `tabindex="-1"`. Each tab's `aria-controls` equals its panel's `id`; the visible panel's `aria-labelledby` equals the active tab's `id`. Exactly one visible `tabpanel`; the hidden one is `hidden` (not in the a11y tree). The visible panel has `tabindex="0"` (or its first child is focusable). Each tab contains an icon (`svg` with `aria-hidden="true"`) plus text.

### TC-C-22: Arrow keys move focus and wrap
- **ACs:** L-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** as TC-C-21
- **Steps:**
  1. Focus the "Claude Code" tab (`.focus()`).
  2. Press ArrowRight. 3. Press ArrowRight. 4. Press ArrowLeft. 5. Press ArrowLeft.
- **Expected:** After 2: "Codex CLI" focused. After 3: wraps to "Claude Code". After 4: wraps to "Codex CLI". After 5: "Claude Code". After each press the focused tab has `tabindex="0"` and the other `tabindex="-1"`; the active panel matches the focused tab (automatic activation) and the URL `tool` param matches.
- **Notes:** AMB-C5 (automatic vs manual activation).

### TC-C-23: Home and End keys
- **ACs:** L-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** as TC-C-21
- **Steps:**
  1. Focus "Claude Code"; press End. 2. Press Home.
- **Expected:** After 1: "Codex CLI" focused and selected. After 2: "Claude Code" focused and selected. The page does not scroll (`scrollY` unchanged ± 50px).

### TC-C-24: Only the active tab is in the tab order; Tab moves into the panel
- **ACs:** L-2.1, D-2.2
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** as TC-C-21
- **Steps:**
  1. Focus the element immediately before the tablist in tab order (Shift+Tab from "Claude Code" then Tab back, record it).
  2. Press Tab once from that element.
  3. Press Tab again.
  4. Press Shift+Tab twice.
- **Expected:** Step 2 focuses "Claude Code" (never "Codex CLI"). Step 3 focuses the tabpanel (or its first focusable element), not "Codex CLI". Step 4 returns to the element before the tablist. The focused tab shows a visible focus ring (see WS-A for ring metrics).

### TC-C-25: `?tool=codex` opens the Codex tab
- **ACs:** L-2.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-empty`
- **Steps:**
  1. Go to `/lessons/l1-first-session?tool=codex`.
- **Expected:** "Codex CLI" tab `aria-selected="true"`; visible panel shows the Codex body. The initial server HTML (`request.get`) already marks Codex selected, so there is no Claude-then-Codex flash.

### TC-C-26: Clicking a tab writes `?tool=` without reload or navigation
- **ACs:** L-2.2, L-2.4
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-empty`
- **Steps:**
  1. Go to `/lessons/l1-first-session`. Run `window.__noReload = 'marker'`.
  2. Click "Codex CLI". 3. Click "Claude Code".
- **Expected:** After 2: URL is `/lessons/l1-first-session?tool=codex`. After 3: `?tool=claude`. `window.__noReload === 'marker'` after each step. No `framenavigated` event with a new document and no document request logged by `page.on('request')` for the lesson route.

### TC-C-27: Tab switch keeps scroll position within 50px
- **ACs:** L-2.4
- **Level:** e2e
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base`; viewport 1440×900 and 360×800 (two runs).
- **Steps:**
  1. Go to `/lessons/l1-first-session`. Scroll so the tablist top is at 100px from the viewport top (`scrollIntoView` then `scrollBy(0,-100)`); record `scrollY`.
  2. Click "Codex CLI"; wait one animation frame; record `scrollY`.
  3. Click "Claude Code"; record `scrollY`.
- **Expected:** `|Δ scrollY| <= 50` for steps 2 and 3 at both widths.
- **Notes:** If Codex body is much shorter, a clamped scroll could exceed 50px; fixture bodies must be long enough that the page remains scrollable (AMB-C6).

### TC-C-28: No `?tool` uses `prefs.tool`, default Claude Code
- **ACs:** L-2.3
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. With `ls-empty`, go to `/lessons/l1-first-session`.
  2. New context with `ls-codex-pref`, go to the same URL.
- **Expected:** Step 1: Claude Code selected. Step 2: Codex CLI selected after hydration; no hydration warning (`collectConsole`).

### TC-C-29: Choosing a tab persists as `prefs.tool` across lessons
- **ACs:** L-2.3
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-empty`
- **Steps:**
  1. Go to `/lessons/l1-first-session`; click "Codex CLI".
  2. `readProgress(page)`.
  3. Go to `/lessons/l2-context-files` (no param).
- **Expected:** Step 2: `prefs.tool === "codex"`. Step 3: Codex CLI selected.

### TC-C-30: URL param overrides pref and does not overwrite it
- **ACs:** L-2.2, L-2.3
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`, `ls-codex-pref`
- **Steps:**
  1. Go to `/lessons/l1-first-session?tool=claude`.
  2. `readProgress(page)`.
- **Expected:** Claude Code selected. `prefs.tool` still `"codex"`.
- **Notes:** AMB-14.

### TC-C-31: Invalid `?tool` values fall back safely
- **ACs:** L-2.2, L-2.3
- **Level:** e2e
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** `fx-base`, `ls-empty`
- **Steps:**
  1. Visit each: `?tool=cursor`, `?tool=`, `?tool=CODEX`, `?tool=codex&tool=claude`, `?tool=%3Cscript%3E`.
- **Expected:** Each returns HTTP 200, renders one selected tab (Claude Code for all except `?tool=codex&tool=claude`, which selects the first value, Codex), no console errors, and the raw param value is never echoed into the DOM.
- **Notes:** AMB-14; case-sensitivity of `CODEX` in AMB-C7.

## Suite 6: Differences and no-native-equivalent (L-3)

### TC-C-32: Key differences callout outside tabs, visible in both tab states
- **ACs:** L-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. Go to `/lessons/l1-first-session`.
  2. Assert the callout is not a descendant of any `tabpanel`.
  3. Count its list items; switch to Codex CLI; re-check visibility and count.
- **Expected:** Callout visible in both states, not inside a tabpanel, 3 list items matching the fixture `differences` in order.

### TC-C-33: Differences count boundaries 1 and 5
- **ACs:** L-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. `/lessons/l1-permissions`: count callout items.
  2. `/lessons/l2-context-files`: count callout items.
- **Expected:** 1 and 5 respectively. (0 and 6 are rejected by the seed; see WS-B.)

### TC-C-34: Differences render as plain text
- **ACs:** L-3.1, L-7.1
- **Level:** unit
- **Priority:** P0
- **Category:** Security
- **Preconditions / fixtures:** callout component with `differences = ["<b>x</b>", "a & b"]`.
- **Steps:**
  1. Render; read `textContent` and query for `b` elements.
- **Expected:** Text is literally `<b>x</b>` and `a & b`; no `b` element created.

### TC-C-35: Codex tab shows no-native-equivalent notice with workaround
- **ACs:** L-3.2, S9-08
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; `l1-permissions` has `codex_no_equivalent=true`, `tool_versions.codex_cli` from fixture.
- **Steps:**
  1. Go to `/lessons/l1-permissions?tool=codex`.
- **Expected:** Visible tabpanel contains "No native equivalent in Codex CLI (as of v<codex_cli>)" followed by "Workaround: use a sandbox profile". The panel's `textContent.trim()` is not empty. The Codex tab is still present and selectable (never removed or disabled).
- **Notes:** Tool name in the notice ("Codex CLI" vs "Codex"): AMB-C8.

### TC-C-36: No-equivalent notice is not a colour-only or icon-only signal
- **ACs:** L-3.2, D-1.2
- **Level:** unit
- **Priority:** P1
- **Category:** A11y
- **Preconditions / fixtures:** tab panel component with `noEquivalent: true`, `tool: 'claude'`, version `2.1.0`, workaround "W".
- **Steps:**
  1. Render; read accessible text.
- **Expected:** Text "No native equivalent in Claude Code (as of v2.1.0)" then "W". Works symmetrically for the Claude side.

## Suite 7: Code blocks in lessons (L-4)

### TC-C-37: Every fenced block has a copy button
- **ACs:** L-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. Go to `/lessons/l1-first-session`.
  2. Count `pre` code blocks in the concept, the visible tabpanel and the exercise panel; count copy buttons (`getByRole('button', { name: /^Copy/ })`).
- **Expected:** Equal counts; concept alone has 3 blocks and 3 copy buttons. Each button has a distinct accessible name (e.g. "Copy bash", "Copy settings.json", "Copy code").

### TC-C-38: Copy writes exact block text and announces "Copied"
- **ACs:** L-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; Chromium context with `permissions: ['clipboard-read','clipboard-write']`.
- **Steps:**
  1. Go to `/lessons/l1-first-session`.
  2. Click the copy button of `blk-bash`.
  3. `await page.evaluate(() => navigator.clipboard.readText())`.
  4. Read `getByRole('status')`.
- **Expected:** Clipboard equals exactly `npm i -g @anthropic-ai/claude-code\nclaude --version` (no trailing newline, no line numbers, no prompt `$`, no highlighting markup). Status region (`aria-live="polite"`) text becomes "Copied". Focus stays on the copy button.

### TC-C-39: Copy of the filename-labelled JSON block is exact
- **ACs:** L-4.1, L-4.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** as TC-C-38
- **Steps:**
  1. Click the copy button of `blk-json`; read clipboard.
- **Expected:** Clipboard equals `{ "permissions": { "allow": ["Bash(npm test)"] } }` exactly (quotes not HTML-escaped, label "settings.json" not included).

### TC-C-40: Blocks are labelled and highlighted
- **ACs:** L-4.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. Go to `/lessons/l1-first-session`.
  2. Read the visible label of each block; count highlighted token spans inside `blk-bash` and `blk-json`.
- **Expected:** Labels: "bash", "settings.json", and for `blk-plain` a neutral label ("text" or "code"; AMB-C9). `blk-bash` and `blk-json` each contain > 1 token element with a syntax class/colour; `blk-plain` has no highlighting but still renders and copies.

### TC-C-41: Clipboard denied falls back to selection and hint
- **ACs:** L-4.1, S9-21
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `fx-base`; init script overriding `navigator.clipboard.writeText = () => Promise.reject(new DOMException('denied','NotAllowedError'))`.
- **Steps:**
  1. Click the copy button of `blk-bash`.
  2. Read `window.getSelection().toString()` and the status region.
- **Expected:** Selection equals the exact `blk-bash` text. Status text is "Press ⌘C to copy". Text "Copied" does not appear. No uncaught promise rejection (`pageerror`).
- **Notes:** Primitive-level behavior is WS-A; this is the lesson integration.

## Suite 8: Mark complete (L-5)

### TC-C-42: Mark complete writes ISO timestamp and changes the button
- **ACs:** L-5.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-empty`
- **Steps:**
  1. Go to `/lessons/l1-first-session`; click `getByRole('button', { name: 'Mark complete' })`.
  2. `readProgress(page)`.
- **Expected:** `lessons["l1-first-session"].completedAt` matches `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/` and `Date.parse` is within 5s of now. Button area now shows "Completed ✓ · Undo", with `getByRole('button', { name: 'Undo' })` present. Focus moves to the Undo button (or stays on the replaced control's successor; never lost to `body`).

### TC-C-43: Curriculum reflects completion without a reload
- **ACs:** L-5.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-empty`
- **Steps:**
  1. Go to `/lessons/l1-first-session`; set `window.__spa='1'`.
  2. Click "Mark complete".
  3. Navigate to `/curriculum` by clicking an in-app link (client navigation).
  4. Separately: open `/curriculum` in a second tab of the same context before step 2 and observe it after step 2.
- **Expected:** Step 3: `window.__spa==='1'`; Level 1 shows "1 / 2" and row "Completed". Step 4: the second tab updates to "1 / 2" without a reload (via `storage` event). 
- **Notes:** Cross-tab expectation is AMB-C10; mark P1 if the decision is "same tab only".

### TC-C-44: Undo removes the entry
- **ACs:** L-5.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-one-complete`
- **Steps:**
  1. Go to `/lessons/l1-first-session`; confirm "Completed ✓ · Undo".
  2. Click "Undo"; `readProgress(page)`.
  3. Reload.
- **Expected:** Step 2: `"l1-first-session" in lessons === false` (key deleted, not set to null). Button reads "Mark complete". Step 3: still "Mark complete".

### TC-C-45: Double-click does not create inconsistent state
- **ACs:** L-5.1, L-5.2
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`, `ls-empty`
- **Steps:**
  1. `dblclick` "Mark complete".
- **Expected:** Final state is exactly one of: completed (entry present, button "Completed ✓ · Undo") or not completed (entry absent, "Mark complete"); the UI and storage agree. No console errors.

## Suite 9: Previous/next (L-6)

### TC-C-46: First lesson has no Previous; Next goes to sort 2
- **ACs:** L-6.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. Go to `/lessons/l1-first-session`; inspect `getByRole('navigation', { name: 'Lesson' })`.
- **Expected:** No "Previous" link. "Next" link `href="/lessons/l1-permissions"` with the lesson title in its accessible name.

### TC-C-47: Last lesson of L1 links Next to first lesson of L2
- **ACs:** L-6.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. Go to `/lessons/l1-permissions`.
  2. Go to `/lessons/l2-context-files`.
- **Expected:** Step 1: Next `href="/lessons/l2-context-files"`, Previous `href="/lessons/l1-first-session"`. Step 2: Previous `href="/lessons/l1-permissions"` (crosses back to L1).

### TC-C-48: Last lesson of the last level shows "Back to curriculum"; archived is never Next
- **ACs:** L-6.1, C-1.3
- **Level:** e2e
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base` (`l2-memory` sort 2 is the last active lesson; archived `l2-retired` sort 3)
- **Steps:**
  1. Go to `/lessons/l2-memory`.
- **Expected:** No "Next" link. A link "Back to curriculum" with `href="/curriculum"`. No link to `/lessons/l2-retired` anywhere on the page.
- **Notes:** PRD says "L5's last lesson"; the fixture's last level is L2 (AMB-01). The unit analogue TC-C-49 covers L5.

### TC-C-49: Prev/next computation across 5 levels
- **ACs:** L-6.1
- **Level:** unit
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-curriculum-5` passed to the pure prev/next helper.
- **Steps:**
  1. Compute for: last lesson of L1, L2, L3, L4; last lesson of L5; first lesson of L1.
- **Expected:** Ln last → first of Ln+1 for n=1..4; L5 last → `{ kind: 'back-to-curriculum' }`; L1 first → no previous. Archived lessons skipped.

## Suite 10: Safe markdown (L-7)

### TC-C-50: Raw HTML in the lesson body renders as escaped text
- **ACs:** L-7.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Security
- **Preconditions / fixtures:** `fx-base` (`l2-memory` concept contains `<script>window.__xss=1</script>` and `<img src=x onerror="window.__xss=2">`)
- **Steps:**
  1. Register `page.on('dialog')` and `page.on('pageerror')`.
  2. Go to `/lessons/l2-memory`; wait 1s after load.
  3. `page.evaluate(() => window.__xss)`; count `script` elements inside `main` and `img[src="x"]` in the document.
  4. `getByText('<script>window.__xss=1</script>')`.
- **Expected:** `window.__xss` is `undefined`. No `script` inside `main`; no `img` with `src="x"`. The literal text `<script>window.__xss=1</script>` is visible on the page. No dialog.

### TC-C-51: Markdown sanitisation unit matrix
- **ACs:** L-7.1, L-7.2
- **Level:** unit
- **Priority:** P0
- **Category:** Security
- **Preconditions / fixtures:** the markdown render function with inputs:
  `<iframe src="https://evil">`, `<a href="x" onclick="y">t</a>`, `[t](javascript:alert(1))`, `[t](JAVASCRIPT:alert(1))`, `[t](data:text/html,<b>)`, `![i](javascript:alert(1))`, `<svg onload=alert(1)>`, `<style>body{display:none}</style>`.
- **Steps:**
  1. Render each; inspect the output DOM.
- **Expected:** No `iframe`, `svg`, `style`, or any `on*` attribute. Raw-HTML inputs appear as text. `javascript:` / `data:` links render as plain text or an `a` without `href` (not clickable); images with such `src` are not rendered.

### TC-C-52: External links open in a new tab with safe rel; internal links do not
- **ACs:** L-7.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Security
- **Preconditions / fixtures:** `fx-base` (`l1-first-session` concept links to `https://docs.anthropic.com/` and `/lessons/l1-permissions`)
- **Steps:**
  1. Go to `/lessons/l1-first-session`; inspect both links.
  2. Click the external link with a `context.waitForEvent('page')` listener.
- **Expected:** External: `target="_blank"`, `rel` contains both `noopener` and `noreferrer`; clicking opens a new page and the original page URL is unchanged; `newPage.evaluate(() => window.opener)` is `null`. Internal: no `target`, no forced `rel`; opens in the same tab.
- **Notes:** Whether the external link announces "opens in a new tab" to screen readers: AMB-C11.

## Suite 11: Bookmark toggle (L-8, header only)

### TC-C-53: Bookmark toggle in the lesson header persists
- **ACs:** L-8.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-empty`
- **Steps:**
  1. Go to `/lessons/l2-context-files`.
  2. Locate `getByRole('button', { name: 'Bookmark lesson' })` inside the header region; assert `aria-pressed="false"`.
  3. Click; `readProgress(page)`; reload.
  4. Click again.
- **Expected:** Step 2: toggle is inside the header (not in the tabs, exercise or footer). Step 3: `aria-pressed="true"`, `bookmarks.lessons` contains `l2-context-files` exactly once; still pressed after reload. Step 4: pressed false, entry removed. The `/bookmarks` listing is WS-D.

## Suite 12: Exercise panel (E-1–E-3)

### TC-C-54: Exercise panel shows all required fields (automated verify)
- **ACs:** E-1.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; context with clipboard permissions.
- **Steps:**
  1. Go to `/lessons/l1-first-session`; scope to `getByRole('region', { name: /^Exercise/ })`.
  2. Read title, goal, repo path; click the setup command's copy button and read clipboard; click the verify command's copy button and read clipboard.
- **Expected:** Title and goal from `ex-fx-auto`. Repo path text `exercises/ex-fx-auto/starter`. Setup clipboard equals the seeded `setup_cmd` exactly (for the fixture: `cp -r exercises/ex-fx-auto/starter ~/fm-ex/ex-fx-auto && cd ~/fm-ex/ex-fx-auto && npm i`). Verify clipboard equals `npm test`. Checklist with 3 checkboxes present.

### TC-C-55: Manual exercise shows "Manual verification" and no verify copy button
- **ACs:** E-1.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. Go to `/lessons/l2-context-files`; scope to the exercise region.
- **Expected:** Text "Manual verification" present. Copy buttons exist for setup only (no verify copy button, no empty code block, no text "null").

### TC-C-56: Starter prompts live in tabs synchronised with the tool tabs
- **ACs:** E-1.2, L-2.3
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-empty`
- **Steps:**
  1. Go to `/lessons/l1-first-session`. In the exercise region, find its tablist (a second `tablist`, e.g. name "Starting prompt").
  2. Read the visible prompt.
  3. Click the main "Codex CLI" tab; read the exercise prompt panel.
  4. Click the exercise tablist's "Claude Code" tab; read the main tablist selection and `readProgress(page).prefs.tool`.
- **Expected:** Step 2: "Claude prompt fx". Step 3: "Codex prompt fx" without extra clicks. Step 4: main tabs switch to Claude Code; `prefs.tool === "claude"`; URL `?tool=claude`. Both tablists pass the TC-C-21 ARIA checks, with unique `id`s (no duplicate ids on the page).
- **Notes:** AMB-15.

### TC-C-57: Checklist items are native checkboxes with labels and persist
- **ACs:** E-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-empty`
- **Steps:**
  1. Go to `/lessons/l1-first-session`.
  2. Check `getByRole('checkbox', { name: 'Test is green' })` by clicking its **label text**; press Space on "No test files edited" after tabbing to it.
  3. `readProgress(page)`; reload.
- **Expected:** Elements are `input[type=checkbox]` (tag name `INPUT`). Storage: `checklists["ex-fx-auto"] = { c1: true, c2: true }` (c3 absent or false). After reload, "Test is green" and "No test files edited" are checked, "Diff reviewed" unchecked.

### TC-C-58: Reworded item keeps state (stable IDs)
- **ACs:** E-2.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; `seedProgress` with `checklists: { "ex-fx-auto": { c1: true } }`; service-role update of `exercises.checklist` for `ex-fx-auto` setting c1's text to "Tests are green (reworded)"; reset DB after.
- **Steps:**
  1. Go to `/lessons/l1-first-session`.
- **Expected:** `getByRole('checkbox', { name: 'Tests are green (reworded)' })` is checked.

### TC-C-59: Removed and unknown item IDs are ignored in display and count
- **ACs:** E-2.2, S9-11
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`, `ls-orphans` (`ex-fx-auto: { c1: true, zzz: true }`)
- **Steps:**
  1. Go to `/lessons/l1-first-session`; read the checklist count text (e.g. "1 of 3 done") and checkbox count.
  2. Check c2 and c3.
- **Expected:** Step 1: 3 checkboxes; count "1 of 3", not "2 of 3" or "2 of 4". No row for `zzz`, no notice, no console error. Step 2: "Exercise complete" shows (3 of 3 current items), even though `zzz` remains in storage.

### TC-C-60: All checked shows "Exercise complete" but does not complete the lesson
- **ACs:** E-2.3, L-5.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-empty`
- **Steps:**
  1. Go to `/lessons/l2-context-files`; check "CLAUDE.md written" and "AGENTS.md mirrors it".
  2. `readProgress(page)`; read the lesson header button.
  3. Uncheck one item.
- **Expected:** Step 2: panel shows "Exercise complete"; `lessons["l2-context-files"]` absent; header button still "Mark complete". Step 3: "Exercise complete" disappears.

### TC-C-61: Reference solution disclosure collapsed by default
- **ACs:** E-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; clipboard permissions.
- **Steps:**
  1. Go to `/lessons/l1-first-session`.
  2. Read `getByRole('button', { name: 'Compare with reference solution' })` `aria-expanded`; check the solution path is hidden.
  3. Press Enter on the button (keyboard); read contents; copy the diff command.
  4. Press Space to collapse.
- **Expected:** Step 2: `aria-expanded="false"`, solution content not visible. Step 3: `aria-expanded="true"`; shows `exercises/ex-fx-auto/solution`; clipboard equals exactly `git diff --no-index exercises/ex-fx-auto/starter exercises/ex-fx-auto/solution`. Step 4: collapsed again. Native `details/summary` is acceptable if it exposes the same expanded state.

### TC-C-62: Solution notes count 2–5
- **ACs:** E-3.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. Expand the disclosure on `/lessons/l1-first-session` and `/lessons/l2-context-files`; count items under "What the reference solution does differently".
- **Expected:** 3 and 2 respectively, texts matching the fixture, rendered as plain text.

## Suite 13: Exercises index (E-5)

### TC-C-63: `/exercises` lists every exercise with level, lesson link, verify type and progress
- **ACs:** E-5.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; `seedProgress` with `checklists: { "ex-fx-auto": { c1: true, c2: true } }`
- **Steps:**
  1. Go to `/exercises`, wait for hydration.
- **Expected:** Exactly 2 entries. `ex-fx-auto`: Level 1, link to `/lessons/l1-first-session`, verify type "Automated", progress "2 / 3". `ex-fx-manual`: Level 2, link to `/lessons/l2-context-files`, "Manual", "0 / 2". No archived exercises.

## Suite 14: Curriculum and lesson states (§9)

### TC-C-64: Curriculum empty state
- **ACs:** S9-02
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-no-content`
- **Steps:**
  1. Go to `/curriculum`.
- **Expected:** HTTP 200. Text "No lessons seeded yet. Run `npm run seed`." with the command in a copyable code element. No level regions, no console errors.

### TC-C-65: Curriculum loading skeleton matches final layout
- **ACs:** S9-03, D-4.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Perf
- **Preconditions / fixtures:** `fx-base`; route data delayed (Supabase request intercepted with a 1.5s delay via the `FM_TEST_MODE` delay hook or `page.route` on the REST call if fetched client-side; AMB-C12).
- **Steps:**
  1. Go to `/curriculum`; capture `getByTestId('curriculum-skeleton')` while loading.
  2. Observe layout-shift entries (`PerformanceObserver('layout-shift')`) until content renders.
- **Expected:** Skeleton visible during the delay with `aria-busy="true"` on its container; skeleton rows replaced in place; cumulative layout shift < 0.05.

### TC-C-66: Curriculum error boundary with retry
- **ACs:** S9-04
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `fx-base`; test hook that makes the curriculum query throw once (e.g. cookie `fm_test_fail=curriculum` under `FM_TEST_MODE=1`; AMB-C12).
- **Steps:**
  1. Go to `/curriculum` with the failure cookie; read the page.
  2. Remove the cookie; click `getByRole('button', { name: 'Retry' })`.
- **Expected:** Step 1: `getByRole('alert')` with an error message, a Retry button, site nav still rendered, no stack trace or SQL text in the DOM. Step 2: curriculum renders with 2 levels.
- **Notes:** DB-down full page (S9-01) is WS-A/M2.

### TC-C-67: Unknown and archived lesson slugs return 404
- **ACs:** S9-05, C-1.3
- **Level:** e2e
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** `fx-base`
- **Steps:**
  1. `page.goto('/lessons/does-not-exist')`; record response status.
  2. `page.goto('/lessons/l2-retired')`.
  3. `page.goto('/lessons/L1-FIRST-SESSION')` and `/lessons/%3Cscript%3E`.
- **Expected:** All return HTTP 404 and render the branded not-found page with `getByRole('link', { name: /curriculum/i })` `href="/curriculum"`. The archived lesson's title and body do not appear. The raw slug is not reflected unescaped.
- **Notes:** Case-sensitivity of slugs: AMB-C7.

### TC-C-68: Lesson loading skeleton
- **ACs:** S9-06
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** as TC-C-65 on `/lessons/l1-first-session`
- **Steps:**
  1. Navigate client-side from `/curriculum` to the lesson with the delay hook on.
- **Expected:** `getByTestId('lesson-skeleton')` visible with `aria-busy="true"` until content; CLS < 0.05.

### TC-C-69: Lesson error boundary
- **ACs:** S9-07
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** failure hook `fm_test_fail=lesson`
- **Steps:**
  1. Go to `/lessons/l1-first-session`; then clear the hook and click Retry.
- **Expected:** `getByRole('alert')` with Retry; no stack trace; retry renders the lesson.

### TC-C-70: SSR HTML contains no completion state (no "not started" flash)
- **ACs:** S9-09, P-5.1, C-1.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; `ls-one-complete` in the browser context.
- **Steps:**
  1. `request.get('/curriculum')` and `request.get('/lessons/l1-first-session')`; inspect raw HTML.
  2. In the browser, add an init script with a `MutationObserver` recording every text node that matches `/Not started|Completed|Mark complete/` with a timestamp, before hydration completes.
  3. Go to `/curriculum` with `collectConsole(page)`.
- **Expected:** Step 1: HTML contains none of "Not started", "Completed", "Mark complete", "1 / 2", and progressbars (if SSR'd) have no `aria-valuenow` progress value other than a neutral placeholder. Step 2: for `l1-first-session`, "Not started" is never observed before "Completed". Step 3: no hydration warnings.
- **Notes:** Store-level P-5.1 is WS-D.

## Suite 15: Accessibility and responsiveness

### TC-C-71: axe on curriculum and lesson in both tab states
- **ACs:** D-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`, `ls-one-complete`, `@axe-core/playwright`, tags `wcag2a, wcag2aa, wcag21aa, wcag22aa`
- **Steps:**
  1. Run axe on `/curriculum`, `/exercises`.
  2. For `l1-first-session`, `l1-permissions`: run axe with `?tool=claude`, then `?tool=codex`, then with the reference disclosure expanded.
- **Expected:** 0 violations with impact `serious` or `critical` in every run.

### TC-C-72: No horizontal page scroll; code blocks scroll within themselves
- **ACs:** D-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Responsive
- **Preconditions / fixtures:** `fx-base`; viewports 360×800, 768×1024, 1024×768, 1440×900.
- **Steps:**
  1. For each width, load `/curriculum`, `/lessons/l1-first-session`, `/exercises`.
  2. Evaluate `document.documentElement.scrollWidth <= window.innerWidth`.
  3. On the lesson, for `blk-plain`'s `pre`: evaluate `scrollWidth > clientWidth` and computed `overflow-x`.
- **Expected:** Step 2 true everywhere. Step 3 at 360: `pre` overflows internally with `overflow-x` `auto` or `scroll`, and the `pre` is keyboard-focusable (`tabindex="0"`) so it can be scrolled without a mouse.

### TC-C-73: Tabs remain tabs below 768px
- **ACs:** D-3.2, L-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Responsive
- **Preconditions / fixtures:** `fx-base`; viewport 360×800 with `hasTouch: true`.
- **Steps:**
  1. Go to `/lessons/l1-first-session`; tap "Codex CLI".
  2. Repeat TC-C-22 key presses.
- **Expected:** `role=tablist` with 2 `role=tab` still present; no `aria-expanded` accordion buttons for the tools. Both tab labels fully visible (not truncated to icons only). Tap switches panel; keyboard behavior identical to desktop. Each tab's bounding box ≥ 44×44 (touch, AMB-11).

### TC-C-74: Manual responsive pass screenshots
- **ACs:** D-3.1, D-3.2, G-1
- **Level:** e2e
- **Priority:** P0
- **Category:** Responsive
- **Preconditions / fixtures:** `fx-base`, `ls-one-complete`
- **Steps:**
  1. At 360, 768 and 1440, capture full-page screenshots of `/curriculum`, `/lessons/l1-first-session?tool=claude`, `/lessons/l1-permissions?tool=codex`, `/exercises`.
- **Expected:** Screenshots attached to the WS-C PR. Reviewer confirms: header meta wraps without overlap, verified line and "May be outdated" badge readable, differences callout full width, exercise commands scroll in-block, prev/next buttons do not overlap.
- **Notes:** manual.

---

## Coverage

| AC / state | Cases |
|---|---|
| C-1.1 | TC-C-01, 02, 03 |
| C-1.2 | TC-C-04, 05, 70 |
| C-1.3 | TC-C-06, 07, 48, 67 |
| C-2.1 | TC-C-07, 09, 10, 11, 12, 13, 14 |
| C-3.1 | TC-C-08 |
| C-5.1 | TC-C-15 |
| C-5.2 | TC-C-16, 17, 18 |
| L-1.1 | TC-C-19, 20 |
| L-2.1 | TC-C-21, 22, 23, 24, 73 |
| L-2.2 | TC-C-25, 26, 30, 31 |
| L-2.3 | TC-C-28, 29, 30, 31, 56 |
| L-2.4 | TC-C-26, 27 |
| L-3.1 | TC-C-32, 33, 34 |
| L-3.2 | TC-C-35, 36 |
| L-4.1 | TC-C-37, 38, 39, 41 |
| L-4.2 | TC-C-39, 40 |
| L-5.1 | TC-C-42, 43, 45, 60 |
| L-5.2 | TC-C-44, 45 |
| L-6.1 | TC-C-46, 47, 48, 49 |
| L-7.1 | TC-C-34, 50, 51 |
| L-7.2 | TC-C-51, 52 |
| L-8.1 | TC-C-53 (header toggle; `/bookmarks` list in WS-D) |
| E-1.1 | TC-C-54, 55 |
| E-1.2 | TC-C-56 |
| E-2.1 | TC-C-57 |
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
| S9-09 | TC-C-70 |
| S9-11 | TC-C-59 |
| S9-21 | TC-C-41 (lesson integration) |
| D-1.2 | TC-C-21, 36 |
| D-2.1 | TC-C-71 |
| D-2.2 | TC-C-24 |
| D-3.1 | TC-C-72, 74 |
| D-3.2 | TC-C-73, 74 |
| D-4.2 | TC-C-65 |
| P-5.1 | TC-C-70 (cross-ref) |
| G-1 | TC-C-74 |

C-4.x (Continue CTA on `/`) is M2. `/bookmarks` listing (L-8.1 second half) is WS-D. S-3.1 (no-redeploy) is B/M2.

## Ambiguities raised in this file

| ID | Ambiguity | Assumed here |
|---|---|---|
| AMB-C1 | C-2.1 `aria-valuenow` for non-integer percentages (1/3): integer `33` or `33.33`? Could also use `aria-valuemax` = lesson count with `aria-valuenow` = completed count, which would make the PRD's "=50" false. | Percent scale 0–100, integer, half-up rounding. |
| AMB-C2 | Level with 0 active lessons (all archived): render "0 / 0", hide the progressbar, or hide the whole level? | No crash; either "0 / 0" with valuenow 0 or no progressbar. |
| AMB-C3 | C-5.2 "more than 60 days" counted in which time zone, and date vs timestamp arithmetic. | Calendar days between `last_verified_on` and today's Manila date; > 60 is outdated (AMB-04). |
| AMB-C4 | PRD §7 gives every lesson an exercise, but `fx-base` `l1-permissions` has none. Is a lesson without an exercise valid (seed) and how does the panel slot render? | Valid; panel omitted, order otherwise unchanged. |
| AMB-C5 | L-2.1 does not say automatic vs manual activation (arrow moves focus only, or also selects). URL/pref sync depends on it. | Automatic activation. |
| AMB-C6 | L-2.4 ≤ 50px scroll drift is unachievable if the new panel is much shorter and the browser clamps scroll. | Fixture bodies are long enough; implementation may reserve min-height. |
| AMB-C7 | Case sensitivity of `?tool=` values and lesson slugs (`CODEX`, `L1-FIRST-SESSION`). | Exact lowercase match only; others treated as invalid (tool) or 404 (slug). |
| AMB-C8 | Notice wording uses "<tool>": "Codex CLI" (tab label) or "Codex" (as in the C-5.1 line "Codex vY")? | Tab label names ("Claude Code", "Codex CLI"). |
| AMB-C9 | L-4.2 label for a fenced block with no language or filename. | Neutral label "text" (or "code"); block still copyable. |
| AMB-C10 | L-5.1 "curriculum page reflects the change without a reload": same-tab client navigation only, or also a curriculum page already open in another tab? | Same tab is P0; cross-tab via `storage` event is P1. |
| AMB-C11 | L-7.2 new-tab links: should they carry an accessible "opens in a new tab" hint (WCAG G201)? | Recommended; not asserted as P0. |
| AMB-C12 | Loading-skeleton and error-boundary cases need a way to delay or fail a server query on demand; no hook exists (extends AMB-03). | `FM_TEST_MODE=1` cookies `fm_test_delay=<route>:<ms>` and `fm_test_fail=<route>`. |
| AMB-C13 | Fixture code-block bodies are not in S-5; this file pins `blk-bash`, `blk-json`, `blk-plain` for WS-B. | WS-B seeds them verbatim. |
