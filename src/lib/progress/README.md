# Progress layer (`@/lib/progress`)

Owns the `fm-playground:v1` localStorage document (shape: `src/lib/contracts/progress.ts`, frozen).
Import everything from `@/lib/progress`.

## Hydration rule

The server and the first client render always see the empty document with `hydrated: false`.
Every hook returns `hydrated`. Until it is `true`, render a neutral placeholder (skeleton,
`data-testid="progress-placeholder"`), never "not started", "0 / n" or an unchecked box.
`hydrated` becomes true on the first client mount, after storage has been read.

## Hooks (client components)

| Hook | Returns |
|---|---|
| `useLessonCompletion(slug)` | `{ hydrated, completed, completedAt, markComplete(), undo() }` |
| `useLessonsProgress(slugs)` | `{ hydrated, completedCount, total, isComplete(slug) }` for a level/list. Slugs stored but not in `slugs` are ignored (P-4) |
| `useChecklist(exerciseSlug, itemIds)` | `{ hydrated, checked, doneCount, total, allDone, setChecked(itemId, bool) }`. Orphan item ids are ignored and kept |
| `useBookmark("lessons" \| "news", id)` | `{ hydrated, bookmarked, bookmarkedAt, toggle(), add(), remove() }`. Lesson id = slug, news id = `news_items.id` |
| `useBookmarks()` | `{ hydrated, lessons, news, restore(kind,id,at), remove(kind,id) }`, newest first |
| `useToolPref()` | `{ hydrated, tool, setTool("claude" \| "codex") }`. `tool` is `"claude"` until hydrated. An explicit `?tool=` URL param wins (WS-C decides) |
| `useTrackLastViewed(slug)` | Effect hook for the lesson page; writes `lastViewed` once hydrated, only when the slug changed |
| `useLastViewed()` | `{ hydrated, lastViewed, setLastViewed(slug) }` (Continue CTA) |
| `useProgressStatus()` | `{ hydrated, storageAvailable, corruptNotice, dismissCorruptNotice }` |
| `useProgressState()` | the whole document (prefer the focused hooks) |

## Notices (app shell)

Mount `<ProgressNotices />` once in the shell's GlobalNotices slot (under the header, above `<main>`).
It renders the P-3 storage banner and the dismissible P-2 corruption notice, client-only.
`<ProgressNotices fallback />` (no page uses it since M2: the shell mounts the global one) renders only when the global
instance is absent, so both can coexist without duplicates.

`announce(text)` writes to the `#fm-live` polite region (creates a hidden one if the shell has none).

## Behaviour guarantees

- Storage is read on first mount, never on the server. Read-only page loads never write the progress key (a transient probe key checks that writes work). `useTrackLastViewed` is the exception: it writes `lastViewed` once per lesson-page mount or slug change and never reacts to other tabs.
- Every mutation re-reads storage first (read-modify-write), so two tabs do not erase each other.
  Other tabs are followed through the `storage` event.
- Invalid JSON, schema failures and older/missing versions are replaced by an empty document and
  raise the corruption notice (P-2). The rest of the app never sees the bad data.
- A document with a version NEWER than the code's is never reset, rewritten or removed (R-H). The store reads the fields it
  knows (any field failing its schema is empty in memory), exposes `readOnly: true`, shows the "newer version" Notice, and
  lets toggles work in memory only, including for `storage` events. Only `invalid` docs are reset.
- `community` (`clientId`, `displayName`, `namePrompted`, PRD 18.3) is this browser's anonymous reaction identity. It is
  never exported (`serializeProgress` omits it), never imported (`replaceProgress` keeps the local one) and survives
  reset. A corrupt-doc reset makes a new `clientId`. Never show or log the `clientId`.
- If localStorage is missing, throws, or rejects a write, state lives in memory for the session and
  `storageAvailable` is false (P-3).
- Slugs and ids that no longer exist stay in storage and are never rendered (P-4).
- Parsing drops `__proto__`, `constructor` and `prototype` keys.

## Migrations

`migrate.ts` holds an ordered registry keyed by `from` version (`MIGRATIONS`: v1 -> v2 adds `community`).
To ship v3: bump `PROGRESS_VERSION` in the contract and append `{ from: 2, to: 3, up }`. Older
documents are migrated on load and import; anything without a path is treated as corrupt.

## Pure API (also fine on the server)

Reducers (`markComplete`, `undoComplete`, `toggleChecklistItem`, `toggleBookmark`, `setToolPref`,
`setLastViewed`, ...), selectors (`countCompleted`, `checklistFor`, `sortedBookmarks`, `summarize`),
`parseProgressText`, `migrate`, and export/import helpers (`serializeProgress`, `exportFilename`,
`parseImportText`).
