# WS-D: Progress layer (localStorage)

Scope: the `fm-playground:v1` store and its zod contract, corruption and storage-unavailable handling, version migration, hydration safety, `/progress` (export, import, reset) and `/bookmarks`.
Owned paths: `src/lib/progress/`, `src/app/progress/`, `src/app/bookmarks/`. Stories: P-1 to P-7, L-8.1 (list side), N-5.1 (storage side), §9 states S9-09, S9-10, S9-19, S9-20.
Fixtures and helpers are defined in [README §3](README.md#3-fixtures): `fx-base`, `ls-*` docs, `seedProgress`, `readProgress`, `blockStorage`, `collectConsole`. "Progress-bearing routes" below means `/`, `/curriculum`, `/lessons/l1-first-session`, `/exercises`, `/bookmarks` and `/progress`.

---

## Suite 1: Store contract and reducer (unit)

### TC-D-01: Empty state matches the P-1 contract exactly
- **ACs:** P-1.1
- **Level:** unit
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `src/lib/contracts` zod schema for the progress doc (M0). No storage.
- **Steps:**
  1. Call the store's `emptyState()` (or equivalent factory).
  2. Parse the result with the contract schema using `.strict()`.
- **Expected:** Parse succeeds. Keys are exactly `version, lessons, checklists, bookmarks, prefs, lastViewed` (no extras). `version === 1`, `lessons` and `checklists` are `{}`, `bookmarks` deep-equals `{ lessons: [], news: [] }` (or the AMB-10 entry shape with empty arrays), `prefs.tool === "claude"`, `lastViewed === null`.

### TC-D-02: markComplete writes an ISO-8601 UTC timestamp with milliseconds
- **ACs:** P-1.1, L-5.1
- **Level:** unit
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** Vitest fake timers set to `2026-09-30T05:00:00.123Z`.
- **Steps:**
  1. `markComplete(emptyState(), "l1-first-session")`.
- **Expected:** `lessons["l1-first-session"].completedAt === "2026-09-30T05:00:00.123Z"` and matches `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/`. The input object is not mutated (reducer is pure).

### TC-D-03: markComplete is idempotent and does not bump the timestamp
- **ACs:** L-5.1
- **Level:** unit
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** State after TC-D-02; advance fake timers by 60s.
- **Steps:**
  1. Call `markComplete` again for the same slug.
- **Expected:** `completedAt` is still `2026-09-30T05:00:00.123Z`; exactly one entry for the slug. (If the team prefers "latest wins", record it in AMB-D1 and change this expected; do not leave it undefined.)

### TC-D-04: Undo removes the lesson entry entirely
- **ACs:** L-5.2
- **Level:** unit
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** State with `l1-first-session` complete and `l2-context-files` complete.
- **Steps:**
  1. `undoComplete(state, "l1-first-session")`.
  2. `undoComplete` again on the same slug.
  3. `undoComplete` on `"never-completed"`.
- **Expected:** After step 1, `"l1-first-session" in lessons === false` (key deleted, not set to `null` or `{}`); `l2-context-files` untouched. Steps 2 and 3 return a deep-equal state and do not throw.

### TC-D-05: Checklist toggle writes `checklists[exerciseSlug][itemId]`
- **ACs:** E-2.1, P-1.1
- **Level:** unit
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `emptyState()`.
- **Steps:**
  1. `toggleChecklistItem(state, "ex-fx-auto", "c1", true)`.
  2. Toggle `c1` to `false`.
  3. Toggle `c1` to `true` twice.
- **Expected:** Step 1: `checklists["ex-fx-auto"].c1 === true`. Step 2: `c1` is `false` or the key is removed (either is allowed, but the schema must accept the result). Step 3: `c1 === true`, one key. No other exercise key is created.

### TC-D-06: Bookmark toggles for lessons and news are independent
- **ACs:** L-8.1, N-5.1
- **Level:** unit
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** Fake time `2026-09-30T05:00:00.000Z`; a news UUID `NEWS_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7"`.
- **Steps:**
  1. `toggleBookmark(state, "lessons", "l1-first-session")`.
  2. `toggleBookmark(state, "news", NEWS_ID)`.
  3. `toggleBookmark(state, "lessons", "l1-first-session")` again.
- **Expected:** After 2, `bookmarks.lessons` has one entry for `l1-first-session` and `bookmarks.news` one entry keyed by `NEWS_ID` (not by URL or title), each with `bookmarkedAt = "2026-09-30T05:00:00.000Z"` per AMB-10. After 3, the lesson bookmark is gone and the news bookmark remains. No duplicates are possible from repeated adds.

### TC-D-07: setToolPref accepts only `claude` and `codex`
- **ACs:** P-1.1, L-2.3
- **Level:** unit
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** `emptyState()`.
- **Steps:**
  1. `setToolPref(state, "codex")`.
  2. `setToolPref(state, "cursor")`, `setToolPref(state, "")`, `setToolPref(state, "CODEX")`.
- **Expected:** Step 1: `prefs.tool === "codex"`. Step 2: each call leaves `prefs.tool` unchanged (or throws a typed error caught by the caller); a value outside `"claude" | "codex"` never reaches storage.

### TC-D-08: Serializer output always re-parses with the schema
- **ACs:** P-1.1
- **Level:** unit
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** Property test (fast-check) generating sequences of 1–50 reducer actions (complete, undo, toggle checklist, bookmark, set pref, set lastViewed) over slugs including `""`-free unicode strings such as `"l1-ünicode"`.
- **Steps:**
  1. Apply each sequence to `emptyState()`, `JSON.stringify`, `JSON.parse`, validate with the schema.
- **Expected:** 100% of generated runs validate. No `undefined` values, functions or `Date` objects leak into the stored JSON.

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
  2. Check `getByRole('checkbox', { name: 'Test is green' })`.
  3. Select `getByRole('tab', { name: 'Codex CLI' })`.
  4. Toggle the lesson bookmark on the header (`getByRole('button', { name: /Bookmark/ })`).
  5. In the page, read `Object.keys(localStorage)` and `readProgress(page)`.
- **Expected:** `Object.keys(localStorage)` equals `["fm-playground:v1"]` (the app writes no other key; sessionStorage is also empty of app keys). The parsed doc validates against the strict schema with `lessons["l1-first-session"].completedAt` set, `checklists["ex-fx-auto"].c1 === true`, `prefs.tool === "codex"`, one lesson bookmark, `lastViewed` referencing `l1-first-session` (AMB-13).

### TC-D-10: Progress survives a reload
- **ACs:** P-1.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-one-complete`.
- **Steps:**
  1. Open `/curriculum`, then `page.reload()`.
- **Expected:** The `l1-first-session` row shows the completed state both before and after reload; `readProgress(page)` deep-equals the seeded doc except `lastViewed` (unchanged because no lesson was opened).

### TC-D-11: Progress survives a browser restart in the same profile
- **ACs:** P-1.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; Playwright `chromium.launchPersistentContext(tmpUserDataDir)`.
- **Steps:**
  1. In the persistent context, open `/lessons/l2-context-files`, click Mark complete, check `CLAUDE.md written`.
  2. Close the context (full browser shutdown). Relaunch `launchPersistentContext` with the same `tmpUserDataDir`.
  3. Open `/lessons/l2-context-files`.
- **Expected:** The button reads `Completed ✓ · Undo` and the `CLAUDE.md written` checkbox is checked without any user action.

### TC-D-12: A different browser profile starts empty
- **ACs:** P-1.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Negative
- **Preconditions / fixtures:** After TC-D-11, a new non-persistent context.
- **Steps:**
  1. Open `/curriculum`.
- **Expected:** No lesson shows completed; `localStorage.getItem("fm-playground:v1")` is `null` until the first write (the app does not write on read-only page loads, see TC-D-13).

### TC-D-13: Read-only page loads do not write storage
- **ACs:** P-1.1, P-5.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`, `ls-empty`; init script wrapping `Storage.prototype.setItem` to count calls for key `fm-playground:v1`.
- **Steps:**
  1. Visit `/curriculum`, `/exercises`, `/bookmarks`, `/progress`, `/news`.
- **Expected:** Zero `setItem` calls. (Opening a lesson may write `lastViewed`; that route is excluded here.) Rationale: writing defaults on load would overwrite a doc another tab is mid-writing and would hide the "empty" state.

---

## Suite 3: Corrupted state (P-2)

### TC-D-14: Invalid JSON resets and shows the notice
- **ACs:** P-2.1, S9-10
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `fx-base`, `ls-corrupt-json` (`{"version":1,`), `collectConsole(page)` with `pageerror` listener.
- **Steps:**
  1. Open `/curriculum`.
  2. Read `readProgress(page)`.
- **Expected:** `getByRole('alert')` (or `status`) contains exactly "Saved progress was unreadable and has been reset". The page renders all fixture lesson rows as not started. Stored value is now a valid empty doc (TC-D-01 shape) or absent. Zero `pageerror` events and zero uncaught `console.error`.

### TC-D-15: Corruption variants all take the same path
- **ACs:** P-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `fx-base`; parametrize the raw stored string over: `ls-corrupt-schema` (`{"version":1,"lessons":"nope"}`), `null`, `42`, `[]`, `"just a string"` (JSON string), `{}`, `{"version":1,"lessons":{},"checklists":{},"bookmarks":{"lessons":[],"news":[]},"prefs":{"tool":"vim"},"lastViewed":null}`, `{"version":1,"lessons":{"l1-first-session":{"completedAt":"yesterday"}},...rest valid}`.
- **Steps:**
  1. For each value, `seedProgress` the raw string, open `/lessons/l1-first-session`.
- **Expected:** Every variant shows the verbatim notice, renders the lesson, and ends with a schema-valid stored doc. No variant throws; `pageerror` count is 0 across all runs. The invalid `prefs.tool` and non-ISO `completedAt` cases prove the schema checks field formats, not only top-level types.

### TC-D-16: Oversized garbage (5 MB) does not hang or crash
- **ACs:** P-2.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base`; seed a 5 MB string `"x".repeat(5*1024*1024)` (near Chromium's per-origin quota; if `setItem` throws during seeding, seed 4.5 MB).
- **Steps:**
  1. Open `/curriculum` and measure time to the first lesson row being visible.
- **Expected:** Notice appears; lesson rows visible within 3s; stored value replaced by a valid empty doc (so storage is freed). `pageerror` count 0.

### TC-D-17: The corruption notice is dismissible and does not reappear
- **ACs:** P-2.1, S9-10
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-corrupt-json`.
- **Steps:**
  1. Open `/curriculum`; press Tab until `getByRole('button', { name: 'Dismiss' })` is focused; press Enter.
  2. Navigate to `/lessons/l1-first-session` (client navigation) and then `page.reload()`.
- **Expected:** Step 1: notice removed from the accessibility tree; focus moves to a sensible target (the `main` landmark or the next focusable), not to `body` lost off-screen. Step 2: the notice is not shown again, because the stored doc is now valid.

### TC-D-18: Corruption notice appears once per reset, on any first page
- **ACs:** P-2.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`, `ls-corrupt-schema`; parametrize the entry route over all progress-bearing routes and `/news`.
- **Steps:**
  1. Open the route directly.
- **Expected:** The verbatim notice is visible on every entry route ("when any page loads"), including `/news`, which shows no progress UI of its own.

### TC-D-19: A valid write after reset does not trigger the notice
- **ACs:** P-2.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Negative
- **Preconditions / fixtures:** `fx-base`, `ls-corrupt-json`.
- **Steps:**
  1. Open `/lessons/l1-first-session`, dismiss the notice, click Mark complete, reload.
- **Expected:** No notice after reload; `completedAt` present. Guards against a stale "was corrupted" flag stored alongside the doc.

---

## Suite 4: Storage unavailable (P-3)

### TC-D-20: localStorage access throws: every page renders with the banner
- **ACs:** P-3.1, S9-10
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `fx-base`, `blockStorage(page)` (getter and `getItem`/`setItem` throw `SecurityError`), `collectConsole(page)`.
- **Steps:**
  1. Visit each progress-bearing route plus `/news` and `/news/archive`.
- **Expected:** Each page renders its main content (lesson rows, lesson heading, digest list). `getByRole('status')` contains exactly "Progress can't be saved in this browser" on every page. No `pageerror`; no `console.error`. The P-2 corruption notice is not shown (unavailable is not corrupted).

### TC-D-21: Progress controls work for the session when storage is blocked
- **ACs:** P-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `fx-base`, `blockStorage(page)`.
- **Steps:**
  1. Open `/lessons/l1-first-session`; click Mark complete.
  2. Check `Test is green`; select the `Codex CLI` tab; toggle the lesson bookmark.
  3. Client-navigate (click the nav link) to `/curriculum`, then to `/bookmarks`.
  4. `page.reload()`.
- **Expected:** Step 1: button becomes `Completed ✓ · Undo`. Step 3: `/curriculum` shows `l1-first-session` completed and L1 progress "1 / 2"; `/bookmarks` lists the lesson. Step 4: all of it is gone (in-memory only), and the banner is still shown. No errors at any step.

### TC-D-22: Quota exceeded only on write
- **ACs:** P-3.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `fx-base`, `ls-one-complete`; init script making `setItem` throw `DOMException('QuotaExceededError')` while `getItem` works.
- **Steps:**
  1. Open `/curriculum` (read succeeds).
  2. Open `/lessons/l2-context-files`; click Mark complete.
- **Expected:** Step 1: `l1-first-session` shows completed (read path works); banner absent or present per implementation, but the page renders. Step 2: the UI shows completed for the session and the banner "Progress can't be saved in this browser" is visible after the failed write. No uncaught error. The stored doc is unchanged (still the seeded one).

### TC-D-23: `window.localStorage` is undefined
- **ACs:** P-3.1
- **Level:** unit
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** jsdom with `delete window.localStorage` / `Object.defineProperty(window, 'localStorage', { value: undefined })`.
- **Steps:**
  1. Initialise the progress store and dispatch `markComplete`.
- **Expected:** Store reports `storageAvailable === false`, keeps state in memory, `getState().lessons["..."]` set, no throw.

### TC-D-24: Server environment never touches localStorage
- **ACs:** P-3.1, P-5.1
- **Level:** unit
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** Vitest `environment: 'node'` (no `window`).
- **Steps:**
  1. Import every module under `src/lib/progress/` and render the progress provider with `react-dom/server` `renderToString`.
- **Expected:** No `ReferenceError: window/localStorage is not defined`; output contains no progress values (see TC-D-30).

---

## Suite 5: Content drift and migration (P-4)

### TC-D-25: Orphan lesson slug is kept in storage and not rendered
- **ACs:** P-4.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`, `ls-orphans` (lessons includes `deleted-lesson-slug` with a valid `completedAt`), `collectConsole(page)`.
- **Steps:**
  1. Open `/curriculum`, `/bookmarks`, `/progress`.
  2. On `/lessons/l1-first-session`, click Mark complete (causing a write).
  3. `readProgress(page)`.
- **Expected:** No page shows the text `deleted-lesson-slug`. L1/L2 counts ignore it (L1 shows "1 / 2" after step 2, not "2 / 2"). After the write, `lessons["deleted-lesson-slug"]` is still present with its original `completedAt`. No console errors.

### TC-D-26: Archived lesson in storage behaves like an orphan
- **ACs:** P-4.1, C-1.3
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`; seed `lessons: { "l2-retired": { completedAt: "2026-09-01T00:00:00.000Z" } }` and `bookmarks.lessons` containing `l2-retired`.
- **Steps:**
  1. Open `/curriculum` and `/bookmarks`.
- **Expected:** L2 header shows "0 / 2" (archived lesson not counted). `/bookmarks` shows the archived bookmark as unavailable in the same way as N-5 ("no longer available") or omits it; it never links to a 404 without explanation. Record the chosen behavior in AMB-D2. Storage keeps both entries.

### TC-D-27: Orphan checklist item ID and orphan exercise slug
- **ACs:** P-4.1, E-2.2, S9-11
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`, `ls-orphans` (`checklists["ex-fx-auto"] = { c1: true, zzz: true }`) plus `checklists["ex-gone"] = { a: true }`.
- **Steps:**
  1. Open `/lessons/l1-first-session`; inspect the checklist.
  2. Check `No test files edited` and `Diff reviewed`.
- **Expected:** Step 1: count shows 1 of 3 (zzz not counted); no UI mention of `zzz` or `ex-gone`; no console output. Step 2: "Exercise complete" appears (3 of 3). Storage still holds `zzz: true` and `ex-gone` untouched.

### TC-D-28: v1 → v2 migration fixture is a no-op
- **ACs:** P-4.2
- **Level:** unit
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `tests/fixtures/progress/v1-full.json` (every field populated: 2 lessons, 2 checklists, 1 lesson + 1 news bookmark, `prefs.tool: "codex"`, `lastViewed` set) and the registered `migrations` map in `src/lib/progress/`.
- **Steps:**
  1. Run `migrate(v1Doc, { to: 2 })` using a test-only registered v1→v2 migration that is the identity on data.
  2. Run `migrate(v1Doc)` with the production registry (current version 1).
- **Expected:** Step 1: returns a doc with `version: 2` and all other fields deep-equal to the input. Step 2: returns the input unchanged (`version: 1`). The migration registry is an ordered list keyed by from-version, so a future v2→v3 can be appended without editing v1→v2.

### TC-D-29: Unknown versions (v0, v2 on a v1 app, missing, string)
- **ACs:** P-4.2, P-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** `fx-base`; parametrize over `ls-v0`, `ls-v2` (valid v1 shape but `version: 2`), a doc without `version`, a doc with `version: "1"`.
- **Steps:**
  1. Open `/curriculum` with each doc; read storage after load.
- **Expected (per AMB-05, pending decision):** No crash, no `pageerror`. `ls-v0`, missing and string versions follow the P-2 path (verbatim notice, reset). For `ls-v2`: the app must not silently overwrite a newer doc without the notice; the assumed behavior is notice + reset. If the decision is "keep newer doc read-only", this case's expected changes to: no notice, no write, progress controls behave as P-3 (session-only) with the banner.

---

## Suite 6: Hydration safety (P-5, S9-09)

### TC-D-30: Server HTML contains no progress state
- **ACs:** P-5.1, S9-09
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`. Use Playwright `request.get()` (no JS, no storage).
- **Steps:**
  1. GET each progress-bearing route; capture the HTML body.
- **Expected:** HTML contains none of: `Completed ✓`, `Exercise complete`, `aria-valuenow="50"` or any non-zero `aria-valuenow` on level progress bars, `checked` attribute on checklist inputs, "Continue: " followed by a lesson other than the C-4.2 default, and none of the literal strings "not started" / "Not started" (S9-09: neutral placeholders, no not-started flash). Progress placeholders are present (for example, a `data-testid="progress-placeholder"` element or `aria-busy="true"` on the progress region).

### TC-D-31: No hydration warnings with stored progress on any route
- **ACs:** P-5.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-one-complete` plus a checklist `ex-fx-auto.c1 = true`, a lesson bookmark and `prefs.tool: "codex"`; `collectConsole(page)` including the React 19 patterns `/hydrat/i`, `/did not match/i`, `/server rendered HTML didn't match the client/i`, `/Minified React error #(418|423|425)/`.
- **Steps:**
  1. Visit each progress-bearing route (plus `/lessons/l1-first-session?tool=claude`, which conflicts with `prefs.tool: "codex"`), wait for `networkidle`.
- **Expected:** Zero matching console messages and zero `pageerror`. After hydration the UI shows the stored state: completed row, checked `Test is green`, Codex tab active on `/lessons/l1-first-session` without `?tool`, Claude tab active with `?tool=claude`.

### TC-D-32: No "not started" flash between first paint and hydration
- **ACs:** P-5.1, S9-09
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`, `ls-one-complete`; `page.route` delaying the main client JS chunk by 1500 ms; MutationObserver init script recording every text value of the `l1-first-session` row's status element.
- **Steps:**
  1. Open `/curriculum`; wait until the row shows completed.
  2. Read the recorded sequence.
- **Expected:** The sequence is `placeholder → completed` only. It never contains a "not started" value before "completed". The placeholder occupies the same box (row height delta 0px, checked with `boundingBox()` before and after).

### TC-D-33: Store initialises after mount, not during render
- **ACs:** P-5.1
- **Level:** unit
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** React Testing Library; `hydrateRoot` a component tree over server HTML from `renderToString`, with localStorage seeded with `ls-one-complete`; spy on `console.error`.
- **Steps:**
  1. Hydrate; flush effects.
- **Expected:** `console.error` not called; after effects, the component shows completed. Implementation hint (not asserted): `useSyncExternalStore` with a server snapshot equal to "unhydrated", or a mounted flag.

---

## Suite 7: Cross-tab behavior

### TC-D-34: A change in one tab reaches another tab
- **ACs:** P-1.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`, `ls-empty`; two pages `A` and `B` in the same context.
- **Steps:**
  1. `B` opens `/curriculum`. `A` opens `/lessons/l1-first-session` and clicks Mark complete.
  2. Without reloading `B`, wait up to 2s.
- **Expected (AMB-D3):** Assumed: `B` updates the row to completed via the `storage` event. If the decision is "no live sync", the expected is: `B` shows the change after reload, and `B` must not overwrite `A`'s write on its next action (see TC-D-35).

### TC-D-35: Interleaved writes from two tabs never produce an invalid doc
- **ACs:** P-1.1, P-2.1
- **Level:** e2e
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `fx-base`, `ls-empty`; pages `A` and `B` both on `/lessons/l1-first-session` (loaded before any write).
- **Steps:**
  1. `A` clicks Mark complete. 
  2. `B` (stale in-memory state if no sync) checks `Test is green`.
  3. `A` toggles the lesson bookmark. Repeat steps 1–3 in a loop of 20 with `Promise.all` clicks.
  4. Reload a third page `C` on `/curriculum`.
- **Expected:** After every step the stored value parses and validates (checked by an interval reader in `C`). `C` shows no corruption notice. Minimum guarantee: last-writer-wins at whole-doc level is acceptable, but the tab that writes must re-read storage before writing (read-modify-write), so step 2 does not erase step 1's `completedAt`. Assert `lessons["l1-first-session"]` and `checklists["ex-fx-auto"].c1` both present at the end.

---

## Suite 8: Export and import (P-6)

### TC-D-36: Export downloads the file with the date in its name and copies JSON
- **ACs:** P-6.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-one-complete`; `context.grantPermissions(['clipboard-read','clipboard-write'])`; browser clock `page.clock.setFixedTime('2026-09-30T13:00:00+08:00')`.
- **Steps:**
  1. Open `/progress`; `const dl = page.waitForEvent('download')`; click `getByRole('button', { name: 'Export' })`.
  2. Read `dl.suggestedFilename()` and the downloaded file; read `navigator.clipboard.readText()`.
- **Expected:** Filename is exactly `fm-playground-progress-2026-09-30.json`. File content and clipboard text both `JSON.parse` to a doc deep-equal to `readProgress(page)`. A confirmation is announced via `getByRole('status')` (text not specified; see AMB-D4).

### TC-D-37: Export filename date near midnight
- **ACs:** P-6.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Boundary
- **Preconditions / fixtures:** As TC-D-36 but browser clock `2026-09-30T23:30:00Z` (= 2026-10-01 07:30 Manila) and context `timezoneId: 'America/Los_Angeles'` (= 2026-09-30 16:30 local).
- **Steps:**
  1. Export.
- **Expected (AMB-D5):** Assumed: the browser's local date, `fm-playground-progress-2026-09-30.json`. If the decision is Manila or UTC, the expected is `2026-10-01` or `2026-09-30` respectively. The case exists so the choice is explicit.

### TC-D-38: Export with storage blocked or clipboard denied
- **ACs:** P-6.1, P-3.1, S9-21
- **Level:** e2e
- **Priority:** P1
- **Category:** Error
- **Preconditions / fixtures:** Variant A: `blockStorage(page)` after marking one lesson complete in session. Variant B: `ls-one-complete`, clipboard permission not granted.
- **Steps:**
  1. Click Export.
- **Expected:** A: download still happens and contains the in-session state. B: download still happens; the page shows a non-error fallback (the JSON selected with "Press ⌘C to copy", matching S9-21); no uncaught error.

### TC-D-39: Import a valid file: preview, then replace only on confirm
- **ACs:** P-6.2
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, current state `ls-one-complete`. Import file `tests/fixtures/progress/import-valid.json`: 3 completed lessons (`l1-first-session`, `l1-permissions`, `l2-context-files`), 1 lesson bookmark, 2 news bookmarks (`n01`, `n02` ids), `prefs.tool: "codex"`.
- **Steps:**
  1. Open `/progress`; `getByLabel('Import progress file').setInputFiles(file)`.
  2. Read the preview; do nothing else; `readProgress(page)`.
  3. Click `getByRole('button', { name: 'Replace my progress' })` (name proposed).
- **Expected:** Step 2: preview text contains "3 lessons" and "3 bookmarks" (lessons + news; AMB-D6 if the preview should split them); storage still deep-equals `ls-one-complete`. Step 3: storage deep-equals the imported doc (full replace: nothing from `ls-one-complete` that was absent from the file remains); `/curriculum` shows L1 "2 / 2" without reload.

### TC-D-40: Cancelling import leaves state untouched
- **ACs:** P-6.2
- **Level:** e2e
- **Priority:** P1
- **Category:** Negative
- **Preconditions / fixtures:** As TC-D-39.
- **Steps:**
  1. Select the file; at the preview, click `getByRole('button', { name: 'Cancel' })`; also repeat with Escape if the preview is a dialog.
- **Expected:** Storage byte-identical to before (compare raw strings). Preview dismissed; focus returns to the file input or Import trigger.

### TC-D-41: Import rejects invalid files without touching state
- **ACs:** P-6.2
- **Level:** e2e
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** `fx-base`, `ls-one-complete`. Files: `import-bad-json.json` (`{"version":1,`), `import-bad-schema.json` (`{"version":1,"lessons":[]}`), `import-v99.json` (valid shape, `version: 99`), `import-empty.json` (0 bytes), `import-photo.png` (a PNG renamed and also a real `.png` with `image/png`), `import-10mb.json` (10 MB valid JSON array).
- **Steps:**
  1. Select each file in turn.
- **Expected:** Each shows an error in `getByRole('alert')` that names the problem class (invalid JSON / not a progress file / unsupported version / file too large; exact copy per AMB-D4). No preview and no confirm button appears. Storage stays byte-identical to `ls-one-complete`. No `pageerror`. The 10 MB file is rejected by size before full parse, or parsed and rejected within 3s without freezing the tab. Priority is P0 because a bad import would corrupt the P0 contract.

### TC-D-42: Import strips prototype-pollution payloads
- **ACs:** P-6.2, P-1.1
- **Level:** unit
- **Priority:** P0
- **Category:** Security
- **Preconditions / fixtures:** File text `{"version":1,"lessons":{"__proto__":{"polluted":true},"constructor":{"prototype":{"x":1}}},"checklists":{},"bookmarks":{"lessons":[],"news":[]},"prefs":{"tool":"claude","__proto__":{"isAdmin":true}},"lastViewed":null}`.
- **Steps:**
  1. Run the import parser/validator on the text; then evaluate `({}).polluted`, `({}).isAdmin`, `Object.prototype.x`.
  2. If it validates, persist and reload through the store.
- **Expected:** `({}).polluted === undefined`, `({}).isAdmin === undefined`. The resulting doc either fails validation (preferred: lesson entries must match the `{ completedAt }` schema) or contains no `__proto__`/`constructor` keys. Same test for the P-2 load path (a stored doc with these keys).

### TC-D-43: Import with unknown slugs and news ids
- **ACs:** P-6.2, P-4.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** Import file with 2 lessons (`l1-first-session`, `lesson-from-future`) and a news bookmark id not in DB.
- **Steps:**
  1. Import and confirm; open `/curriculum` and `/bookmarks`.
- **Expected:** Preview counts what the file contains ("2 lessons", AMB-D6). After confirm, storage keeps `lesson-from-future` (P-4.1); curriculum ignores it; `/bookmarks` shows the news entry as "Item no longer available".

---

## Suite 9: Reset (P-7)

### TC-D-44: Reset requires typing exactly `reset`
- **ACs:** P-7.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-one-complete`.
- **Steps:**
  1. Open `/progress`; click `getByRole('button', { name: 'Reset all progress' })`.
  2. Observe the confirm button (`getByRole('button', { name: 'Reset' })` inside `getByRole('dialog')` or the form).
  3. Type `reset` into `getByLabel(/Type reset to confirm/)`; click confirm.
- **Expected:** Step 2: confirm button is disabled (`toBeDisabled()`). Step 3: storage becomes the empty doc (TC-D-01) or the key is removed; `/curriculum` shows nothing completed without reload; focus returns to the Reset trigger or a status message "Progress reset" in `getByRole('status')`.

### TC-D-45: Near-miss confirmation text keeps the button disabled
- **ACs:** P-7.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Negative
- **Preconditions / fixtures:** As TC-D-44.
- **Steps:**
  1. Type each value in turn: `Reset`, `RESET`, `reset ` (trailing space), ` reset`, `rese`, `resett`, `rеset` (Cyrillic `е`, U+0435).
  2. For each, press Enter in the input as well as trying to click the button.
- **Expected (AMB-D7):** Assumed exact, case-sensitive, no trimming: confirm stays disabled and Enter does not submit for every value; storage unchanged. If the decision allows case-insensitive or trimmed input, only `Reset`/`RESET`/whitespace variants flip to enabled; `rese`, `resett` and the Cyrillic variant must stay disabled in every interpretation.

### TC-D-46: Cancelling reset leaves state
- **ACs:** P-7.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Negative
- **Preconditions / fixtures:** As TC-D-44.
- **Steps:**
  1. Open the reset confirm, type `reset`, then press Escape (or click Cancel).
- **Expected:** Storage byte-identical; the typed text is cleared if the dialog is reopened.

---

## Suite 10: Bookmarks page (L-8.1, N-5.1, S9-19, S9-20)

### TC-D-47: Empty bookmarks state
- **ACs:** S9-19, L-8.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`, `ls-empty`.
- **Steps:**
  1. Open `/bookmarks`.
- **Expected:** Text "Nothing bookmarked yet" visible, plus a hint that names where bookmarks come from (lesson header and news items; exact hint copy is WS-D's to choose and must be pinned in this case once written). No list elements rendered. No placeholder flash after hydration (S9-09).

### TC-D-48: Lessons and news bookmarks listed newest first
- **ACs:** L-8.1, N-5.1
- **Level:** e2e
- **Priority:** P1
- **Category:** Happy
- **Preconditions / fixtures:** `fx-base`; seed bookmarks (AMB-10 shape): lessons `l1-first-session` at `2026-09-29T01:00:00.000Z`, `l2-memory` at `2026-09-30T02:00:00.000Z`; news `n01` at `2026-09-30T01:00:00.000Z`, `n27` at `2026-09-28T01:00:00.000Z`.
- **Steps:**
  1. Open `/bookmarks`; read the list items in DOM order (within each section if the page groups lessons and news; AMB-D8).
- **Expected:** Grouped layout: lessons `l2-memory`, `l1-first-session`; news `n01`, `n27`. Single merged list: `l2-memory`, `n01`, `l1-first-session`, `n27`. Each lesson item links to `/lessons/<slug>`; each news item links to its source URL and shows its title from the DB.

### TC-D-49: Bookmarked news item removed from the DB
- **ACs:** N-5.1, S9-20
- **Level:** e2e
- **Priority:** P1
- **Category:** Error
- **Preconditions / fixtures:** `fx-base`; `ls-orphans` (`bookmarks.news` includes `00000000-0000-4000-8000-000000000000`, not in DB) plus a valid `n01` bookmark; `collectConsole(page)`.
- **Steps:**
  1. Open `/bookmarks`.
  2. Click the remove-bookmark control on the unavailable entry.
- **Expected:** Step 1: one entry reads exactly "Item no longer available"; the `n01` entry renders normally; no error boundary, no `console.error`, and the missing id does not trigger a 404/500 request loop. Step 2: the id is removed from `bookmarks.news` in storage.

### TC-D-50: Bookmarks page when the DB is down
- **ACs:** L-8.1, S9-01
- **Level:** e2e
- **Priority:** P1
- **Category:** Error
- **Preconditions / fixtures:** App started with `supabase-down`; `ls-one-complete` with bookmarks.
- **Steps:**
  1. Open `/bookmarks`.
- **Expected:** The app-wide DB-down page (S9-01, verbatim "Can't reach the local database. Run `supabase start` then `npm run seed`.") is shown, not "Item no longer available" for every entry. Stored bookmarks are untouched (DB outage must never be read as "items deleted").

---

## Coverage

| AC / state | Cases |
|---|---|
| P-1.1 | TC-D-01, 02, 05, 07, 08, 09, 10, 11, 12, 13, 34, 35, 42 |
| P-2.1 | TC-D-14, 15, 16, 17, 18, 19, 29, 35 |
| P-3.1 | TC-D-20, 21, 22, 23, 24, 38 |
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
| L-8.1 | TC-D-06, 47, 48, 50 |
| N-5.1 | TC-D-06, 48, 49 |
| S9-01 | TC-D-50 |
| S9-09 | TC-D-30, 32 |
| S9-10 | TC-D-14, 17, 20 |
| S9-11 | TC-D-27 |
| S9-19 | TC-D-47 |
| S9-20 | TC-D-49 |
| S9-21 | TC-D-38 |

## Ambiguities raised in this file

Global ambiguities cited here: AMB-05 (unknown versions), AMB-10 (bookmark timestamps), AMB-13 (`lastViewed`).

| ID | Ambiguity | Assumed in these cases |
|---|---|---|
| AMB-D1 | Marking an already-completed lesson again: keep the first `completedAt` or overwrite? | Keep first (TC-D-03). |
| AMB-D2 | How `/bookmarks` shows a bookmarked lesson that is archived or deleted. N-5 only covers news. | Same "no longer available" treatment as news (TC-D-26). |
| AMB-D3 | Cross-tab live sync via the `storage` event is not specified. | Live sync; minimum guarantee is read-modify-write so tabs do not erase each other (TC-D-34, 35). |
| AMB-D4 | Export confirmation copy and import error copy are unspecified. | Any text in `status` / `alert`; pin exact strings when implemented. |
| AMB-D5 | Time zone of `<YYYY-MM-DD>` in the export filename (browser local, Manila, UTC). | Browser local date (TC-D-37). |
| AMB-D6 | Import preview "N lessons, N bookmarks": are lesson and news bookmarks summed, and are unknown slugs counted? | Summed; counts reflect the file as-is (TC-D-39, 43). |
| AMB-D7 | Reset confirmation: case-sensitive, trimmed? | Exact, case-sensitive, no trimming (TC-D-45). |
| AMB-D8 | `/bookmarks` newest-first: one merged list or separate lessons/news sections? | Either; TC-D-48 gives the expected order for both. |
