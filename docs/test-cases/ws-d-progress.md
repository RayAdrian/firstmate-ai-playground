# WS-D: Progress layer (localStorage)

Scope: the `fm-playground:v1` store and its zod contract, corruption and storage-unavailable handling, version migration, hydration safety, `/progress` (export, import, reset) and `/bookmarks`.
Owned paths: `src/lib/progress/`, `src/app/progress/`, `src/app/bookmarks/`. Tests: `tests/unit/d/`, `tests/e2e/d/`. Stories: P-1 to P-7, L-8.1 (list side), N-5.1 (storage side), §9 states S9-09, S9-10, S9-19, S9-20.
Contracts: `src/lib/contracts/progress.ts` (`PROGRESS_STORAGE_KEY`, `PROGRESS_VERSION = 1`, `progressStateSchema`, `createEmptyProgress()`); selectors and copy from [DESIGN.md](../design/DESIGN.md) §4.10, §4.11, §4.12, §6.7, §6.8, §7 and §11. Fixtures and helpers: [README §3](README.md#3-fixtures) (`fx-base`, `ls-*` docs incl. `ls-bookmarks`, and `seedProgress`, `readProgress`, `blockStorage`, `collectConsole` in `tests/support/`, AMB-26). "Progress-bearing routes" means `/`, `/curriculum`, `/lessons/l1-first-session`, `/exercises`, `/bookmarks` and `/progress`.

Locator rules used throughout (README §2): never a bare `getByRole('status')`. Announcements are `page.locator('#fm-live')`; notices are `getByRole('status').filter({ hasText: … })`. The lesson bookmark is `getByRole('button', { name: 'Bookmark', exact: true })`. Tool tabs are scoped with `getByRole('tablist', { name: 'Tool' })`.

---

## Suite 1: Store contract and reducer (unit)

### TC-D-01: Empty state matches the P-1 contract exactly
- **ACs:** P-1.1
- **Level:** unit
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `createEmptyProgress()` and `progressStateSchema` from `src/lib/contracts`. No storage.
- **Steps:**
  1. Call the store's initial-state factory.
  2. Parse it with `progressStateSchema`.
- **Expected:** It deep-equals `createEmptyProgress()`: `{ version: 1, lessons: {}, checklists: {}, bookmarks: { lessons: {}, news: {} }, prefs: { tool: "claude" }, lastViewed: null }`. Parse succeeds. `Object.keys` is exactly `version, lessons, checklists, bookmarks, prefs, lastViewed`. The schema strips unknown keys rather than rejecting them, so this assertion is on the object, not on the parse. The store must not invent its own empty shape.

### TC-D-02: markComplete writes an ISO timestamp the schema accepts
- **ACs:** P-1.1, L-5.1
- **Level:** unit
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** Vitest fake timers set to `2026-09-30T05:00:00.123Z`.
- **Steps:**
  1. `markComplete(createEmptyProgress(), "l1-first-session")`.
  2. Parse the result with `progressStateSchema`.
- **Expected:** `lessons["l1-first-session"]` deep-equals `{ completedAt: "2026-09-30T05:00:00.123Z" }` (`Date.prototype.toISOString()` output). Parse succeeds, since the contract uses `z.string().datetime({ offset: true })`. The input object is not mutated.

### TC-D-03: markComplete is idempotent and does not bump the timestamp
- **ACs:** L-5.1
- **Level:** unit
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** State after TC-D-02; advance fake timers by 60s.
- **Steps:**
  1. Call `markComplete` again for the same slug.
- **Expected:** `completedAt` is still `2026-09-30T05:00:00.123Z`, and there is one entry for the slug (AMB-D1).

### TC-D-04: Undo removes the lesson entry entirely
- **ACs:** L-5.2
- **Level:** unit
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** State with `l1-first-session` and `l2-context-files` complete.
- **Steps:**
  1. `undoComplete(state, "l1-first-session")`.
  2. `undoComplete` again on the same slug.
  3. `undoComplete` on `"never-completed"`.
- **Expected:**
  - After step 1, `"l1-first-session" in lessons === false`. The key is deleted, not set to `null` or `{}`, and `l2-context-files` is untouched.
  - Steps 2 and 3 return a deep-equal state and do not throw.

### TC-D-05: Checklist toggle writes `checklists[exerciseSlug][itemId]`
- **ACs:** E-2.1, P-1.1
- **Level:** unit
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `createEmptyProgress()`.
- **Steps:**
  1. `toggleChecklistItem(state, "ex-fx-auto", "c1", true)`.
  2. Toggle `c1` to `false`.
  3. Toggle `c1` to `true` twice.
- **Expected:**
  - Step 1: `checklists["ex-fx-auto"].c1 === true`.
  - Step 2: `c1` is `false` or the key is removed. Either is allowed; the schema (`z.record(z.string(), z.boolean())`) accepts both.
  - Step 3: `c1 === true`, one key.
  - No other exercise key is created.

### TC-D-06: Bookmark toggles write `{ [id]: iso }` records, lessons and news independent
- **ACs:** L-8.1, N-5.1, P-1.1
- **Level:** unit
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** Fake time `2026-09-30T05:00:00.000Z`; `NEWS_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7"`.
- **Steps:**
  1. `toggleBookmark(state, "lessons", "l1-first-session")`.
  2. `toggleBookmark(state, "news", NEWS_ID)`.
  3. `toggleBookmark(state, "lessons", "l1-first-session")` again.
- **Expected:**
  - After step 2: `bookmarks.lessons` deep-equals `{ "l1-first-session": "2026-09-30T05:00:00.000Z" }` and `bookmarks.news` deep-equals `{ [NEWS_ID]: "2026-09-30T05:00:00.000Z" }`. News is keyed by item `id`, not by URL or title. Neither value is an array.
  - After step 3: `bookmarks.lessons` is `{}` and the news bookmark remains.
  - Priority is P0 because the record shape is the cross-workstream contract (WS-F and M2 write it).

### TC-D-07: setToolPref accepts only `claude` and `codex`
- **ACs:** P-1.1, L-2.3
- **Level:** unit
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** `createEmptyProgress()`.
- **Steps:**
  1. `setToolPref(state, "codex")`.
  2. `setToolPref(state, "cursor")`, `setToolPref(state, "")`, `setToolPref(state, "CODEX")`.
- **Expected:**
  - Step 1: `prefs.tool === "codex"`.
  - Step 2: each call leaves `prefs.tool` unchanged, or throws a typed error that the caller catches. A value outside `toolSchema` (`"claude" | "codex"`) never reaches storage.

### TC-D-08: Serializer output always re-parses with the schema
- **ACs:** P-1.1
- **Level:** unit
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** Property test (fast-check) that generates sequences of 1–50 reducer actions: complete, undo, toggle checklist, bookmark lesson/news, set pref, set `lastViewed`. Slugs include unicode such as `"l1-ünicode"`.
- **Steps:**
  1. Apply each sequence to `createEmptyProgress()`, then `JSON.stringify`, `JSON.parse` and validate with `progressStateSchema`.
- **Expected:**
  - 100% of generated runs validate.
  - `lastViewed` is always `null` or `{ slug, at }`, with `at` an ISO datetime.
  - No `undefined` values, functions or `Date` objects leak into the stored JSON.

---

## Suite 2: Persistence (P-1)

### TC-D-09: All state lives under the single key `fm-playground:v1`
- **ACs:** P-1.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-empty`, fresh context.
- **Steps:**
  1. Open `/lessons/l1-first-session`. Click `getByRole('button', { name: 'Mark complete' })`.
  2. Check `getByRole('group', { name: 'Checklist' }).getByRole('checkbox', { name: 'Test is green' })`.
  3. Click `getByRole('tablist', { name: 'Tool' }).getByRole('tab', { name: 'Codex CLI' })`.
  4. Click `getByRole('button', { name: 'Bookmark', exact: true })`.
  5. Read `Object.keys(localStorage)` and `readProgress(page)`.
- **Expected:**
  - `Object.keys(localStorage)` equals `["fm-playground:v1"]`. `sessionStorage` has no app keys, apart from the transient archive focus flag (DESIGN §6.6), which this route never sets.
  - The doc passes `progressStateSchema`, with:
    - `lessons["l1-first-session"].completedAt` set;
    - `checklists["ex-fx-auto"].c1 === true`;
    - `prefs.tool === "codex"`;
    - `Object.keys(bookmarks.lessons)` equal to `["l1-first-session"]`, with an ISO value;
    - `lastViewed.slug === "l1-first-session"` and `lastViewed.at` an ISO datetime.
  - The bookmark button has `aria-pressed="true"`.

### TC-D-10: Progress survives a reload
- **ACs:** P-1.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-one-complete`.
- **Steps:**
  1. Open `/curriculum`, then `page.reload()`.
- **Expected:**
  - Before and after the reload, `getByRole('progressbar', { name: 'Level 1' })` has `aria-valuenow="50"`, and the `l1-first-session` row shows the "Completed" badge.
  - `readProgress(page)` deep-equals the seeded doc. `lastViewed` is unchanged because no lesson was opened.

### TC-D-11: Progress survives a browser restart in the same profile
- **ACs:** P-1.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; Playwright `chromium.launchPersistentContext(tmpUserDataDir)`.
- **Steps:**
  1. In the persistent context, open `/lessons/l2-context-files`, click "Mark complete" and check `CLAUDE.md written`.
  2. Close the context (full browser shutdown), then relaunch `launchPersistentContext` with the same `tmpUserDataDir`.
  3. Open `/lessons/l2-context-files`.
- **Expected:** With no user action, `getByText('Completed ✓ · Undo')` and `getByRole('button', { name: 'Undo' })` are visible, and the `CLAUDE.md written` checkbox is checked.

### TC-D-12: A different browser profile starts empty
- **ACs:** P-1.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Negative
- **Preconditions / fixtures:** After TC-D-11, a new non-persistent context.
- **Steps:**
  1. Open `/curriculum`.
- **Expected:**
  - No lesson shows the "Completed" badge, and every `progressbar` "Level <n>" has `aria-valuenow="0"`.
  - `localStorage.getItem("fm-playground:v1")` is `null` (TC-D-13).

### TC-D-13: Read-only page loads do not write storage
- **ACs:** P-1.1, P-5.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`, `ls-empty`; an init script wraps `Storage.prototype.setItem` to count calls for `fm-playground:v1`.
- **Steps:**
  1. Visit `/curriculum`, `/exercises`, `/bookmarks`, `/progress` and `/news`.
- **Expected:**
  - Zero `setItem` calls. Opening a lesson writes `lastViewed`, so lesson routes are excluded here.
  - Rationale: writing defaults on load could overwrite a doc that another tab is in the middle of writing.

---

## Suite 3: Corrupted state (P-2)

### TC-D-14: Invalid JSON resets and shows the notice
- **ACs:** P-2.1, S9-10
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `fx-base`, `ls-corrupt-json` (`{"version":1,`), `collectConsole(page)` with a `pageerror` listener.
- **Steps:**
  1. Open `/curriculum`.
  2. Locate `notice = getByRole('status').filter({ hasText: 'Saved progress was unreadable and has been reset' })`.
  3. Read `readProgress(page)`.
- **Expected:**
  - `notice` is visible and is not `role=alert` (`getByRole('alert')` count is 0, per DESIGN §4.10: a warning is never an alert).
  - It contains the body "If you exported a backup, you can import it on the Progress page." with a link to `/progress`, and a `button` "Dismiss".
  - All fixture lesson rows render without the "Completed" badge.
  - The stored value is now `createEmptyProgress()`, or absent.
  - Zero `pageerror` events and zero `console.error`.

### TC-D-15: Corruption variants all take the same path
- **ACs:** P-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `fx-base`. Parametrize the raw stored string over:
  - `ls-corrupt-schema` (`{"version":1,"lessons":"nope"}`)
  - `null`, `42`, `[]`, `"just a string"`, `{}`
  - the **old array bookmark shape**: a valid doc except `"bookmarks":{"lessons":[],"news":[]}`
  - `"bookmarks":{"lessons":{"l1-first-session":"yesterday"},"news":{}}`
  - `"prefs":{"tool":"vim"}`
  - `"lastViewed":"l1-first-session"` (a string, not `{slug, at}`)
  - `"lessons":{"l1-first-session":{"completedAt":"yesterday"}}`
- **Steps:**
  1. For each value, `seedProgress` the raw string and open `/lessons/l1-first-session`.
- **Expected:**
  - Every variant shows the verbatim notice (`status` filtered by text), renders the lesson, and ends with a stored doc that passes `progressStateSchema`.
  - No variant throws, and `pageerror` count is 0 across all runs.
  - The array-bookmark, `"yesterday"` and `vim` variants prove that field formats are checked, not only top-level types.

### TC-D-16: Oversized garbage (5 MB) does not hang or crash
- **ACs:** P-2.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base`; seed `"x".repeat(5*1024*1024)`. If `setItem` throws while seeding, use 4.5 MB.
- **Steps:**
  1. Open `/curriculum` and time how long the first lesson row link takes to become visible.
- **Expected:**
  - The notice appears and the lesson rows are visible within 3s.
  - The stored value is replaced by a valid empty doc, which frees the storage.
  - `pageerror` count is 0.

### TC-D-17: The corruption notice is dismissible and does not reappear
- **ACs:** P-2.1, S9-10
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-corrupt-json`.
- **Steps:**
  1. Open `/curriculum`. Press Tab until `getByRole('status').filter({ hasText: 'Saved progress was unreadable' }).getByRole('button', { name: 'Dismiss' })` is focused, then press Enter.
  2. Client-navigate to `/lessons/l1-first-session`, then run `page.reload()`.
- **Expected:**
  - Step 1: the notice leaves the accessibility tree, and focus moves to the page `h1` "Curriculum" (`tabindex=-1`, DESIGN §4.10).
  - Step 2: the notice is not shown again. Dismissal is session-only, and the stored doc is now valid.
  - No `getByRole('alert')` exists at any point.

### TC-D-18: Corruption notice appears on any first page
- **ACs:** P-2.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`, `ls-corrupt-schema`. Parametrize the entry route over all progress-bearing routes and `/news`.
- **Steps:**
  1. Open the route directly.
- **Expected:**
  - The verbatim notice is visible in the global notices slot above the page `h1` (DESIGN §4.11) on every entry route. This includes `/news`, which has no progress UI of its own.

### TC-D-19: A valid write after reset does not trigger the notice
- **ACs:** P-2.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Negative
- **Preconditions / fixtures:** `fx-base`, `ls-corrupt-json`.
- **Steps:**
  1. Open `/lessons/l1-first-session`, dismiss the notice, click "Mark complete", then reload.
- **Expected:**
  - After the reload there is no notice, and `completedAt` is present.
  - This guards against a stale "was corrupted" flag stored alongside the doc.

---

## Suite 4: Storage unavailable (P-3)

### TC-D-20: localStorage access throws: every page renders with the banner
- **ACs:** P-3.1, S9-10
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `fx-base`, `blockStorage(page)` (the getter, `getItem` and `setItem` throw `SecurityError`), `collectConsole(page)`.
- **Steps:**
  1. Visit each progress-bearing route plus `/news` and `/news/archive`.
- **Expected:** On every page:
  - The main content renders: lesson rows, lesson heading, digest list.
  - `getByRole('status').filter({ hasText: "Progress can't be saved in this browser" })` is visible. It contains the body "Everything still works for this visit. Private windows and blocked site data prevent saving." and has **no** "Dismiss" button (DESIGN §4.11).
  - There is no `pageerror` and no `console.error`.
  - The P-2 corruption notice is not shown.

### TC-D-21: Progress controls work for the session when storage is blocked
- **ACs:** P-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `fx-base`, `blockStorage(page)`.
- **Steps:**
  1. Open `/lessons/l1-first-session` and click "Mark complete".
  2. Check `Test is green`, click the `Codex CLI` tab in tablist "Tool", then click `button` "Bookmark".
  3. Client-navigate with `getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Curriculum' })`, then with the "Bookmarks" link.
  4. Run `page.reload()`.
- **Expected:**
  - Step 1: `getByText('Completed ✓ · Undo')` is visible, and `#fm-live` reads "Lesson marked complete".
  - Step 2: the URL has `?tool=codex` (DESIGN §4.4 step 6), and the bookmark has `aria-pressed="true"`.
  - Step 3: on `/curriculum`, `progressbar` "Level 1" has `aria-valuenow="50"`. On `/bookmarks`, `region` "Lessons (1)" lists the lesson link.
  - Step 4: all of it is gone (it was in memory only), and the banner is still shown.
  - No errors occur at any step.

### TC-D-22: Quota exceeded only on write
- **ACs:** P-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `fx-base`, `ls-one-complete`; an init script makes `setItem` throw `DOMException('QuotaExceededError')` while `getItem` works.
- **Steps:**
  1. Open `/curriculum`, where the read succeeds.
  2. Open `/lessons/l2-context-files` and click "Mark complete".
- **Expected:**
  - Step 1: `progressbar` "Level 1" has `aria-valuenow="50"`, so the read path works.
  - Step 2: the UI shows `Completed ✓ · Undo` for the session. After the failed write, `getByRole('status').filter({ hasText: "Progress can't be saved in this browser" })` is visible.
  - No uncaught error. The stored doc is unchanged (still the seeded one).

### TC-D-23: `window.localStorage` is undefined
- **ACs:** P-3.1
- **Level:** unit
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** jsdom with `Object.defineProperty(window, 'localStorage', { value: undefined })`.
- **Steps:**
  1. Initialise the progress store and dispatch `markComplete`.
- **Expected:** The store reports `storageAvailable === false`, keeps its state in memory with the lesson set, and does not throw.

### TC-D-24: Server environment never touches localStorage
- **ACs:** P-3.1, P-5.1
- **Level:** unit
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** Vitest `environment: 'node'` (no `window`).
- **Steps:**
  1. Import every module under `src/lib/progress/`, then render the progress provider with `react-dom/server` `renderToString`.
- **Expected:** No `ReferenceError` for `window` or `localStorage`, and the output contains no progress values (TC-D-30).

### TC-D-51: Blocked storage wins over corruption; only one banner shows
- **ACs:** P-3.1, P-2.1, S9-10
- **Level:** unit
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** Component test of the `GlobalNotices` slot with the store in the state `{ storageAvailable: false, resetFromCorruption: true }`. A storage that throws on `setItem` while `getItem` returns `ls-corrupt-json` produces exactly this state.
- **Steps:**
  1. Render.
- **Expected:**
  - Only the storage banner "Progress can't be saved in this browser." is rendered. The corrupted-state notice is not (DESIGN §4.11: "If both would show, show only the storage banner").
  - Exactly one element has `role=status` in the slot.

---

## Suite 5: Content drift and migration (P-4)

### TC-D-25: Orphan lesson slug is kept in storage and not rendered
- **ACs:** P-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`, `ls-orphans` (`lessons["deleted-lesson-slug"]` with a valid `completedAt`, and `lastViewed.slug === "deleted-lesson-slug"`), `collectConsole(page)`.
- **Steps:**
  1. Open `/curriculum`, `/bookmarks` and `/progress`.
  2. On `/lessons/l1-first-session`, click "Mark complete", which causes a write.
  3. Run `readProgress(page)`.
- **Expected:**
  - No page shows the text `deleted-lesson-slug`, and the level counts ignore it.
  - After step 2, `progressbar` "Level 1" has `aria-valuenow="50"`, not 100.
  - After the write, `lessons["deleted-lesson-slug"]` is still present with its original `completedAt`. `lastViewed` now points to `l1-first-session`.
  - No console errors.

### TC-D-26: Archived lesson in storage is kept but hidden, including on /bookmarks
- **ACs:** P-4.1, C-1.3, L-8.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`. Seed:
  - `lessons: { "l2-retired": { completedAt: "2026-09-01T00:00:00.000Z" } }`
  - `bookmarks.lessons: { "l2-retired": "2026-09-01T00:00:00.000Z" }`
  - `bookmarks.news: { "<n01.id>": "2026-09-30T02:00:00.000Z" }`
- **Steps:**
  1. Open `/curriculum`.
  2. Open `/bookmarks`.
- **Expected:**
  - Step 1: `progressbar` "Level 2" has `aria-valuenow="0"`, so the archived lesson is not counted.
  - Step 2: the archived bookmark is **hidden** (DESIGN §6.7, "Missing lesson (archived or removed slug): hidden, per P-4"). The lessons section shows the muted line "No lessons bookmarked." and no link to `/lessons/l2-retired`. `region` `/^News \(1\)$/` lists `n01`.
  - Storage keeps both `l2-retired` entries.
  - The lessons region's name when it has 0 visible items is AMB-D10.

### TC-D-27: Orphan checklist item ID and orphan exercise slug
- **ACs:** P-4.1, E-2.2, S9-11
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`, `ls-orphans` (`checklists["ex-fx-auto"] = { c1: true, zzz: true }`), plus `checklists["ex-gone"] = { a: true }`.
- **Steps:**
  1. Open `/lessons/l1-first-session` and inspect the exercise region.
  2. Check `No test files edited` and `Diff reviewed`.
- **Expected:**
  - Step 1: the checklist header reads "1 of 3 done", and `progressbar` "Checklist" has `aria-valuenow="33"` (rounding per AMB-C1). The UI never mentions `zzz` or `ex-gone`, and there is no console output.
  - Step 2: "Exercise complete" appears, and `#fm-live` reads "Exercise complete".
  - Storage still holds `zzz: true`, and `ex-gone` is untouched.

### TC-D-28: v1 → v2 migration fixture is a no-op
- **ACs:** P-4.2
- **Level:** unit
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:**
  - `tests/fixtures/progress/v1-full.json`, with every field populated: 2 lessons, 2 checklists, `bookmarks.lessons` with 1 entry, `bookmarks.news` with 1 entry, `prefs.tool: "codex"` and `lastViewed: { slug, at }`.
  - The registered `migrations` map in `src/lib/progress/`.
- **Steps:**
  1. Run `migrate(v1Doc, { to: 2 })` with a test-only v1→v2 migration that is the identity on data.
  2. Run `migrate(v1Doc)` with the production registry (current `PROGRESS_VERSION` = 1).
- **Expected:**
  - Step 1: returns a doc with `version: 2`, and every other field deep-equal to the input.
  - Step 2: returns the input unchanged, passing `progressStateSchema` with `version: 1`.
  - The registry is ordered by from-version, so a future v2→v3 can be appended without editing v1→v2.

### TC-D-29: Unknown versions (v0, v2 on a v1 app, missing, string)
- **ACs:** P-4.2, P-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** `fx-base`. Parametrize over:
  - `ls-v0`
  - `ls-v2` (valid v1 shape but `version: 2`)
  - a doc without `version`
  - a doc with `version: "1"`
- **Steps:**
  1. Open `/curriculum` with each doc, and read storage after the load.
- **Expected (per AMB-05, pending decision):**
  - No crash and no `pageerror`.
  - `ls-v0`, the missing version and the string version follow the P-2 path: the verbatim `status` notice and a reset.
  - For `ls-v2`, the assumed behavior is also notice plus reset. The app must never silently overwrite a newer doc without the notice.

---

## Suite 6: Hydration safety (P-5, S9-09)

### TC-D-30: Server HTML contains no progress state
- **ACs:** P-5.1, S9-09
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`. Use Playwright `request.get()`, which runs no JS and has no storage.
- **Steps:**
  1. GET each progress-bearing route and capture the HTML body.
- **Expected:** The HTML contains none of the following:
  - `Completed ✓`, `Exercise complete`, `role="progressbar"` (DESIGN §11.2: not rendered before hydration)
  - a `checked` attribute on checklist inputs
  - `aria-pressed="true"` on any bookmark button
  - the strings "not started" / "Not started"

  It does contain:
  - `data-testid="progress-placeholder"` elements with `aria-busy="true"` where progress will render
  - checklist inputs that are unchecked and `disabled` (DESIGN §4.6)
  - bookmark buttons with `aria-pressed="false"` and `aria-disabled="true"` (DESIGN §4.12)
  - on `/bookmarks`, `data-testid="bookmarks-skeleton"` and **not** the text "Nothing bookmarked yet" (DESIGN §6.7)

### TC-D-31: No hydration warnings with stored progress on any route
- **ACs:** P-5.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`. Seed `ls-one-complete` with these additions:
  - `checklists["ex-fx-auto"].c1 = true`
  - `bookmarks.lessons["l1-first-session"]`
  - `prefs.tool: "codex"`

  `collectConsole(page)` matches `/hydrat/i`, `/did not match/i`, `/server rendered HTML didn't match the client/i` and `/Minified React error #(418|423|425)/`.
- **Steps:**
  1. Visit each progress-bearing route, plus `/lessons/l1-first-session?tool=claude`, and wait for `networkidle`.
- **Expected:**
  - Zero matching console messages and zero `pageerror`.
  - After hydration the stored state shows: the completed row, a checked `Test is green`, and a bookmark with `aria-pressed="true"`.
  - On `/lessons/l1-first-session` without `?tool`, the `Codex CLI` tab in tablist "Tool" is selected and the URL becomes `?tool=codex` via `replaceState` (DESIGN §4.4 step 2).
  - With `?tool=claude`, `Claude Code` is selected, and `prefs.tool` is still `"codex"` afterwards (step 3).

### TC-D-32: No "not started" flash between first paint and hydration
- **ACs:** P-5.1, S9-09
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:**
  - `fx-base`, `ls-one-complete`.
  - `page.route` delays the main client JS chunk by 1500 ms.
  - A MutationObserver init script records every text value of the `l1-first-session` row's status area.
- **Steps:**
  1. Open `/curriculum` and wait until the row shows "Completed".
  2. Read the recorded sequence.
- **Expected:**
  - The sequence is `placeholder → Completed` only. It never contains a "not started" value before "Completed".
  - The placeholder occupies the same box: the row height delta is 0px, checked with `boundingBox()` before and after.

### TC-D-33: Store initialises after mount, not during render
- **ACs:** P-5.1
- **Level:** unit
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** React Testing Library. Use `hydrateRoot` on a component tree over server HTML from `renderToString`, with localStorage seeded with `ls-one-complete`. Spy on `console.error`.
- **Steps:**
  1. Hydrate and flush effects.
- **Expected:** `console.error` is not called. After the effects run, the component shows completed.

---

## Suite 7: Cross-tab behavior

### TC-D-34: A change in one tab reaches another tab
- **ACs:** P-1.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`, `ls-empty`; two pages `A` and `B` in the same context.
- **Steps:**
  1. `B` opens `/curriculum`. `A` opens `/lessons/l1-first-session` and clicks "Mark complete".
  2. Without reloading `B`, wait up to 2s.
- **Expected (AMB-D3):**
  - Assumed: `B`'s `progressbar` "Level 1" updates to `aria-valuenow="50"` through the `storage` event.
  - If the decision is "no live sync": `B` shows the change after a reload, and `B` must not overwrite `A`'s write on its next action (TC-D-35).

### TC-D-35: Interleaved writes from two tabs never produce an invalid doc
- **ACs:** P-1.1, P-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`, `ls-empty`; pages `A` and `B` both on `/lessons/l1-first-session`, loaded before any write.
- **Steps:**
  1. `A` clicks "Mark complete".
  2. `B` checks `Test is green`.
  3. `A` clicks `button` "Bookmark".
  4. Repeat steps 1–3 20 times, with the clicks in each repeat fired together through `Promise.all`.
  5. Open a third page `C` on `/curriculum`.
- **Expected:**
  - After every step, the stored value passes `progressStateSchema`. An interval reader in `C` checks this.
  - `C` shows no corruption notice.
  - Each write is a read-modify-write, so step 2 does not erase step 1's `completedAt`.
  - At the end, `lessons["l1-first-session"]` and `checklists["ex-fx-auto"].c1` are both present.

---

## Suite 8: Export and import (P-6)

### TC-D-36: Export downloads the dated file, copies JSON and announces
- **ACs:** P-6.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:**
  - `fx-base`, `ls-one-complete`.
  - `context.grantPermissions(['clipboard-read','clipboard-write'])`.
  - `page.clock.setFixedTime('2026-09-30T13:00:00+08:00')`.
- **Steps:**
  1. Open `/progress`, set up `const dl = page.waitForEvent('download')`, then click `getByRole('button', { name: 'Export progress' })`.
  2. Read `dl.suggestedFilename()`, the downloaded file and `navigator.clipboard.readText()`.
- **Expected:**
  - The filename is exactly `fm-playground-progress-2026-09-30.json`.
  - The file content and the clipboard text both `JSON.parse` to a doc deep-equal to `readProgress(page)`, and pass `progressStateSchema`.
  - `#fm-live` reads "Progress exported and copied".
  - The inline text "Downloaded and copied to clipboard." is visible (DESIGN §6.8).

### TC-D-37: Export filename date near midnight
- **ACs:** P-6.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Boundary
- **Preconditions / fixtures:** As TC-D-36, with browser clock `2026-09-30T23:30:00Z` (2026-10-01 07:30 Manila) and context `timezoneId: 'America/Los_Angeles'` (2026-09-30 16:30 local).
- **Steps:**
  1. Export.
- **Expected (AMB-D5):**
  - Assumed: the Asia/Manila date, following DESIGN §7 ("Dates: absolute, Asia/Manila"), so `fm-playground-progress-2026-10-01.json`.
  - If the decision is the browser's local date, the expected filename is `2026-09-30`. The case exists so that the choice is explicit.

### TC-D-38: Export with storage blocked or clipboard denied
- **ACs:** P-6.1, P-3.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Error
- **Preconditions / fixtures:**
  - Variant A: `blockStorage(page)`, with one lesson marked complete earlier in the session.
  - Variant B: `ls-one-complete`, clipboard permission not granted (or `navigator.clipboard.writeText` rejects).
- **Steps:**
  1. Click "Export progress".
- **Expected:**
  - A: the download still happens and contains the in-session state.
  - B: the download still happens, and the inline text reads exactly "Downloaded. Copy to clipboard was blocked.".
  - B is not an error: there is no `getByRole('alert')` and no `pageerror`.

### TC-D-39: Import a valid file: preview, then replace only on confirm
- **ACs:** P-6.2
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; current state `ls-one-complete`. Import file `tests/fixtures/progress/import-valid.json`, a `progressStateSchema`-valid doc with:
  - 3 completed lessons: `l1-first-session`, `l1-permissions`, `l2-context-files`
  - `bookmarks.lessons` with 1 entry and `bookmarks.news` with 2 entries (`n01`, `n02` ids)
  - `prefs.tool: "codex"`
- **Steps:**
  1. Open `/progress` and call `getByLabel('Import progress file').setInputFiles(file)`.
  2. Locate `preview = getByRole('status').filter({ hasText: 'Importing replaces everything saved in this browser.' })`. Read it, do nothing else, then run `readProgress(page)`.
  3. Click `getByRole('button', { name: 'Replace my progress' })`.
- **Expected:**
  - Step 2: `preview` contains "This file has 3 lessons, 3 bookmarks" (lesson and news bookmarks summed, as in DESIGN §6.8). The "exported <date>" suffix follows AMB-D9. Storage still deep-equals `ls-one-complete`, since nothing is written yet.
  - Step 3: storage deep-equals the imported doc. This is a full replace: nothing from `ls-one-complete` that was absent from the file remains.
  - The status "Progress imported: 3 lessons, 3 bookmarks." is visible and focused.
  - `/curriculum`, opened by client navigation, shows `progressbar` "Level 1" with `aria-valuenow="100"`.

### TC-D-40: Cancelling import leaves state untouched
- **ACs:** P-6.2
- **Level:** e2e
- **Priority:** P1
- **Category:** Negative
- **Preconditions / fixtures:** As TC-D-39.
- **Steps:**
  1. Select the file. At the preview, click `getByRole('button', { name: 'Cancel' })`.
- **Expected:**
  - Storage is byte-identical to before (compare the raw strings).
  - The preview is removed, and the file input's `value` is `""`.
  - Focus is on `getByLabel('Import progress file')`.
  - No dialog is ever opened (`getByRole('dialog')` count is 0).

### TC-D-41: Import rejects invalid files without touching state
- **ACs:** P-6.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** `fx-base`, `ls-one-complete`. Files:
  - `import-bad-json.json` (`{"version":1,`)
  - `import-no-version.json` (a valid doc without `version`)
  - `import-bad-schema.json` (`{"version":1,"lessons":[]}`)
  - `import-array-bookmarks.json` (the old `bookmarks: {lessons: [], news: []}` shape)
  - `import-v99.json` (a valid shape with `version: 99`)
  - `import-empty.json` (0 bytes)
  - `import-photo.png` (a PNG renamed to `.json`)
  - `import-10mb.json` (a 10 MB valid JSON array)
- **Steps:**
  1. Select each file in turn.
- **Expected:**
  - Each file shows `getByRole('alert')` containing "This file isn't a valid progress export." plus a reason: `import-bad-json.json` → "invalid JSON", `import-no-version.json` → "missing `version`" (DESIGN §6.8). Reasons for the others are unspecified (AMB-D4); assert only the lead sentence.
  - No preview `status` and no "Replace my progress" button appear.
  - Storage stays byte-identical to `ls-one-complete`, and there is no `pageerror`.
  - The 10 MB file is rejected within 3s without freezing the tab.
  - Priority is P0 because a bad import would corrupt the P0 contract.

### TC-D-42: Import strips prototype-pollution payloads
- **ACs:** P-6.2, P-1.1
- **Level:** unit
- **Priority:** P0
- **Category:** Security
- **Preconditions / fixtures:** This file text:
  `{"version":1,"lessons":{"__proto__":{"polluted":true},"constructor":{"prototype":{"x":1}}},"checklists":{},"bookmarks":{"lessons":{"__proto__":"2026-09-30T00:00:00.000Z"},"news":{}},"prefs":{"tool":"claude","__proto__":{"isAdmin":true}},"lastViewed":null}`
- **Steps:**
  1. Run the import parser and validator on the text, then evaluate `({}).polluted`, `({}).isAdmin` and `Object.prototype.x`.
  2. If it validates, persist it and reload through the store.
- **Expected:**
  - `({}).polluted === undefined` and `({}).isAdmin === undefined`.
  - The resulting doc either fails validation (preferred, because lesson entries must match `{ completedAt }`) or contains no `__proto__` or `constructor` keys.
  - Run the same test on the P-2 load path, with a stored doc containing these keys.

### TC-D-43: Import with unknown slugs and news ids
- **ACs:** P-6.2, P-4.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** An import file with:
  - 2 lessons: `l1-first-session` and `lesson-from-future`
  - `bookmarks.news` with one id that is not in the DB
- **Steps:**
  1. Import and confirm, then open `/curriculum` and `/bookmarks`.
- **Expected:**
  - The preview counts what the file contains: "This file has 2 lessons, 1 bookmarks" (AMB-D6 covers unknown slugs and pluralisation).
  - After confirming, storage keeps `lesson-from-future` (P-4.1), and the curriculum ignores it.
  - On `/bookmarks`, `region` "News (1)" shows "Item no longer available" with a "Remove bookmark" button.

---

## Suite 9: Reset (P-7)

### TC-D-44: Reset requires typing `reset`; inline, no dialog
- **ACs:** P-7.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-one-complete`.
- **Steps:**
  1. Open `/progress`. Locate `input = getByRole('textbox', { name: 'Type reset to confirm' })` and `btn = getByRole('button', { name: 'Reset all progress' })`.
  2. Read `btn`'s `aria-disabled`.
  3. Type `reset` into `input` and click `btn`.
- **Expected:**
  - Step 2: `btn` has `aria-disabled="true"`. It is `aria-disabled`, not the `disabled` attribute, so it stays focusable.
  - Step 3: storage becomes `createEmptyProgress()` or the key is removed.
  - `getByRole('status').filter({ hasText: 'All progress has been reset.' })` is visible and focused.
  - `/curriculum`, opened by client navigation, has every level progressbar at `aria-valuenow="0"`.
  - `getByRole('dialog')` count is 0 throughout.
  - The text "This can't be undone" is near the button, and a link "Export a backup first." is in the danger-zone body.

### TC-D-45: Near-miss confirmation text keeps the button disabled; trimmed input is accepted
- **ACs:** P-7.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Negative
- **Preconditions / fixtures:** As TC-D-44.
- **Steps:**
  1. Type each value in turn: `Reset`, `RESET`, `rese`, `resett`, `rеset` (Cyrillic `е`, U+0435), `reset ` (trailing space), ` reset` (leading space).
  2. For each, click `btn` and also press Enter in the input.
- **Expected:** DESIGN §6.8: the value is trimmed and compared case-sensitively.
  - `Reset`, `RESET`, `rese`, `resett` and the Cyrillic variant keep `aria-disabled="true"`. Clicking or pressing Enter shows the field error "Type reset exactly to confirm.", linked by `aria-describedby`, and storage is unchanged.
  - `reset ` and ` reset` enable the button (`aria-disabled` is absent or `"false"`). Only the first of the two may be submitted in the run; reseed before the second.

### TC-D-46: No accidental reset: clearing or leaving the input
- **ACs:** P-7.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Negative
- **Preconditions / fixtures:** As TC-D-44.
- **Steps:**
  1. Type `reset` into the textbox, then clear it.
  2. Type `reset` again, client-navigate to `/curriculum`, then return to `/progress`.
- **Expected:**
  - Step 1: the button is back to `aria-disabled="true"`.
  - Step 2: storage is byte-identical to `ls-one-complete`, and the textbox is empty on return.
  - No reset happens without a click (or Enter) on an enabled button.

---

## Suite 10: Bookmarks page (L-8.1, N-5.1, S9-19, S9-20)

### TC-D-47: Empty bookmarks state
- **ACs:** S9-19, L-8.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-empty`.
- **Steps:**
  1. Open `/bookmarks` and wait for hydration (`bookmarks-skeleton` detached).
- **Expected:**
  - `getByRole('region', { name: 'Nothing bookmarked yet' })` is visible. It contains the body "Use the Bookmark button on any lesson or news item. Bookmarks stay in this browser." and the links "Browse curriculum" (`href="/curriculum"`) and "Today's digest" (`href="/news"`).
  - No `/^Lessons \(\d+\)$/` or `/^News \(\d+\)$/` region is rendered.
  - Before hydration the empty state is absent (TC-D-30).

### TC-D-48: Lessons and news bookmarks listed in two sections, newest first
- **ACs:** L-8.1, N-5.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-bookmarks`:
  - lessons: `l1-first-session` at `2026-09-29T01:00:00.000Z`, `l2-memory` at `2026-09-29T03:00:00.000Z`
  - news: `n01` at `2026-09-30T02:00:00.000Z`, `n27` at `2026-09-30T01:00:00.000Z`
- **Steps:**
  1. Open `/bookmarks`.
  2. Read the links in DOM order inside `getByRole('region', { name: /^Lessons \(\d+\)$/ })`.
  3. Read the `article`s inside `getByRole('region', { name: /^News \(\d+\)$/ })`.
- **Expected:**
  - The regions are named exactly "Lessons (2)" and "News (2)", with the lessons region first in DOM order.
  - Lessons, in order: `l2-memory`, then `l1-first-session`. Each is a `link` named by the lesson title, pointing to `/lessons/<slug>`, with a toggle `button` "Bookmark: <title>" at `aria-pressed="true"`.
  - News, in order: `n01`, then `n27`, as compact NewsCard `article`s. Each title link matches `/^<title> \(opens in new tab\)$/` and points to the source URL, with the title taken from the DB.
  - The order is by the ISO value in the record, not by insertion order. Seed the records with keys in the opposite order to prove it.

### TC-D-49: Bookmarked news item removed from the DB
- **ACs:** N-5.1, S9-20
- **Level:** e2e
- **Priority:** P1
- **Category:** Error
- **Preconditions / fixtures:** `fx-base`; `ls-orphans` (`bookmarks.news` includes `00000000-0000-4000-8000-000000000000`, which is not in the DB) plus a valid `n01` bookmark; `collectConsole(page)`.
- **Steps:**
  1. Open `/bookmarks`.
  2. Click `getByRole('button', { name: 'Remove bookmark' })`.
- **Expected:**
  - Step 1: `region` "News (2)" contains one card with the text exactly "Item no longer available", no link, and a `button` "Remove bookmark". The `n01` card renders normally. There is no error boundary and no `console.error`, and the missing id does not trigger a request loop.
  - Step 2: the id is removed from `bookmarks.news` in storage, `#fm-live` reads "Removed from bookmarks", and the region is renamed "News (1)".

### TC-D-50: Bookmarks page when the DB is down
- **ACs:** L-8.1, S9-01
- **Level:** e2e
- **Priority:** P1
- **Category:** Error
- **Preconditions / fixtures:** The app is started with `supabase-down`; `ls-bookmarks`.
- **Steps:**
  1. Open `/bookmarks`.
- **Expected:**
  - The app-wide DB-down page shows: h1 "Database unavailable", text exactly `DB_UNAVAILABLE_MESSAGE` ("Can't reach the local database. Run `supabase start` then `npm run seed`."), and a `button` "Copy code: Terminal".
  - It does **not** show "Item no longer available" for every entry.
  - Stored bookmarks are untouched: a DB outage is never read as "items deleted".

### TC-D-52: Removing a bookmark: focus, announcement and Undo
- **ACs:** L-8.1, N-5.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-bookmarks`; `page.clock.install()` so the 8s undo window can be fast-forwarded.
- **Steps:**
  1. Open `/bookmarks`. In region "Lessons (2)", click `button` "Bookmark: <l2-memory title>".
  2. Read `#fm-live` and `document.activeElement`.
  3. Click `getByRole('button', { name: 'Undo' })`.
  4. Remove the same bookmark again, then run `page.clock.fastForward(8000)`.
- **Expected:**
  - Step 2: the row is removed, `#fm-live` reads "Removed from bookmarks", focus is on the `l1-first-session` link (the next row), the region is renamed "Lessons (1)", and `bookmarks.lessons` no longer has `l2-memory`.
  - Step 3: the row and the storage entry are restored with the original ISO value, and the region is "Lessons (2)" again.
  - Step 4: after 8s the "Undo" button is gone, and the bookmark stays removed.

### TC-D-53: One empty section shows a muted line, not the full empty state
- **ACs:** L-8.1, S9-19
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; only `bookmarks.news` has an entry (`n01`).
- **Steps:**
  1. Open `/bookmarks`.
- **Expected:**
  - The lessons section shows the text "No lessons bookmarked." and no EmptyState region "Nothing bookmarked yet".
  - Region "News (1)" lists `n01`.
  - The lessons region's accessible name follows AMB-D10.

---

## Coverage

| AC / state | Cases |
|---|---|
| P-1.1 | TC-D-01, 02, 05, 06, 07, 08, 09, 10, 11, 12, 13, 34, 35, 42 |
| P-2.1 | TC-D-14, 15, 16, 17, 18, 19, 29, 35, 51 |
| P-3.1 | TC-D-20, 21, 22, 23, 24, 38, 51 |
| P-4.1 | TC-D-25, 26, 27, 43 |
| P-4.2 | TC-D-28, 29 |
| P-5.1 | TC-D-13, 24, 30, 31, 32, 33 |
| P-6.1 | TC-D-36, 37, 38 |
| P-6.2 | TC-D-39, 40, 41, 42, 43 |
| P-7.1 | TC-D-44, 45, 46 |
| L-5.1 / L-5.2 (store side) | TC-D-02, 03, 04 |
| L-2.3 (store side) | TC-D-07 |
| E-2.1 / E-2.2 (store side) | TC-D-05, 27 |
| C-1.3 (storage side) | TC-D-26 |
| L-8.1 | TC-D-06, 26, 47, 48, 50, 52, 53 |
| N-5.1 | TC-D-06, 48, 49, 52 |
| S9-01 | TC-D-50 |
| S9-09 | TC-D-30, 32 |
| S9-10 | TC-D-14, 17, 20, 51 |
| S9-11 | TC-D-27 |
| S9-19 | TC-D-47, 53 |
| S9-20 | TC-D-49 |

## Ambiguities raised in this file

Global ambiguities cited here: AMB-05 (unknown versions), AMB-13 (`lastViewed` target), AMB-26 (helpers in `tests/support/`). AMB-10 (bookmark timestamps) is resolved by the contract.

| ID | Ambiguity | Assumed in these cases |
|---|---|---|
| AMB-D1 | Marking an already-completed lesson again: keep the first `completedAt` or overwrite it? | Keep the first (TC-D-03). |
| AMB-D2 | **Resolved** by DESIGN §6.7: an archived or removed lesson bookmark is hidden (kept in storage). | TC-D-26. |
| AMB-D3 | Cross-tab live sync through the `storage` event is not specified. | Live sync. The minimum guarantee is read-modify-write (TC-D-34, 35). |
| AMB-D4 | **Mostly resolved** by DESIGN §6.8 / §11.3 (export, import, reset and error copy). Still open: the import failure reasons other than "invalid JSON" and "missing `version`" (wrong version, wrong shape, empty file, too large), and whether there is a size limit. | TC-D-41 asserts only the lead sentence for those. |
| AMB-D5 | The time zone of `<YYYY-MM-DD>` in the export filename. DESIGN §7 makes displayed dates Asia/Manila but does not name the filename. | Manila (TC-D-37). |
| AMB-D6 | **Partly resolved**: DESIGN §6.8 shows one summed bookmark count ("7 lessons, 3 bookmarks"). Still open: whether unknown slugs and ids are counted, and singular/plural wording ("1 bookmarks"). | Counts reflect the file as-is; wording not asserted beyond the numbers (TC-D-43). |
| AMB-D7 | **Resolved** by DESIGN §6.8: trimmed, case-sensitive; mismatch error "Type reset exactly to confirm.". | TC-D-45. |
| AMB-D8 | **Resolved** by DESIGN §6.7 / §8 row 3: two sections, newest first within each. | TC-D-48. |
| AMB-D9 | The preview says "exported 28 Sep", but `progressStateSchema` has no export timestamp. Is the date from `File.lastModified`, the filename, or dropped? | Not asserted; the preview check stops at the counts (TC-D-39). |
| AMB-D10 | When one section has no visible items, is its region still rendered and named "Lessons (0)", or is only the muted line shown without a region? | Not asserted; TC-D-26 and TC-D-53 check the muted line only. |
