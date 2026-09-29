# WS-A: Design system and shell

- **Owns:** `src/components/ui/`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/not-found.tsx`, `src/app/error.tsx`, `public/fonts/`.
- **Covers here:** tokens, contrast, fonts, primitives (Tabs, CodeBlock, ProgressBar, Checkbox, Notice, Skeleton, EmptyState), nav shell, focus, motion, hit targets, dark mode, DB-down page, 404/error.
- **Out of scope:** how lessons wire Tabs to URL/`prefs.tool` (ws-c), route-level axe/Lighthouse/LCP sweeps (ws-m2), progress banners' storage logic (ws-d).

Primitive cases run on a test-only route `/__ui` (rendered only when `FM_TEST_MODE=1`; see AMB-A1) that mounts every primitive with the fixed props named in each case. Component-level cases use Vitest + React Testing Library + `@testing-library/user-event` with `jsdom`, unless the case needs layout or computed style, in which case it is a Playwright e2e on `/__ui`.

Contrast ratios below were computed with the WCAG 2.x relative-luminance formula and are the expected values tests assert (rounded to 2 decimals):

| Foreground | on white `#ffffff` | on muted `#f9f9f9` |
|---|---|---|
| ink `#282943` | 14.11 | 13.40 |
| black-ink `#131313` | 18.58 | 17.65 |
| accent `#424bd1` | 6.65 | 6.31 |
| accent-2 `#ec612a` | 3.33 | 3.16 |
| date `#8e8e8f` | 3.27 | 3.11 |
| candidate metadata token `#6b6b6c` | 5.32 | 5.06 |

---

## Suite A1: Tokens and brand

### TC-A-01: Token values match the PRD table
- **ACs:** D-1.1
- **Level:** unit
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** Token source exported from `src/components/ui/tokens.ts` (or parsed from `globals.css` custom properties).
- **Steps:**
  1. Import the token map (or parse `:root` custom properties from `src/app/globals.css`).
  2. Compare each named token to the expected value.
- **Expected:** `ink=#282943`, `black-ink=#131313`, `accent=#424bd1`, `accent-2=#ec612a`, `muted=#f9f9f9`, `stroke=#f0f0f0`, `line=#e4e4e4`, `divider=#e8e8e8`. A new metadata token (proposed name `meta`) exists and is not `#8e8e8f`. Values are lower-case 6-digit hex.
- **Notes:** If the WS-A live-site re-verification (TC-A-03) changes a value, this test and the PRD table change in the same PR.

### TC-A-02: Contrast ratios of text tokens
- **ACs:** D-1.1, D-2.1
- **Level:** unit
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** Token map; a pure `contrastRatio(fg, bg)` helper (WCAG 2.x).
- **Steps:**
  1. Compute ratios for each row of the table at the top of this file.
  2. Compute the metadata token on white and on muted.
- **Expected:** Ratios equal the table to 2 decimals. `ink`, `black-ink`, `accent` ≥ 4.5 on both backgrounds. `meta` ≥ 4.5 on both white and muted (e.g. `#6b6b6c` → 5.32 / 5.06). `accent-2` (3.33) and `date` (3.27) are recorded as < 4.5 and are asserted by TC-A-04 to never be used for body text.
- **Notes:** Guards against someone "tuning" a token past AA.

### TC-A-03: Live-site token re-verification (manual)
- **ACs:** D-1.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** Browser on https://firstmate.tech, DevTools.
- **Steps:**
  1. On the home page, inspect body text, headings, primary link, primary button, card background, borders and date text.
  2. Record computed `color` / `background-color` / `border-color` and `font-family`.
  3. Compare with TC-A-01 values.
- **Expected:** Every value matches or the differences are listed in the WS-A PR with screenshots, and TC-A-01 is updated.
- **Notes:** Manual. See AMB-19.

### TC-A-04: accent-2 and date gray never used for body-size text
- **ACs:** D-1.1
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`; routes `/`, `/curriculum`, `/lessons/l1-first-session`, `/news`, `/news/archive`, `/__ui`.
- **Steps:**
  1. On each route, evaluate in page: for every element with a non-empty own text node, read computed `color`, `font-size`, `font-weight`.
  2. Collect elements whose color is `rgb(236, 97, 42)` (accent-2) or `rgb(142, 142, 143)` (date).
- **Expected:** No element uses `rgb(142, 142, 143)` for text at all. Elements using `rgb(236, 97, 42)` have font-size ≥ 24px, or ≥ 18.66px with weight ≥ 700 (WCAG large text), or are `aria-hidden="true"` decorative. Metadata text (dates, "Verified …", source names) uses the `meta` token color.
- **Notes:** Complements TC-A-02 (values) with usage.

### TC-A-05: Satoshi self-hosted, three weights, no third-party font request
- **ACs:** D-1.1, D-4.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Perf
- **Preconditions / fixtures:** `fx-base`, `next start`.
- **Steps:**
  1. Record all network requests while loading `/`.
  2. Evaluate `document.fonts` after `document.fonts.ready`.
  3. Read computed `font-family` of `body`, an `h1`, and a `pre code`.
- **Expected:** Font requests are only same-origin `.woff2` files under `/fonts/` (or Next's `/_next/static/media/` from `next/font/local`); zero requests to `fonts.googleapis.com`, `fonts.gstatic.com` or any other host. Loaded faces include Satoshi weights 400, 500 and 700 (status `loaded` for weights used on the page). `body` and `h1` font-family starts with Satoshi; `pre code` resolves to a monospace stack (first family not Satoshi, list ends in `monospace`).

### TC-A-06: No layout shift from web fonts
- **ACs:** D-4.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Perf
- **Preconditions / fixtures:** `fx-base`, `next start`, cache disabled; network throttled to "Fast 3G" for the font requests only (route delay 800ms on `*.woff2`).
- **Steps:**
  1. Install a `PerformanceObserver` for `layout-shift` via init script.
  2. Load `/curriculum` and `/lessons/l1-first-session`; wait 3s after `document.fonts.ready`.
  3. Sum `value` of entries with `hadRecentInput=false`.
  4. Inspect the `@font-face` rules / `<link rel="preload">` in the HTML.
- **Expected:** Cumulative layout shift < 0.05 on both routes. The primary Satoshi weight (400) is preloaded (`<link rel="preload" as="font" type="font/woff2" crossorigin>`) and `@font-face` uses `font-display: swap` or `optional` with a metric-adjusted fallback (`size-adjust`/`ascent-override`) so the swap does not move text.

### TC-A-07: Tool identity uses text and icon, never color alone
- **ACs:** D-1.2
- **Level:** unit
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `<Tabs>` rendered with items `[{id:"claude", label:"Claude Code", icon:<ClaudeIcon/>}, {id:"codex", label:"Codex CLI", icon:<CodexIcon/>}]`, active `claude`.
- **Steps:**
  1. Query `getByRole('tab', { name: 'Claude Code' })` and `getByRole('tab', { name: 'Codex CLI' })`.
  2. Inspect each tab's children.
- **Expected:** Each tab contains visible text equal to its label and an `svg` icon with `aria-hidden="true"` (icon does not duplicate the accessible name). Active tab has `aria-selected="true"`; the active state is also indicated by a non-color cue (underline/border of ≥ 2px, verified in TC-A-08).

### TC-A-08: Active tab uses accent plus a non-color indicator; inactive neutral
- **ACs:** D-1.2
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `/__ui` Tabs demo, active = Claude Code.
- **Steps:**
  1. Read computed styles of both tabs.
  2. Emulate grayscale (`page.emulateMedia` is not enough; take a screenshot and compare active vs inactive with `filter: grayscale(1)` applied to `html`).
- **Expected:** Active tab: indicator (border-bottom or box-shadow) color `rgb(66, 75, 209)` and ≥ 2px thick. Inactive tab: no accent color on text or indicator. In the grayscale screenshot, active and inactive tabs still differ visibly (indicator present only on the active tab).

---

## Suite A2: Tabs primitive

### TC-A-09: Tabs ARIA roles and relationships
- **ACs:** L-2.1
- **Level:** unit
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `<Tabs label="Tool">` with the two items from TC-A-07, panels "Claude panel text" and "Codex panel text", active `claude`.
- **Steps:**
  1. Query `getByRole('tablist', { name: 'Tool' })`, both tabs, `getByRole('tabpanel')`.
- **Expected:** Exactly 1 tablist, 2 tabs, 1 visible tabpanel. Active tab `aria-selected="true"`, `tabindex="0"`; inactive `aria-selected="false"`, `tabindex="-1"`. Each tab has `aria-controls` = its panel id; the panel has `aria-labelledby` = active tab id and is named "Claude Code". Inactive panel is not in the accessibility tree (`hidden` or unmounted).

### TC-A-10: Arrow, Home and End keys move focus with wrap
- **ACs:** L-2.1
- **Level:** unit
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** As TC-A-09, plus a third test-only item "Tool C" to exercise Home/End on > 2 tabs.
- **Steps:**
  1. Focus "Claude Code"; press ArrowRight.
  2. Press ArrowRight twice.
  3. Press ArrowLeft.
  4. Press End, then Home.
- **Expected:** Step 1 focus on "Codex CLI". Step 2 focus on "Tool C", then wraps to "Claude Code". Step 3 wraps to "Tool C". Step 4 End → "Tool C", Home → "Claude Code". After each move the focused tab is the one with `tabindex="0"` and all others `-1`. ArrowUp/ArrowDown do not move focus (horizontal tablist).
- **Notes:** Activation model: automatic (selection follows focus) or manual (Enter/Space). The PRD does not say; see AMB-A2. Assert whichever is chosen, and that `onChange` fires once per selection change.

### TC-A-11: Tab key enters the tablist once and moves to the panel
- **ACs:** L-2.1, D-2.2
- **Level:** unit
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** Button "Before" rendered before `<Tabs>`, active tab "Codex CLI".
- **Steps:**
  1. Focus "Before"; press Tab; press Tab again; press Shift+Tab twice.
- **Expected:** Tab 1 focuses "Codex CLI" (the active tab, not the first). Tab 2 focuses the tabpanel (it has `tabindex="0"` when it contains no focusable element) or its first focusable child. Shift+Tab returns to "Codex CLI", then "Before". "Claude Code" is never a Tab stop.

### TC-A-12: Tabs stay tabs below 768px
- **ACs:** D-3.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Responsive
- **Preconditions / fixtures:** `/__ui`, viewports 360×740 and 767×900.
- **Steps:**
  1. At each viewport, query the Tool tablist.
  2. Check both tabs are visible and within the viewport horizontally.
  3. Press ArrowRight on the focused active tab.
- **Expected:** `role=tablist` with 2 `role=tab` still present; no `button[aria-expanded]` disclosure/accordion headers replace them. Both tab labels fully visible (not truncated to icon-only); tablist `scrollWidth <= clientWidth` at 360. Arrow navigation still works.

---

## Suite A3: CodeBlock primitive

### TC-A-13: Copy writes the exact block text
- **ACs:** L-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `/__ui` renders CodeBlocks with these exact sources; Chromium context with `grantPermissions(['clipboard-read','clipboard-write'])`.
  - `block-bash`: `npm run seed\nnpm run news:run -- --dry-run` (no trailing newline in source)
  - `block-trailing`: `echo hi\n` (source ends in one newline)
  - `block-unicode`: `echo "Maligayang pagdating — ✓ 日本語"`
  - `block-whitespace`: `\tindented\n    four spaces\n\n` (tab, spaces, blank line)
- **Steps:**
  1. For each block, click its `getByRole('button', { name: /^Copy/ })`.
  2. Read `navigator.clipboard.readText()`.
- **Expected:** Clipboard text equals the source string byte-for-byte after the markdown fence's single terminating newline is removed (so `block-trailing` yields `echo hi`, per AMB-A3), with tabs, internal blank lines and unicode preserved. No line numbers, no prompt characters, no button label text included.

### TC-A-14: Copy announces "Copied" via polite live region
- **ACs:** L-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** As TC-A-13.
- **Steps:**
  1. Before clicking, read `getByRole('status')` text.
  2. Click Copy on `block-bash`.
  3. Read the status region; wait 3s; read again.
- **Expected:** Live region exists in the DOM before the click (present at mount, empty) with `aria-live="polite"`. After click its text is exactly `Copied`. It clears (or resets) within 3s so a later copy is re-announced. The button's accessible name is "Copy code" (or "Copy settings.json" when a filename exists) both before and after.

### TC-A-15: Repeated and cross-block copies re-announce correctly
- **ACs:** L-4.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** As TC-A-13.
- **Steps:**
  1. Click Copy on `block-bash` 3 times within 1s.
  2. Click Copy on `block-unicode`.
  3. Read clipboard and status region.
- **Expected:** No console errors. Clipboard holds `block-unicode` text. The status region reads `Copied` (a single region, not one per block that stacks announcements; at most one element with `role=status` per CodeBlock or one page-level region, never duplicated text like "CopiedCopied").

### TC-A-16: Clipboard denied selects the code and shows fallback
- **ACs:** S9-21, L-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `/__ui`; init script overriding `navigator.clipboard.writeText` to return `Promise.reject(new DOMException('denied','NotAllowedError'))`.
- **Steps:**
  1. Click Copy on `block-bash`.
  2. Read `window.getSelection().toString()` and the status region.
- **Expected:** Selection equals the `block-bash` text exactly. Visible text and status region read `Press ⌘C to copy` (see AMB-A4 for non-Mac). No "Copied" announcement, no uncaught promise rejection (`pageerror` count 0).
- **Notes:** Also run with `navigator.clipboard` undefined (insecure context): same expected.

### TC-A-17: Language and filename labels
- **ACs:** L-4.2
- **Level:** unit
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** CodeBlocks: (a) lang `bash`; (b) lang `json` with `title="settings.json"`; (c) no language.
- **Steps:**
  1. Render each; read visible label and the figure/group accessible name.
- **Expected:** (a) label `bash`; (b) label `settings.json` (filename wins over language); (c) label `text` (AMB-A5). Each block is wrapped in `figure` (or `role=group`) whose accessible name equals the label, and the copy button is inside it.

### TC-A-18: Syntax highlighting produces tokens with AA contrast
- **ACs:** L-4.2, D-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `/__ui` block (b) with `{"permissions": {"allow": ["Bash(npm test)"]}, "n": 1}`.
- **Steps:**
  1. Count child spans inside `pre code` that carry distinct computed colors.
  2. For every token span, compute contrast against the code block's background (light and dark scheme).
- **Expected:** ≥ 3 distinct token colors (string, number/boolean, punctuation/key). Every token color ≥ 4.5:1 against the block background in both schemes. Highlighting is done at render/server time (text already colored in the SSR HTML).

### TC-A-19: Long lines scroll inside the block, not the page
- **ACs:** D-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Responsive
- **Preconditions / fixtures:** `/__ui` block containing one 400-character line (`curl -sS "https://example.com/?a=` + 360 `x` + `"`); viewports 360, 768, 1024, 1440.
- **Steps:**
  1. At each width, read `document.documentElement.scrollWidth` vs `clientWidth`.
  2. Read the `pre` element's `scrollWidth`, `clientWidth` and computed `overflow-x`.
  3. Tab to the `pre` element.
- **Expected:** Page `scrollWidth <= clientWidth`. `pre` has `overflow-x: auto`, `scrollWidth > clientWidth`. The scrollable `pre` is keyboard-focusable (`tabindex="0"`) with an accessible name (label from TC-A-17) so axe `scrollable-region-focusable` passes. Copy button stays visible and not scrolled away.

---

## Suite A4: Other primitives

### TC-A-20: ProgressBar ARIA values and rounding
- **ACs:** C-2.1
- **Level:** unit
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `<ProgressBar label="Level 3" value={v} max={m}/>` with (v,m) = (2,4), (0,4), (4,4), (1,3), (0,0).
- **Steps:**
  1. Render each; query `getByRole('progressbar', { name: 'Level 3' })`.
- **Expected:** `aria-valuemin="0"`, `aria-valuemax="100"`. `aria-valuenow`: 50, 0, 100, 33 (integer, rounded half-up), 0. For (0,0) no `NaN` anywhere in attributes or text and no error. Accessible name includes "Level 3". Visual fill width equals the percentage.

### TC-A-21: Checkbox is native, labelled and keyboard-togglable
- **ACs:** E-2.1, D-2.2
- **Level:** unit
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `<Checkbox id="c1" label="Test is green" checked={false} onChange={spy}/>`.
- **Steps:**
  1. Query `getByRole('checkbox', { name: 'Test is green' })`.
  2. Tab to it; press Space. Click the label text.
- **Expected:** Element is `input[type=checkbox]` (native, not `div[role=checkbox]`). Label is associated (`for`/`id` or wrapping). Space toggles and `spy` called with `true`; clicking the label toggles again (`false`). Enter does not toggle (native behavior).

### TC-A-22: Notice is dismissible and returns focus sensibly
- **ACs:** P-2.1, S9-10
- **Level:** unit
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `<Notice tone="warning" dismissible>Saved progress was unreadable and has been reset</Notice>` after a focusable "Before" button.
- **Steps:**
  1. Query the notice by role; Tab to `getByRole('button', { name: 'Dismiss' })`; press Enter.
- **Expected:** Notice has `role="alert"` (error/warning tone) or `role="status"` (info tone), text exactly as passed. Dismiss button accessible name "Dismiss", icon `aria-hidden`. After Enter the notice is removed from the DOM and focus moves to `main` (or the previous focusable element), not to `body`. `onDismiss` fires once.

### TC-A-23: Skeleton is hidden from assistive tech and reserves final size
- **ACs:** S9-03, S9-06, S9-14
- **Level:** unit
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `<Skeleton variant="lesson-row" count={3}/>`, `<Skeleton variant="news-card" count={3}/>`, each with `data-testid="skeleton"`.
- **Steps:**
  1. Render; query the accessibility tree.
- **Expected:** Skeleton blocks are `aria-hidden="true"`; the loading container exposes one `role="status"` with text "Loading…" (visually hidden). Each variant has fixed height tokens documented (e.g. `lesson-row` 72px) that the real row matches (verified in ws-c/ws-f CLS cases). Shimmer animation stops under reduced motion (TC-A-27).

### TC-A-24: EmptyState renders message, command and action
- **ACs:** S9-02, S9-12, S9-16, S9-19
- **Level:** unit
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `<EmptyState title="No lessons seeded yet." command="npm run seed" action={{label:"Clear filters", href:"/news/archive"}}/>`.
- **Steps:**
  1. Render; query heading, code, button/link.
- **Expected:** Title text exact. Command rendered in a CodeBlock with a copy button (inherits TC-A-13 behavior). Action rendered as `link` "Clear filters" with the given href. Component renders without an action or command when props are absent (no empty button).

---

## Suite A5: Shell, navigation and focus

### TC-A-25: Skip link is the first tab stop and moves focus to main
- **ACs:** D-2.3
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`; routes `/`, `/curriculum`, `/lessons/l1-first-session`, `/news`.
- **Steps:**
  1. Load the route; press Tab once.
  2. Assert focus and visibility; press Enter; press Tab once more.
- **Expected:** Step 1 focuses `getByRole('link', { name: 'Skip to content' })`, which is visible on focus (in viewport, non-zero size, not clipped). After Enter, `document.activeElement` is `main` (`id="main"`, `tabindex="-1"`) and the URL hash is `#main`. Next Tab lands on the first focusable element inside `main`, not on the header nav.

### TC-A-26: Visible focus ring is 2px accent with 2px offset on all interactive primitives
- **ACs:** D-2.2
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `/__ui`; each primitive: Button, link, Tab, Checkbox, CodeBlock copy button, Notice dismiss, disclosure button, nav Menu button.
- **Steps:**
  1. Tab through the page (keyboard focus, so `:focus-visible` applies).
  2. For each focused element read computed `outline-style`, `outline-width`, `outline-color`, `outline-offset` (or equivalent `box-shadow`).
  3. Click one button with the mouse and read the same.
- **Expected:** Keyboard focus: `outline: 2px solid rgb(66, 75, 209)`, `outline-offset: 2px`. Never `outline: none` without a replacement. Every element in the list is reached by Tab (no element skipped, none with positive `tabindex`). Ring is not clipped by a parent `overflow: hidden` (screenshot shows full 2px ring). Mouse click focus may omit the ring.

### TC-A-27: prefers-reduced-motion disables non-essential transitions
- **ACs:** D-2.4
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `/__ui`; `page.emulateMedia({ reducedMotion: 'reduce' })` vs `'no-preference'`.
- **Steps:**
  1. With `reduce`, read computed `transition-duration` and `animation-name`/`animation-duration` of: Skeleton shimmer, Tabs indicator, mobile menu panel, disclosure, Notice enter, smooth scroll (`scroll-behavior` on `html`).
  2. Repeat with `no-preference`.
- **Expected:** With `reduce`: all durations `0s` (or ≤ `0.01ms`), `animation-name: none` for shimmer, `scroll-behavior: auto`. With `no-preference`: at least the tab indicator and menu have non-zero transitions (proves the media query, not a global kill).

### TC-A-28: Nav collapses to a Menu button with aria-expanded below 768px
- **ACs:** D-3.2, D-2.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Responsive
- **Preconditions / fixtures:** `fx-base`; route `/curriculum`; viewports 360, 767, 768, 1440.
- **Steps:**
  1. At 360: query `getByRole('button', { name: 'Menu' })`; read `aria-expanded`, `aria-controls`.
  2. Press Enter; check the nav links; press Escape.
  3. At 767 repeat step 1. At 768 and 1440, check nav links visible and no Menu button.
- **Expected:** At 360 and 767: button present, `aria-expanded="false"`, `aria-controls` points to the nav. After Enter: `aria-expanded="true"`, `getByRole('navigation', { name: 'Main' })` visible with links Curriculum, Exercises, News, Bookmarks, Progress; focus moves to the first link. Escape closes (`aria-expanded="false"`) and focus returns to the Menu button. At 768 and 1440 the links are inline and `getByRole('button', { name: 'Menu' })` has count 0.
- **Notes:** Breakpoint: "below 768px" means 767 collapses and 768 does not.

### TC-A-29: Mobile menu closes on navigation and on outside click
- **ACs:** D-3.2
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** 360×740, `/curriculum`.
- **Steps:**
  1. Open menu; click "News".
  2. Open menu; click on `main` content outside the panel.
  3. Open menu; resize to 1024.
- **Expected:** 1: route `/news`, menu closed, `aria-expanded="false"`. 2: closed, no navigation. 3: inline nav shown, no stale open panel or scroll lock left on `body` (`overflow` not `hidden`).

### TC-A-30: Hit targets ≥ 24×24 on desktop and ≥ 44×44 on touch
- **ACs:** D-2.5
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`; routes `/`, `/curriculum`, `/lessons/l1-first-session`, `/news`, `/news/archive`; contexts: 1440 no touch; 360 and 768 with `hasTouch: true, isMobile: true` (AMB-11).
- **Steps:**
  1. Collect all `a, button, input, select, summary, [role=tab], [role=checkbox]` that are visible.
  2. Read `getBoundingClientRect()` (for checkboxes, the label + input clickable area; for inline text links inside paragraphs, exempt per WCAG 2.5.8 inline exception).
- **Expected:** Desktop: every target ≥ 24×24 CSS px (or has 24px spacing per WCAG 2.5.8). Touch contexts: every non-inline target ≥ 44×44 (tabs, copy buttons, Menu, Dismiss, checkboxes incl. label, pagination links, tag chips if interactive). Report lists offending element accessible names.

### TC-A-31: Forced-colors / Windows High Contrast keeps focus and tab state visible
- **ACs:** D-2.2, D-1.2
- **Level:** e2e
- **Priority:** P1
- **Category:** A11y
- **Preconditions / fixtures:** `/__ui`, `page.emulateMedia({ forcedColors: 'active' })` (Chromium).
- **Steps:**
  1. Tab to a Button and to the active Tab; screenshot.
  2. Inspect the ProgressBar and Checkbox.
- **Expected:** Focus indicator visible (uses `outline`, which survives forced colors, not only `box-shadow`). Active tab indicator visible (border, not background-color only). ProgressBar fill visible (uses `forced-color-adjust` or border). Checkbox native control visible.

### TC-A-32: Dark mode tokens keep the same contrast guarantees
- **ACs:** D-5.1
- **Level:** e2e
- **Priority:** P1
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`; `page.emulateMedia({ colorScheme: 'dark' })`; routes `/__ui`, `/curriculum`, `/lessons/l1-first-session`, `/news`.
- **Steps:**
  1. Read computed `background-color` of `body` and `color` of body text, headings, links, metadata text, focus ring.
  2. Run axe with `color-contrast` enabled.
- **Expected:** Body background is dark (luminance < 0.1); text/background ≥ 4.5:1 for body and metadata, ≥ 3:1 for focus ring and tab indicator against adjacent colors. axe: 0 serious/critical. Switching `colorScheme` back to `light` restores light tokens without reload. No flash of light theme on first paint in dark mode (screenshot at `domcontentloaded` is dark).

### TC-A-33: axe clean on the primitives page in both tab states and both schemes
- **ACs:** D-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `/__ui`, `@axe-core/playwright` with tags `wcag2a, wcag2aa, wcag21aa, wcag22aa`.
- **Steps:**
  1. Run axe with Claude Code tab active.
  2. Click "Codex CLI"; open the disclosure, show the Notice and the mobile menu (at 360); run axe again.
  3. Repeat both in dark scheme.
- **Expected:** 0 violations with impact `serious` or `critical` in all 4 runs. Moderate/minor violations listed in the test output but not failing.

---

## Suite A6: App-wide error, 404 and error boundary

### TC-A-34: DB down shows the full-page error with exact copy and no stack trace
- **ACs:** S9-01
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `next start` with `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_URL` pointed at `http://127.0.0.1:54399` (the `supabase-down` fixture); clipboard permissions granted.
- **Steps:**
  1. Load `/curriculum`, `/lessons/l1-first-session`, `/news`, `/`.
  2. Read the visible text and the raw HTML response body.
  3. Click the copy button in the error; read clipboard.
- **Expected:** Each route shows a heading/alert containing exactly `Can't reach the local database. Run supabase start then npm run seed.` (with `supabase start` and `npm run seed` in `code`). HTML contains none of: `at `-style stack frames (`/\bat [\w.<>]+ \(/`), `ECONNREFUSED`, `54399`, `node_modules`, the service-role or anon key value, file paths. Clipboard text equals `supabase start && npm run seed` (AMB-A6). Response status is 503 (AMB-A6). Page keeps header/brand shell. No `pageerror` events.

### TC-A-35: Branded 404 for unknown routes
- **ACs:** S9-22, S9-05
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. Request `/this-route-does-not-exist` and `/lessons/l2-retired`.
  2. Read status, `<title>`, heading, links.
- **Expected:** HTTP 404 for both. Page uses the app shell (header nav, Satoshi font, skip link). Heading "Page not found" (AMB-A7). A link `getByRole('link', { name: /curriculum/i })` with href `/curriculum` is present. axe: 0 serious/critical. `<title>` contains "Not found".

### TC-A-36: Error boundary renders branded fallback and Retry recovers
- **ACs:** S9-22, S9-04, S9-07, S9-18
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `FM_TEST_MODE=1`; test route `/__ui/throw?once=1` whose server component throws `new Error("boom-secret-detail")` on the first request only (in-memory flag reset per server start, AMB-A1).
- **Steps:**
  1. Load `/__ui/throw?once=1`.
  2. Read visible text and HTML; click `getByRole('button', { name: 'Try again' })`.
- **Expected:** Fallback shows a branded heading "Something went wrong" (AMB-A7) inside the app shell, `role="alert"`, and a "Try again" button. Visible text and HTML do not include `boom-secret-detail` or any stack frame (production build shows digest only). After "Try again" the route re-renders successfully (content "Recovered") without a full page reload (`performance.navigation` count unchanged / a `window.__marker` set before the click survives). Focus moves to the recovered content's heading or `main`.

### TC-A-37: Root layout HTML semantics
- **ACs:** D-2.1, D-2.3
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`; every §8 route.
- **Steps:**
  1. Read `html[lang]`, `meta[name=viewport]`, landmark counts.
- **Expected:** `lang="en"`; viewport `width=device-width, initial-scale=1` without `maximum-scale=1` or `user-scalable=no`; exactly one `main` (`id="main"`), one `banner`, one `navigation` named "Main", one `contentinfo`; exactly one `h1` per page.

### TC-A-38: Shell has no horizontal scroll at 360/768/1024/1440 and supports 200% zoom
- **ACs:** D-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Responsive
- **Preconditions / fixtures:** `/__ui` (all primitives incl. a 60-char unbroken word in a Notice and a long filename label `a-very-long-configuration-file-name-for-testing.config.json`); widths 360, 768, 1024, 1440; plus 1280 wide with CSS zoom 200% (equivalent 640).
- **Steps:**
  1. At each width compare `document.documentElement.scrollWidth` with `clientWidth`.
  2. Screenshot for the PR (G-1).
- **Expected:** `scrollWidth <= clientWidth` at every width and at 200% zoom. Long words wrap (`overflow-wrap: anywhere`) inside Notices; filename labels truncate with ellipsis and full name available in the accessible name.

---

## Coverage

| AC | Cases |
|---|---|
| D-1.1 | TC-A-01, TC-A-02, TC-A-03, TC-A-04, TC-A-05 |
| D-1.2 | TC-A-07, TC-A-08, TC-A-31 |
| D-2.1 | TC-A-02, TC-A-18, TC-A-33, TC-A-37 |
| D-2.2 | TC-A-11, TC-A-21, TC-A-26, TC-A-28, TC-A-31 |
| D-2.3 | TC-A-25, TC-A-37 |
| D-2.4 | TC-A-27 |
| D-2.5 | TC-A-30 |
| D-3.1 | TC-A-19, TC-A-38 |
| D-3.2 | TC-A-12, TC-A-28, TC-A-29 |
| D-4.2 | TC-A-05, TC-A-06 |
| D-5.1 | TC-A-32 |
| L-2.1 (primitive) | TC-A-09, TC-A-10, TC-A-11 |
| L-4.1 (primitive) | TC-A-13, TC-A-14, TC-A-15, TC-A-16 |
| L-4.2 (primitive) | TC-A-17, TC-A-18 |
| C-2.1 (primitive) | TC-A-20 |
| E-2.1 (primitive) | TC-A-21 |
| P-2.1 (primitive) | TC-A-22 |
| S9-01 | TC-A-34 |
| S9-02, S9-12, S9-16, S9-19 (primitive) | TC-A-24 |
| S9-03, S9-06, S9-14 (primitive) | TC-A-23 |
| S9-04, S9-07, S9-18 (primitive) | TC-A-36 |
| S9-05 | TC-A-35 |
| S9-10 (primitive) | TC-A-22 |
| S9-21 | TC-A-16 |
| S9-22 | TC-A-35, TC-A-36 |

D-2.1 route-level axe, D-3.1 route-level sweeps and D-4.1 LCP are owned by ws-m2.

## Ambiguities raised in this file

| ID | Ambiguity | Interpretation assumed |
|---|---|---|
| AMB-A1 | Primitives and the error boundary need a mount point that is not a product route. | Test-only `/__ui` and `/__ui/throw` routes, rendered only when `FM_TEST_MODE=1` (§4 of README), 404 otherwise. WS-A owns them; M0 must permit the path. |
| AMB-A2 | L-2.1 does not say whether arrow keys also activate the tab (automatic) or only move focus (manual, Enter/Space activates). | Automatic activation (content is local, no fetch). TC-A-10 asserts the chosen model either way. |
| AMB-A3 | "Exact block text": markdown fences end with a newline; is it part of the copied text? | The fence's terminating newline is stripped; all other whitespace is kept. |
| AMB-A4 | "Press ⌘C to copy" is Mac-specific; the app is local on Macs, but a Linux CI browser or non-Mac user sees ⌘. | Show `⌘C` on Mac platforms, `Ctrl+C` elsewhere; tests run with a Mac user agent for the verbatim string. |
| AMB-A5 | Label for a fenced block with no language or filename. | `text`. |
| AMB-A6 | DB-down copy button: copies both commands joined, or just `supabase start`? HTTP status for the page? | Copies `supabase start && npm run seed`; status 503. |
| AMB-A7 | Exact 404 and error-boundary copy is not in the PRD. | "Page not found" with a link to `/curriculum`; "Something went wrong" with "Try again". |
| AMB-A8 | D-5.1 dark palette is not in the brand tokens. | WS-A defines dark tokens; the contrast floor is the only requirement (TC-A-32). |
