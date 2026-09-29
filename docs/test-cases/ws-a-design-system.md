# WS-A: Design system and shell

- **Owns:** `src/components/ui/`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/not-found.tsx`, `src/app/error.tsx`, `public/fonts/`, `public/brand/`. Tests: `tests/unit/a/`, `tests/e2e/a/`.
- **Covers here:** tokens and contrast (DESIGN §2), fonts, primitives (Tabs, CodeBlock/CommandLine, ProgressBar, Checkbox, Notice, Skeleton, EmptyState), the shell (§5.1), focus, motion, hit targets, dark mode, the DB-down view, 404 and the route error boundary (§6.9, §6.10), and the §11.4 M0 stub changes.
- **Out of scope:** how lessons wire Tabs to the URL and `prefs.tool` (ws-c), route-level axe/Lighthouse/LCP sweeps (ws-m2), the storage and corruption logic behind the global banners (ws-d).

**Authority.** [DESIGN.md](../design/DESIGN.md) §11 fixes every role and accessible name used below; DESIGN §2–§6 fix behavior and values; `docs/design/tokens.css` is the single token source (imported into `globals.css`, never copied). Where this file and DESIGN disagree, DESIGN wins and this file is wrong.

Primitive cases run on a test-only route `/__ui` (rendered only when `FM_TEST_MODE=1`; AMB-A1) that mounts every primitive with the fixed props named in each case. Component-level cases use Vitest + React Testing Library + `@testing-library/user-event` in `jsdom`. A case that needs layout or computed style is a Playwright e2e on `/__ui`.

**Contrast values** are the DESIGN §2.4 ledger (WCAG relative-luminance formula). Key light-mode rows the cases below assert:

| Pair | Ratio |
|---|---|
| `--fm-fg #282943` on `--fm-canvas #ffffff` / `--fm-surface #f9f9f9` | 14.11 / 13.40 |
| `--fm-fg-strong #131313` on canvas | 18.58 |
| `--fm-fg-muted #5f606c` on canvas / surface / accent-soft | 6.22 / 5.91 / 5.35 |
| `--fm-link #424bd1` on canvas / surface | 6.65 / 6.31 |
| `--fm-accent-2 #ec612a` on canvas | 3.33 (decorative / ≥24px only) |
| `--fm-control-border #8e8e8f` on canvas / surface | 3.27 / 3.11 (non-text only) |
| `--fm-focus #424bd1` on canvas | 6.65 |
| `--fm-code-focus #9fa5ff` on code-bg `#0f1729` / code-header `#16203a` | 7.92 / 7.14 |
| `--fm-warning #8a5410` on warning-soft `#fff4e5` | 5.76 |
| `--fm-danger #a93d17` on danger-soft `#fdece7` | 5.44 |

---

## Suite A1: Tokens and brand

### TC-A-01: tokens.css values match the DESIGN §2.1 token table
- **ACs:** D-1.1
- **Level:** unit
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `docs/design/tokens.css` parsed with a CSS parser (`postcss`) in `tests/unit/a/tokens.test.ts`.
- **Steps:**
  1. Read the `:root` block (light) and the dark block (`@media (prefers-color-scheme: dark)`).
  2. Compare each `--fm-*` custom property to the DESIGN §2.1 table.
  3. Read `src/app/globals.css`.
- **Expected:** Light values include `--fm-canvas:#ffffff`, `--fm-surface:#f9f9f9`, `--fm-fg:#282943`, `--fm-fg-strong:#131313`, `--fm-fg-muted:#5f606c`, `--fm-border:#e4e4e4`, `--fm-border-subtle:#f0f0f0`, `--fm-divider:#e8e8e8`, `--fm-control-border:#8e8e8f`, `--fm-link:#424bd1`, `--fm-primary:#424bd1`, `--fm-accent-2:#ec612a`, `--fm-accent-2-strong:#a93d17`, `--fm-focus:#424bd1`, `--fm-code-focus:#9fa5ff`. Dark values include `--fm-canvas:#12131f`, `--fm-fg:#ededf3`, `--fm-fg-muted:#a4a6ba`, `--fm-link:#9fa5ff`, `--fm-focus:#9fa5ff`. `globals.css` contains `@import "tailwindcss";` and `@import "../../docs/design/tokens.css";` and defines no `--fm-*` value of its own (single source of truth, DESIGN §2.6). M0's placeholder `--background`/`--foreground` are gone.
- **Notes:** If the live-site re-check (TC-A-03) changes a value, DESIGN §2, `tokens.css` and this test change in the same PR.

### TC-A-02: Every DESIGN §2.4 ledger pair meets its threshold
- **ACs:** D-1.1, D-2.1, D-5.1
- **Level:** unit
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** Token values parsed as in TC-A-01; a pure `contrastRatio(fg, bg)` helper (WCAG 2.x). The ledger rows are transcribed into a fixture array `{fg, bg, expected, need, theme}` in `tests/unit/a/contrast-ledger.ts`.
- **Steps:**
  1. For each ledger row, resolve fg and bg from the parsed tokens (not from the fixture's hex), compute the ratio, round to 2 decimals.
- **Expected:** Every computed ratio equals the ledger value to 2 decimals (for example fg-muted on canvas 6.22, link on canvas 6.65, code-focus on code-header 7.14, dark link on dark canvas 8.17) and is ≥ its `need` (4.5 text, 3.0 large/non-text). accent-2 on canvas is 3.33 with need 3.0 and is tagged "decorative only".
- **Notes:** This is the regression gate DESIGN §2.4 recommends. A token change that breaks a pair fails here before any page renders.

### TC-A-03: Live-site token re-verification (manual)
- **ACs:** D-1.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** Browser on https://www.firstmate.tech/, DevTools; the compiled CSS found via the page's `<link rel="stylesheet">` (the chunk hash changes each deploy, DESIGN §1).
- **Steps:**
  1. Read `--color-ink`, `--color-black-ink`, `--color-accent`, `--color-accent-2`, `--color-muted`, `--color-stroke`, `--color-line`, `--color-date` from `@layer theme`, and the `text-[#5f606c]` utility.
  2. Confirm Satoshi 400 / 400 italic / 500 / 700 preloads.
  3. Compare with DESIGN §1.1–§1.2.
- **Expected:** Every value matches DESIGN §1.1, or the differences are listed in the WS-A PR with screenshots, and DESIGN §1–§2, `tokens.css` and TC-A-01 are updated together.
- **Notes:** Manual (`@manual`). See AMB-19.

### TC-A-04: accent-2 and the brand date grey are never used as small text
- **ACs:** D-1.1
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`; routes `/`, `/curriculum`, `/lessons/l1-first-session`, `/news`, `/news/archive`, `/__ui`; light and dark.
- **Steps:**
  1. In each page, for every element with a non-empty own text node, read computed `color`, `font-size`, `font-weight`.
  2. Collect elements whose colour is `rgb(236, 97, 42)` (accent-2 light), `rgb(245, 138, 92)` (accent-2 dark) or `rgb(142, 142, 143)` (control-border / old date grey).
- **Expected:** No text uses `rgb(142, 142, 143)` (it is a boundary colour only, DESIGN §2.3). No text uses accent-2 below 24px regular or 18.66px bold (DESIGN §2.2; in v1 no text uses it at all). Metadata text (dates, source names, "Verified …", minutes) computes to `rgb(95, 96, 108)` (`--fm-fg-muted`) in light and `rgb(164, 166, 186)` in dark.
- **Notes:** Complements the source greps in TC-A-45.

### TC-A-05: Satoshi self-hosted via next/font/local, 4 files, no third-party font request
- **ACs:** D-1.1, D-4.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Perf
- **Preconditions / fixtures:** `fx-base`; production server (`next start`, AMB-27).
- **Steps:**
  1. Record all network requests while loading `/`.
  2. After `document.fonts.ready`, list loaded `FontFace`s.
  3. Read computed `font-family` of `body`, the `h1` and a `pre` inside a CodeBlock.
- **Expected:** Font requests are only same-origin `.woff2` files served by `next/font/local` (`/_next/static/media/…`); zero requests to `fonts.googleapis.com`, `fonts.gstatic.com`, `api.fontshare.com` or `firstmate.tech`. `public/fonts/` holds `Satoshi-Regular.woff2`, `Satoshi-Italic.woff2`, `Satoshi-Medium.woff2`, `Satoshi-Bold.woff2`. Faces for weight 400 normal, 400 italic, 500 and 700 are declared; no 600 face. `body` and `h1` resolve to the Satoshi variable (`--font-satoshi`); `pre` resolves to the mono stack starting `ui-monospace` and ending `monospace` (DESIGN §1.2).

### TC-A-06: No layout shift from web fonts
- **ACs:** D-4.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Perf
- **Preconditions / fixtures:** `fx-base`, `next start`, cache disabled; route handler delays `*.woff2` by 800ms. Tag `@nightly` if the timing is flaky on CI.
- **Steps:**
  1. Install a `PerformanceObserver` for `layout-shift` via init script.
  2. Load `/curriculum` and `/lessons/l1-first-session`; wait 3s after `document.fonts.ready`.
  3. Sum `value` of entries with `hadRecentInput=false`.
  4. Inspect the generated `@font-face` rules.
- **Expected:** CLS < 0.05 on both routes. `@font-face` uses `font-display: swap` and a metric-adjusted Arial fallback (`size-adjust`, `ascent-override`, `descent-override`, `line-gap-override` present), from `localFont({ display: "swap", adjustFontFallback: "Arial" })` (DESIGN §2.6).

### TC-A-07: Tool identity uses text and icon, never colour alone
- **ACs:** D-1.2
- **Level:** unit
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `<Tabs label="Tool">` with the Claude Code and Codex CLI items (lucide `Asterisk` and `Hexagon` icons, DESIGN §4.4), active `claude`.
- **Steps:**
  1. Scope to `getByRole('tablist', { name: 'Tool' })`; query `getByRole('tab', { name: 'Claude Code' })` and `getByRole('tab', { name: 'Codex CLI' })`.
  2. Inspect each tab's children.
- **Expected:** Accessible names are exactly "Claude Code" and "Codex CLI" (DESIGN §11.2). Each tab contains the visible label text and one `svg` with `aria-hidden="true"`. Active tab has `aria-selected="true"`; the active state also differs by weight and a bar (TC-A-08).

### TC-A-08: Active tab = bold + 2px link-coloured bar; inactive is muted
- **ACs:** D-1.2
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `/__ui` Tabs demo, active = Claude Code; light and dark.
- **Steps:**
  1. Read computed styles of both tabs and the active indicator.
  2. Apply `filter: grayscale(1)` to `html` and screenshot both tabs.
- **Expected:** Active tab: `font-weight: 700`, text colour `--fm-fg-strong` (`rgb(19, 19, 19)` light), and a 2px bottom bar in `--fm-link` (`rgb(66, 75, 209)` light, `rgb(159, 165, 255)` dark). Inactive tab: weight 500, colour `--fm-fg-muted`, no bar. In the grayscale screenshot the active tab is still distinguishable (bar and weight) (DESIGN §4.4, rubric C-5).

---

## Suite A2: Tabs primitive

### TC-A-09: Tabs ARIA roles, ids and relationships
- **ACs:** L-2.1
- **Level:** unit
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `<Tabs label="Tool" scope="lesson">` with panels "Claude panel text" and "Codex panel text", active `claude`.
- **Steps:**
  1. Query `getByRole('tablist', { name: 'Tool' })`, both tabs, and `getByRole('tabpanel', { name: 'Claude Code' })`.
- **Expected:** 1 tablist, 2 tabs, 1 exposed tabpanel. Tabs are `button[role=tab]` with ids `tab-lesson-claude` / `tab-lesson-codex` and `aria-controls` `panel-lesson-claude` / `panel-lesson-codex`. Active tab `aria-selected="true"`, `tabindex="0"`; inactive `aria-selected="false"`, `tabindex="-1"`. Each panel has `aria-labelledby` = its tab id and `tabindex="0"`, so the exposed panel's name is "Claude Code". The inactive panel is in the DOM (both are server-rendered) with the `hidden` attribute, so it is out of the a11y tree (DESIGN §4.4, §11 conventions).

### TC-A-10: Arrow, Home and End move focus and activate (automatic activation), with wrap
- **ACs:** L-2.1
- **Level:** unit
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** As TC-A-09, plus a third test-only item "Tool C" to exercise Home/End on more than 2 tabs (as M0's `tests/unit/m0/tabs.test.tsx` does); `onValueChange` spy.
- **Steps:**
  1. Focus "Claude Code"; press ArrowRight.
  2. Press ArrowRight twice.
  3. Press ArrowLeft.
  4. Press End, then Home.
  5. Press Enter and Space on the already active tab.
- **Expected:** Step 1: focus and selection on "Codex CLI" (`aria-selected="true"`, its panel exposed). Step 2: "Tool C", then wraps to "Claude Code". Step 3: wraps to "Tool C". Step 4: End → "Tool C", Home → "Claude Code", each selected. Step 5: no change, no error (DESIGN §4.4 keyboard table). After each move only the focused tab has `tabindex="0"`. ArrowUp/ArrowDown do nothing. `onValueChange` fires once per selection change.

### TC-A-11: Tab enters the tablist once and moves into the panel
- **ACs:** L-2.1, D-2.2
- **Level:** unit
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** Button "Before" rendered before `<Tabs>`, active tab "Codex CLI"; the panels contain only text.
- **Steps:**
  1. Focus "Before"; press Tab; press Tab again; press Shift+Tab twice.
- **Expected:** Tab 1 focuses "Codex CLI" (the active tab, not the first). Tab 2 focuses the Codex tabpanel (`tabindex="0"`). Shift+Tab returns to "Codex CLI", then "Before". "Claude Code" is never a Tab stop.

### TC-A-12: Tabs stay tabs below 768px
- **ACs:** D-3.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Responsive
- **Preconditions / fixtures:** `/__ui`, viewports 360×740 and 767×900.
- **Steps:**
  1. At each viewport, query `getByRole('tablist', { name: 'Tool' })`.
  2. Check both tabs are visible side by side inside the viewport.
  3. Focus the active tab and press ArrowRight.
- **Expected:** The tablist and 2 `tab`s are present; no disclosure buttons replace them (no accordion, DESIGN §4.4). Both labels are fully visible (not icon-only); the tablist's `scrollWidth <= clientWidth` at 360. ArrowRight selects "Codex CLI".

---

## Suite A3: CodeBlock primitive

### TC-A-13: Copy writes the exact fence source text
- **ACs:** L-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `/__ui` renders CodeBlocks from these fence sources; Chromium context with `grantPermissions(['clipboard-read','clipboard-write'])`.
  - `block-bash` (lang `bash`): `npm run seed\nnpm run news:run -- --dry-run` (no trailing newline)
  - `block-trailing` (lang `bash`): `echo hi\n`
  - `block-unicode` (lang `bash`): `echo "Maligayang pagdating — ✓ 日本語"`
  - `block-whitespace` (lang `text`): `\tindented\n    four spaces\n\n`
- **Steps:**
  1. For each block, scope to its `figure` (`getByRole('figure', { name: 'bash' })` etc.) and click the button `/^Copy code: /`.
  2. Read `navigator.clipboard.readText()`.
- **Expected:** Clipboard equals the fence **source** (not the highlighted DOM's `innerText`) with only the final trailing newline trimmed (DESIGN §4.5 step 1): `block-trailing` → `echo hi`; `block-whitespace` → `\tindented\n    four spaces\n` (one trailing newline trimmed, tab and inner blank line kept); unicode preserved. No line numbers, no `$ ` prompt, no button text.

### TC-A-14: Copy button name "Copy code: <label>", becomes "Copied" for 2s, announces via #fm-live
- **ACs:** L-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** As TC-A-13, with `page.clock.install()` to control the 2s timer.
- **Steps:**
  1. Read `page.locator('#fm-live')` text and the `block-bash` button name.
  2. Click `getByRole('button', { name: 'Copy code: bash' })`.
  3. Read the same button (re-query with `/^Cop(y|ied)/`), `document.activeElement` and `#fm-live`.
  4. Advance the clock 2000ms; re-read the name.
- **Expected:** Step 1: `#fm-live` exists at mount with `role="status"`, `aria-live="polite"`, `aria-atomic="true"`, empty text; the name is exactly "Copy code: bash" (visible "Copy" plus sr-only suffix, no `aria-label`). Step 3: the name is exactly "Copied", the visible label reads "Copied" with a check icon, focus is still on the button, and `#fm-live` text is exactly `Copied`. Step 4: name is "Copy code: bash" again. There is no per-component live region (exactly one element with `id="fm-live"` on the page). Never locate the announcement with a bare `getByRole('status')` (DESIGN §11 conventions).

### TC-A-15: Repeated and cross-block copies restart the timer and re-announce
- **ACs:** L-4.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** As TC-A-14.
- **Steps:**
  1. Click Copy on `block-bash` 3 times within 1s (advance the clock 500ms between clicks).
  2. Advance 1500ms; read the name.
  3. Click Copy on `block-unicode`; read the clipboard and `#fm-live`.
- **Expected:** No console errors. Step 2: `block-bash` still reads "Copied" (repeated clicks restart the 2s timer, DESIGN §4.5 step 2). Step 3: clipboard holds the `block-unicode` text; `#fm-live` text is `Copied` (the helper clears and re-sets it, so it is never "CopiedCopied").

### TC-A-16: Clipboard denied selects the code and shows the fallback hint
- **ACs:** S9-21, L-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `/__ui`; init script making `navigator.clipboard.writeText` return `Promise.reject(new DOMException('denied','NotAllowedError'))`; a second run with `navigator.clipboard` undefined. Run once with a macOS platform and once with a Linux platform.
- **Steps:**
  1. Click `getByRole('button', { name: 'Copy code: bash' })`.
  2. Read `window.getSelection().toString()`, `document.activeElement`, the hint text inside the figure and `#fm-live`.
- **Expected:** Selection equals the `block-bash` code text. Focus moves to the block's `pre` (`aria-label="Code: bash"`). The hint inside the figure reads exactly `Press ⌘C to copy` on macOS and `Press Ctrl+C to copy` elsewhere. `#fm-live` reads `Copy blocked. Code selected. Press ⌘C to copy.` (Ctrl+C variant off Mac). The button name returns to "Copy code: bash" (never "Failed", never "Copied"). No `pageerror` or unhandled rejection. The hint stays at least 8s and until the next click outside the block (DESIGN §4.5 step 3).

### TC-A-17: Figure caption and names: filename, else language, else "text"
- **ACs:** L-4.2
- **Level:** unit
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** CodeBlocks: (a) lang `bash`; (b) lang `json` with `title="settings.json"`; (c) no language. CommandLine with label "Setup".
- **Steps:**
  1. Render each; query `getByRole('figure', { name })`, its `pre` and its copy button.
- **Expected:** (a) figure "bash", `pre[aria-label="Code: bash"][tabindex="0"]`, button "Copy code: bash". (b) figure "settings.json" (filename wins), button "Copy code: settings.json". (c) figure "text", button "Copy code: text". CommandLine: figure "Setup", button "Copy code: Setup" (DESIGN §11.2). The wrapper carries `data-code-chrome`.

### TC-A-18: Server-side syntax highlighting with the §2.4 syntax colours
- **ACs:** L-4.2, D-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `/__ui` block (b) with `{"permissions": {"allow": ["Bash(npm test)"]}, "n": 1}` and a `bash` block containing a comment `# comment`.
- **Steps:**
  1. Fetch the SSR HTML with `request.get('/__ui')` and look for coloured token spans.
  2. In the page, count distinct computed colours of spans inside the JSON `pre`; read the comment span colour.
  3. Compute each token colour's contrast against the `pre` background in light and dark.
- **Expected:** Token spans are already in the server HTML (Shiki on the server, no client highlighter). At least 3 distinct token colours in the JSON block. The comment colour is `rgb(154, 164, 178)` (`#9aa4b2`, the override). The `pre` background is `--fm-code-bg` (`rgb(15, 23, 41)` light, `rgb(11, 15, 28)` dark). Every token colour is ≥ 4.5:1 against it (DESIGN §2.4 syntax colours).

### TC-A-19: Long lines scroll inside the block, not the page
- **ACs:** D-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Responsive
- **Preconditions / fixtures:** `/__ui` block with one 400-character line (`curl -sS "https://example.com/?a=` + 360 `x` + `"`); widths 360, 768, 1024, 1440.
- **Steps:**
  1. At each width, compare `document.documentElement.scrollWidth` with `window.innerWidth`.
  2. Read the `pre`'s `scrollWidth`, `clientWidth`, computed `overflow-x` and `white-space`.
  3. Tab to the `pre`.
- **Expected:** Page `scrollWidth <= innerWidth` (rubric D-1). The `pre` has `overflow-x: auto`, no wrapping, `scrollWidth > clientWidth`. The `pre` is focusable (`tabindex="0"`) and named "Code: bash", so axe `scrollable-region-focusable` passes. The copy button stays in the header, not scrolled away.

---

## Suite A4: Other primitives

### TC-A-20: ProgressBar ARIA, visible count and rounding
- **ACs:** C-2.1
- **Level:** unit
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `<ProgressBar label="Level 3" value={v} max={m}/>` mounted (post-hydration) with (v,m) = (2,4), (0,4), (4,4), (1,3), (0,0).
- **Steps:**
  1. Query `getByRole('progressbar', { name: 'Level 3' })` and the adjacent count text.
- **Expected:** `aria-valuemin="0"`, `aria-valuemax="100"`, name exactly "Level 3". `aria-valuenow`: 50, 0, 100, 33, 0 (integer, `Math.round`). `aria-valuetext`: "2 of 4 lessons complete", "0 of 4 …", "4 of 4 …", "1 of 3 …", "0 of 0 …". Visible count "2 / 4", "0 / 4", "4 / 4", "1 / 3", "0 / 0" with `tabular-nums`. (0,0) renders the track, no `NaN`, no throw (DESIGN §4.7).

### TC-A-21: Checkbox is native, labelled by its row and keyboard-togglable
- **ACs:** E-2.1, D-2.2
- **Level:** unit
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `<Checkbox id="c1" label="Test is green" checked={false} onChange={spy}/>`.
- **Steps:**
  1. Query `getByRole('checkbox', { name: 'Test is green' })`.
  2. Tab to it; press Space. Click the label text. Press Enter.
- **Expected:** The element is a native `input[type=checkbox]`, labelled by a wrapping `label` row (DESIGN §4.6). Space calls `spy(true)`; clicking the label text calls `spy(false)`; Enter does not toggle. The row's clickable box is ≥ 44px tall (`min-h-11`). Checked text is not struck through.

### TC-A-22: Notice roles, dismissal and focus return
- **ACs:** P-2.1, S9-10
- **Level:** unit
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** Inside `<main><h1 tabindex="-1">Page</h1>…</main>`: (a) `<Notice tone="warning" dismissible title="Saved progress was unreadable and has been reset.">…</Notice>` mounted after an event (default `live`); (b) `<Notice tone="danger" title="This file isn't a valid progress export.">` mounted after an event; (c) `<Notice tone="warning" live={false}>` present in the initial render (server-rendered case).
- **Steps:**
  1. Query each Notice by its role (or by text for (c)).
  2. In (a), Tab to `getByRole('button', { name: 'Dismiss' })` and press Enter.
- **Expected:** (a) `role="status"` (warning is never `alert`); locate it with `getByRole('status').filter({ hasText: 'Saved progress was unreadable and has been reset' })`. (b) `role="alert"`. (c) no `role` attribute. The dismiss button's name is exactly "Dismiss", with the `X` icon `aria-hidden`. After Enter the Notice is removed, `onDismiss` fires once, and focus moves to the `main` h1 (`tabindex="-1"`), not to `body` (DESIGN §4.10).

### TC-A-23: Skeleton hidden from assistive tech, container busy, one loading status
- **ACs:** S9-03, S9-06, S9-14
- **Level:** unit
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `Skeleton.Row` ×3 inside a container `data-testid="curriculum-skeleton"`; `Skeleton.NewsCard` ×4 inside `data-testid="news-skeleton"`.
- **Steps:**
  1. Render; inspect attributes and the a11y tree.
- **Expected:** Each skeleton block is `div[aria-hidden="true"]` with the `bg-skeleton` class and `animate-pulse`. Each container has `aria-busy="true"` and exactly one sr-only `role="status"` span (for example "Loading curriculum…"). Test ids are exactly the ones in DESIGN §11.2. Pulse is static under reduced motion (TC-A-27).

### TC-A-24: EmptyState renders a named region with title, body, command and action
- **ACs:** S9-02, S9-12, S9-16, S9-19
- **Level:** unit
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** (a) `<EmptyState title="No items match these filters" action={{label:"Clear filters", href:"/news/archive"}}/>`; (b) `<EmptyState title={<>No lessons seeded yet. Run <code>npm run seed</code>.</>} command="npm run seed"/>`; (c) title only.
- **Steps:**
  1. Render each; query `getByRole('region', { name })`, the heading, the CommandLine and links.
- **Expected:** (a) `section` exposed as `region` "No items match these filters" (named via `aria-labelledby` to its heading); link "Clear filters" with href `/news/archive`. (b) region named "No lessons seeded yet. Run npm run seed." (DESIGN §11.3); a CommandLine figure "Terminal" with button "Copy code: Terminal" copying `npm run seed`. (c) no empty button, link or figure rendered.

---

## Suite A5: Shell, navigation and focus

### TC-A-25: Skip link is the first tab stop and focuses main
- **ACs:** D-2.3
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`; routes `/`, `/curriculum`, `/lessons/l1-first-session`, `/news`.
- **Steps:**
  1. Load the route; press Tab once.
  2. Check visibility; press Enter; press Tab once more.
- **Expected:** Step 1 focuses `getByRole('link', { name: 'Skip to content' })` with `href="#main"`, visible on focus (fixed top-left, non-zero size, in viewport). After Enter, `document.activeElement` is `main#main` (`tabindex="-1"`). The next Tab lands on the first focusable element inside `main`, not on the header nav.

### TC-A-26: Focus ring 2px with 2px offset; link colour outside code chrome, #9fa5ff inside
- **ACs:** D-2.2
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `/__ui` with Button (primary, secondary, ghost), a prose link, a Tab, a Checkbox, a CodeBlock copy button, its `pre`, a Notice Dismiss, a disclosure button and the Menu button (at 360); light and dark.
- **Steps:**
  1. Tab through the page (keyboard, so `:focus-visible` applies).
  2. For each focused element read computed `outline-style`, `outline-width`, `outline-color`, `outline-offset`.
  3. Click one button with the mouse and read the same.
- **Expected:** Outside code chrome: `outline: 2px solid`, `outline-offset: 2px`, colour `--fm-focus` = `rgb(66, 75, 209)` light / `rgb(159, 165, 255)` dark. Inside `[data-code-chrome]` (copy button, `pre`): colour `--fm-code-focus` = `rgb(159, 165, 255)` in both themes (DESIGN §2.3, tokens.css). Every listed element is reached (none skipped, no positive `tabindex`). The ring is not clipped by an `overflow: hidden` ancestor (screenshot). A mouse click shows no ring.

### TC-A-27: Reduced motion follows the tokens.css rule; tab switching never animates
- **ACs:** D-2.4
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `/__ui`; `page.emulateMedia({ reducedMotion: 'reduce' })` vs `'no-preference'`.
- **Steps:**
  1. With `reduce`, read on `:root` the custom properties `--fm-duration-fast`, `--fm-duration-base`, `--fm-duration-slow`; read computed `animation-duration`, `animation-iteration-count` and `transition-duration` of a Skeleton block, the ProgressBar fill, a disclosure panel and the mobile menu panel; read `scroll-behavior` on `html`.
  2. With `no-preference`, read the same.
  3. In both modes, activate "Codex CLI" and record `getAnimations()` on the tablist subtree during the switch.
- **Expected:** `reduce`: the three duration tokens are `0ms`; every element's `animation-duration` and `transition-duration` compute to `0.01ms` (`1e-05s`) with `animation-iteration-count: 1`; `scroll-behavior: auto`. `animation-name` is **not** asserted (tokens.css keeps it). `no-preference`: the Skeleton has a non-zero `animation-duration` (`2s` pulse) and the ProgressBar fill a non-zero `transition-duration`, proving the media query rather than a global kill. Tab switch: zero running animations or transitions in both modes (DESIGN §3.5: no motion on tab switching).

### TC-A-28: Nav collapses to a Menu button with aria-expanded below 768px
- **ACs:** D-3.2, D-2.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Responsive
- **Preconditions / fixtures:** `fx-base`; route `/curriculum`; viewports 360, 767, 768, 1440.
- **Steps:**
  1. At 360: query `getByRole('button', { name: 'Menu' })`; read `aria-expanded` and `aria-controls`; count `getByRole('navigation', { name: 'Main' })`.
  2. Press Enter; read `document.activeElement`; check the nav links; press Escape.
  3. At 767 repeat step 1. At 768 and 1440 check the inline nav and that there is no Menu button.
- **Expected:** At 360 and 767: the button's name is fixed "Menu" (state only in `aria-expanded`), `aria-expanded="false"`, `aria-controls="mobile-nav"`, and 0 exposed "Main" navigations while closed. After Enter: `aria-expanded="true"`, exactly one `navigation` "Main" (`nav#mobile-nav`) with links Curriculum, Exercises, News, Bookmarks, Progress, the current one `aria-current="page"`; **focus moves to the first link ("Curriculum")**, and there is no focus trap. Escape closes (`aria-expanded="false"`, the panel `hidden`) and returns focus to the Menu button. At 768 and 1440: exactly one "Main" navigation inline and `getByRole('button', { name: 'Menu' })` has count 0.
- **Notes:** DESIGN §5.1 (merged) says focus moves to the first link on open ("PR #2 expects this"). The PR #2 review said it stays on the button. DESIGN is the authority, so this case follows §5.1; see AMB-A9.

### TC-A-29: Mobile menu closes on navigation and on growing to md
- **ACs:** D-3.2
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** 360×740, `/curriculum`.
- **Steps:**
  1. Open the menu; click "News".
  2. Open the menu; resize to 1024.
  3. Open the menu at 360; click inside `main`.
- **Expected:** 1: URL `/news`, menu closed (`aria-expanded="false"`), and "News" has `aria-current="page"` in the nav. 2: the panel closes, the inline nav shows, and `body` has no scroll lock. 3: DESIGN specifies no outside-click close (the panel is a push-down disclosure, not a modal), so the menu stays open; the case asserts no error and no content hidden behind an overlay.

### TC-A-30: Hit targets ≥ 24×24 everywhere, ≥ 44×44 on coarse pointers
- **ACs:** D-2.5
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`; routes `/`, `/curriculum`, `/lessons/l1-first-session`, `/news`, `/news/archive`; contexts 1440 fine pointer, and 360 and 768 with `hasTouch: true, isMobile: true` (so `(pointer: coarse)` matches; AMB-11).
- **Steps:**
  1. Collect visible `a, button, input, select, [role=tab]`.
  2. Read `getBoundingClientRect()` (for checkboxes, the wrapping label row; inline links inside prose are exempt per WCAG 2.5.8).
- **Expected:** Fine pointer: every target ≥ 24×24. Coarse pointer: every non-inline target ≥ 44×44, including tabs (`h-11`), copy buttons, Menu (`size-11`), Dismiss, checkbox rows (`min-h-11`), `sm` buttons, filter chips, pagination links and news bookmark buttons. The failure report lists offending accessible names.

### TC-A-31: Forced colours keep focus, active tab and progress visible
- **ACs:** D-2.2, D-1.2
- **Level:** e2e
- **Priority:** P1
- **Category:** A11y
- **Preconditions / fixtures:** `/__ui`, `page.emulateMedia({ forcedColors: 'active' })`.
- **Steps:**
  1. Tab to a Button and to the active Tab; screenshot.
  2. Inspect the ProgressBar and a Checkbox.
- **Expected:** Focus is an `outline` (survives forced colours). The active tab's bar and bold weight stay visible. The ProgressBar fill is visible (border or `forced-color-adjust`). Native checkboxes render.

### TC-A-32: Dark mode via prefers-color-scheme with the §2.4 dark guarantees
- **ACs:** D-5.1
- **Level:** e2e
- **Priority:** P1
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`; `page.emulateMedia({ colorScheme: 'dark' })`; routes `/__ui`, `/curriculum`, `/lessons/l1-first-session`, `/news`.
- **Steps:**
  1. Read computed `background-color` of `body`, `color` of body text, headings, links and metadata, and the focus outline colour.
  2. Inspect a CodeBlock figure border and the header logo `img` source.
  3. Run axe (`color-contrast` on).
  4. Check for any `data-theme` attribute or theme toggle.
- **Expected:** `body` background `rgb(18, 19, 31)` (`#12131f`), body text `rgb(237, 237, 243)`, headings `rgb(255, 255, 255)`, links and focus `rgb(159, 165, 255)`, metadata `rgb(164, 166, 186)`. CodeBlocks stay dark with a 1px `--fm-code-border` border. The logo is `public/brand/firstmate-logo-dark.svg` via `<picture><source media="(prefers-color-scheme: dark)">`. Shadows are replaced by 1px borders. axe: 0 serious/critical. There is no toggle and no `data-theme` (DESIGN §2.5). The first paint is already dark.

### TC-A-33: axe clean on the primitives page, both tab states, both schemes
- **ACs:** D-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `/__ui`, `@axe-core/playwright` with tags `wcag2a, wcag2aa, wcag21aa, wcag22aa`.
- **Steps:**
  1. Run axe with "Claude Code" active.
  2. Activate "Codex CLI"; expand the disclosure; mount a `status` Notice; at 360 open the mobile menu; run axe again.
  3. Repeat both in the dark scheme.
- **Expected:** 0 `serious` or `critical` violations in all 4 runs. Moderate/minor violations are listed in the output but do not fail.

---

## Suite A6: DB down, 404 and route error boundary

### TC-A-34: DB down shows the DB-unavailable view with exact copy and no leak
- **ACs:** S9-01
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** Production server (`next start`, AMB-27) with `SUPABASE_URL=http://127.0.0.1:54399` (`supabase-down`); clipboard permissions granted.
- **Steps:**
  1. Load `/curriculum`, `/lessons/l1-first-session`, `/news`, `/`.
  2. Read the visible text and the raw HTML body.
  3. Click `getByRole('button', { name: 'Copy code: Terminal' })`; read the clipboard and `#fm-live`.
- **Expected:** `getByRole('heading', { level: 1, name: 'Database unavailable' })`. A single `<p>` whose `textContent` equals `DB_UNAVAILABLE_MESSAGE` exactly ("Can't reach the local database. Run `supabase start` then `npm run seed`."; backticked commands render as inline `code`, text content identical). A CommandLine figure "Terminal" showing `supabase start && npm run seed`; the clipboard equals `DB_UNAVAILABLE_COMMAND`; `#fm-live` reads `Copied`. A `button` "Try again" is present. Header, nav and `#fm-live` are still rendered (the boundary sits inside the root layout). The HTML contains no stack frame (`/\bat [\w.<>]+ \(/`), `ECONNREFUSED`, `54399`, `node_modules`, the anon or service-role key, or a file path. No `pageerror`. No HTTP status is asserted (an error boundary cannot set it).

### TC-A-35: Branded 404: "Page not found" for unknown routes, "Lesson not found" for archived lessons
- **ACs:** S9-22, S9-05
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `fx-base`.
- **Steps:**
  1. Request `/this-route-does-not-exist`; read status, `<title>`, h1, links.
  2. Request `/lessons/l2-retired` (archived) and `/lessons/no-such-lesson`; read status, h1, body text, links.
- **Expected:** Both responses are HTTP 404 and render inside the app shell (header, skip link, Satoshi). Step 1: h1 "Page not found", eyebrow "404", body "The link may be old, or the lesson may have been renamed or archived.", `getByRole('link', { name: 'Go to curriculum' })` with href `/curriculum` (primary), plus a "Home" link; `<title>` ends with "· First Mate AI Playground". Step 2: h1 "Lesson not found", body `"l2-retired" isn't in the current curriculum. It may have been renamed or archived.` (slug rendered as escaped text), link "Go to curriculum". axe: 0 serious/critical (DESIGN §6.9).
- **Notes:** The lesson variant is rendered by the lesson route's `notFound()` (ws-c); this case pins the shared copy.

### TC-A-36: Route error boundary: branded view, danger alert, Try again refetches
- **ACs:** S9-22, S9-04, S9-07, S9-18
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** Production server with `FM_TEST_MODE=1`; test route `/__ui/throw?once=1` whose server component throws `new Error("boom-secret-detail")` on the first request only (AMB-A1).
- **Steps:**
  1. Load `/__ui/throw?once=1`; set `window.__marker = 1`.
  2. Read the visible text and the HTML.
  3. Click `getByRole('button', { name: 'Try again' })`.
- **Expected:** h1 "Something went wrong"; `getByRole('alert')` containing "This page couldn't load. Your saved progress is not affected."; button "Try again"; link "Back to curriculum" (the error view keeps this name, DESIGN §11.3); optionally "Reference: <digest>" in muted text. Neither text nor HTML includes `boom-secret-detail` or a stack frame. After "Try again" (`router.refresh()` + `reset()` in a transition) the route re-renders with its content ("Recovered") and `window.__marker` survives (no full reload). While pending, the button has `aria-busy="true"`.

### TC-A-37: Root layout semantics and document titles
- **ACs:** D-2.1, D-2.3
- **Level:** e2e
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** `fx-base`; every §8 route at 1440 and at 360 with the menu closed.
- **Steps:**
  1. Read `html[lang]`, `meta[name=viewport]`, landmark counts, the logo link and `<title>`.
- **Expected:** `lang="en"`; viewport `width=device-width, initial-scale=1` with no `maximum-scale=1` or `user-scalable=no`. Exactly one `banner`, one `main#main[tabindex="-1"]`, one exposed `navigation` "Main", one `contentinfo`, one `h1`, and no skipped heading levels. `getByRole('link', { name: 'First Mate AI Playground' })` (logo `img alt="First Mate"` + "AI Playground") points to `/`. The current section link has `aria-current="page"` (`/lessons/*` activates "Curriculum", `/news/archive` activates "News", `/` activates none). `<title>` is "<Page> · First Mate AI Playground" (lessons: "<Lesson title> · L<n> · First Mate AI Playground") (DESIGN §5.1, §5.3).

### TC-A-38: Shell has no horizontal scroll at 360/768/1024/1440 or at 200% zoom
- **ACs:** D-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Responsive
- **Preconditions / fixtures:** `/__ui` including a Notice with a 60-character unbroken word and a CodeBlock with filename `a-very-long-configuration-file-name-for-testing.config.json`; widths 360, 374, 375, 768, 1024, 1440; plus 1280 wide at 200% zoom.
- **Steps:**
  1. At each width compare `document.documentElement.scrollWidth` with `window.innerWidth`.
  2. At 374 and 375, read the header brand.
  3. Screenshot at 360/768/1440 for the PR (G-1).
- **Expected:** `scrollWidth <= innerWidth` at every width and at 200% zoom. Long words wrap (`overflow-wrap: anywhere`). At 374 the "AI Playground" label is `sr-only`, and the logo link's name is still "First Mate AI Playground"; at 375 the label is visible (DESIGN §5.1 fit rule).

---

## Suite A7: DESIGN §11.4 stub changes and source rules

### TC-A-39: Notice `tone` widened; "error" stays an alias for "danger"
- **ACs:** S9-10, S9-22
- **Level:** unit
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `import { Notice } from "@/components/ui"`; render one Notice per tone `info`, `neutral`, `success`, `warning`, `danger`, `error`.
- **Steps:**
  1. Render each; read `role`, the icon, and the colour class/computed title colour.
  2. Type-check a file using `tone="error"` (`npm run typecheck`).
- **Expected:** All six tones compile and render. `error` renders exactly like `danger` (same role, `XCircle` icon, `text-danger` title). Icons: info/neutral `Info`, success `CheckCircle2`, warning `AlertTriangle`, danger `XCircle`. Body text is `--fm-fg` in every tone; only the title and icon take the status colour (DESIGN §4.10). The prop is still named `tone` (other workstreams import it).

### TC-A-40: Notice `live` prop defaults and override
- **ACs:** S9-10
- **Level:** unit
- **Priority:** P0
- **Category:** A11y
- **Preconditions / fixtures:** Notices: `tone="warning"` (no `live`), `tone="info"`, `tone="success"`, `tone="danger"`, `tone="error"`, `tone="warning" live={false}`, `tone="danger" live="polite"`.
- **Steps:**
  1. Render each; read `role` and `aria-live`.
- **Expected:** warning, info, success → `role="status"` (default `live="polite"`). danger and error → `role="alert"` (default `live="assertive"`). `live={false}` → no `role` and no `aria-live` (the server-rendered stale-digest Notice passes this). `tone="danger" live="polite"` → `role="status"`. No other component in `src/components/ui/` renders `role="alert"` (grep) (DESIGN §11.4, §4.10).
- **Notes:** The M0 Notice unit test changes in the same PR (TC-A-44).

### TC-A-41: DB-down copy button is "Copy code: Terminal" (M0 test updated)
- **ACs:** S9-01
- **Level:** unit
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `render(<ErrorPage error={new DbUnavailableError()} reset={() => {}} />)`; `navigator.clipboard.writeText` mocked.
- **Steps:**
  1. Query `getByRole('heading', { name: 'Database unavailable' })`, `getByText(DB_UNAVAILABLE_MESSAGE)` (text content match) and `getByRole('button', { name: 'Copy code: Terminal' })`.
  2. Click the button.
  3. Render with `Object.assign(new Error('hidden'), { digest: 'DB_UNAVAILABLE' })`.
- **Expected:** Heading and message present; the button exists and `getByRole('button', { name: 'Copy command' })` has count 0. The click calls `writeText(DB_UNAVAILABLE_COMMAND)` = `supabase start && npm run seed`. The digest-only error also renders the DB-down view (detection by `digest`, the path that works under `next start`). `isDbUnavailable`, `DB_UNAVAILABLE_MESSAGE` and `DB_UNAVAILABLE_COMMAND` are imported from `@/lib/db/errors`, not retyped. `tests/unit/m0/db-unavailable.test.tsx` is updated in the same PR to assert "Copy code: Terminal" (DESIGN §11.4).

### TC-A-42: not-found link is "Go to curriculum"; error view keeps "Back to curriculum"
- **ACs:** S9-22, S9-05
- **Level:** unit
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `render(<NotFound/>)` from `src/app/not-found.tsx`; `render(<ErrorPage error={new Error('boom')} reset={spy}/>)`.
- **Steps:**
  1. Query links by name in each.
- **Expected:** NotFound: h1 "Page not found", `link` "Go to curriculum" → `/curriculum`; `getByRole('link', { name: 'Back to curriculum' })` count 0. ErrorPage: h1 "Something went wrong", `alert` containing "This page couldn't load.", `button` "Try again", `link` "Back to curriculum" → `/curriculum`; clicking "Try again" calls `reset` (inside the refresh transition).

### TC-A-43: EmptyState accepts a ReactNode title (compatible widening)
- **ACs:** S9-02, S9-12
- **Level:** unit
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `<EmptyState title="Nothing bookmarked yet"/>` and `<EmptyState title={<>No news yet. Run <code>npm run news:run</code>.</>}/>`; `npm run typecheck`.
- **Steps:**
  1. Render both; query `getByRole('region', { name })`.
  2. Type-check.
- **Expected:** String titles still work (region "Nothing bookmarked yet"). The ReactNode title renders the command in `code` and the region's accessible name is "No news yet. Run npm run news:run." (DESIGN §11.3). Typecheck passes for both call shapes.

### TC-A-44: M0 stub tests are updated in the same PR as the stub changes
- **ACs:** G-2, G-4
- **Level:** integration
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** The WS-A PR diff (`gh pr diff <n> --name-only`).
- **Steps:**
  1. If the diff touches `src/components/ui/index.tsx` (Notice), `src/app/error.tsx` or `src/app/not-found.tsx`, check that the matching M0 tests under `tests/unit/m0/` are also in the diff and pass.
  2. Run `npm test`.
- **Expected:** Changing Notice roles, the DB-down button name or the not-found link without updating `tests/unit/m0/*` fails review (DESIGN §11.4). `npm test` is green with the updated M0 tests: no M0 test is deleted to make the suite pass. Export names from `@/components/ui` (`Button`, `Card`, `Badge`, `Tabs`, `CodeBlock`, `Checkbox`, `ProgressBar`, `Skeleton`, `EmptyState`, `Notice`) all still exist.

### TC-A-45: Source greps G-1 to G-5 return nothing
- **ACs:** D-1.1, D-2.2
- **Level:** integration
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** Repo root after the WS-A PR.
- **Steps:**
  1. Run the five DESIGN §9.3 greps (G-1 `font-semibold|font-weight: *600`; G-2 raw colours in `src/components` and `src/app` `*.tsx`; G-3 `text-accent-2`; G-4 `text-\[[0-9.]+(px|rem|em)\]`; G-5 `outline-none|outline: *none|outline: *0`).
  2. Add `className="bg-blue-500"` to a scratch component and run `npm run build`.
- **Expected:** G-1, G-2, G-3 and G-5 print nothing. G-4 prints only `text-[0.875rem]` (code size) and `text-[0.9em]` (inline code). The scratch palette class generates no CSS (Tailwind's default palette is removed by `--color-*: initial`). Revert the scratch change.

### TC-A-46: ProgressBar is not exposed before hydration
- **ACs:** C-2.1, S9-09
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `/__ui` ProgressBar demo "Level 3" (2 of 4); `request.get('/__ui')` for the SSR HTML; in-page run with JavaScript disabled (`javaScriptEnabled: false`).
- **Steps:**
  1. Search the SSR HTML for `role="progressbar"`.
  2. Load with JS disabled; count `getByRole('progressbar')`.
  3. Load with JS enabled; measure the bar's box before and after hydration.
- **Expected:** No `role="progressbar"` in server HTML and none with JS disabled: a Skeleton with the track's exact dimensions and a 3ch text placeholder render instead (`data-testid="progress-placeholder"` where it stands in for progress UI). After hydration the real bar appears in the same box (no layout shift; DESIGN §4.7).

---

## Coverage

| AC | Cases |
|---|---|
| D-1.1 | TC-A-01, TC-A-02, TC-A-03, TC-A-04, TC-A-05, TC-A-45 |
| D-1.2 | TC-A-07, TC-A-08, TC-A-31 |
| D-2.1 | TC-A-02, TC-A-18, TC-A-33, TC-A-37 |
| D-2.2 | TC-A-11, TC-A-21, TC-A-26, TC-A-28, TC-A-31, TC-A-45 |
| D-2.3 | TC-A-25, TC-A-37 |
| D-2.4 | TC-A-27 |
| D-2.5 | TC-A-30 |
| D-3.1 | TC-A-19, TC-A-38 |
| D-3.2 | TC-A-12, TC-A-28, TC-A-29 |
| D-4.2 | TC-A-05, TC-A-06 |
| D-5.1 | TC-A-02, TC-A-32 |
| L-2.1 (primitive) | TC-A-09, TC-A-10, TC-A-11 |
| L-4.1 (primitive) | TC-A-13, TC-A-14, TC-A-15, TC-A-16 |
| L-4.2 (primitive) | TC-A-17, TC-A-18 |
| C-2.1 (primitive) | TC-A-20, TC-A-46 |
| E-2.1 (primitive) | TC-A-21 |
| P-2.1 (primitive) | TC-A-22 |
| S9-01 | TC-A-34, TC-A-41 |
| S9-02, S9-12, S9-16, S9-19 (primitive) | TC-A-24, TC-A-43 |
| S9-03, S9-06, S9-14 (primitive) | TC-A-23 |
| S9-04, S9-07, S9-18 (primitive) | TC-A-36 |
| S9-05 | TC-A-35, TC-A-42 |
| S9-09 (primitive) | TC-A-46 |
| S9-10 (primitive) | TC-A-22, TC-A-39, TC-A-40 |
| S9-21 | TC-A-16 |
| S9-22 | TC-A-35, TC-A-36, TC-A-39, TC-A-42 |
| G-2, G-4 | TC-A-44 |

D-2.1 route-level axe, D-3.1 route-level sweeps and D-4.1 LCP are owned by ws-m2.

## Ambiguities raised in this file

| ID | Ambiguity | Status / interpretation |
|---|---|---|
| AMB-A1 | Primitives and the error boundary need a mount point that is not a product route. | Open. Test-only `/__ui` and `/__ui/throw`, rendered only when `FM_TEST_MODE=1` (README §4), 404 otherwise. WS-A owns them. |
| AMB-A2 | Arrow keys: automatic or manual activation. | Resolved: DESIGN §4.4 (automatic activation). |
| AMB-A3 | Is the fence's final newline copied? | Resolved: DESIGN §4.5 step 1 (source text, only the final trailing newline trimmed). |
| AMB-A4 | "Press ⌘C to copy" off macOS. | Resolved: DESIGN §4.5 step 3 and §11.2 ("Ctrl+C" when not macOS). |
| AMB-A5 | Label for a fence with no language or filename. | Resolved: DESIGN §4.5 and §11.2 ("text"). |
| AMB-A6 | What the DB-down copy button copies; HTTP status. | Resolved: DESIGN §6.10 (`DB_UNAVAILABLE_COMMAND`, "Copy code: Terminal"). No status is asserted (the review dropped 503). |
| AMB-A7 | 404 and error-boundary copy. | Resolved: DESIGN §6.9, §6.10 and §11.3. |
| AMB-A8 | Dark palette. | Resolved: DESIGN §2.1 and §2.5 (dark tokens and §2.4 dark ledger). |
| AMB-A9 | Mobile menu focus on open: DESIGN §5.1 (merged) moves focus to the first link; the PR #2 review and README §2 say focus stays on the Menu button. | Open. TC-A-28 follows DESIGN §5.1 (DESIGN is authoritative). If the orchestrator decides otherwise, DESIGN §5.1, README §2 and TC-A-28 change together. |
| AMB-A10 | DESIGN specifies no outside-click close for the push-down mobile menu. | Open. TC-A-29 asserts the menu stays open on an in-page click. |
