import {
  PLACEHOLDER_CLIENT_ID,
  PROGRESS_STORAGE_KEY,
  PROGRESS_VERSION,
  createEmptyProgress,
  progressStateSchema,
  type ProgressState,
} from "@/lib/contracts";
import { parseProgressText } from "./parse";

/**
 * Framework-free external store for the progress document, consumed with
 * useSyncExternalStore (see hooks.ts). Nothing here touches `window` until the first
 * subscriber mounts (post-hydration), so it is safe to import on the server.
 *
 * - Server / first client render: the constant UNHYDRATED snapshot (empty state, hydrated=false).
 * - Every mutation re-reads storage first (read-modify-write) so two tabs never erase each other.
 * - Storage that is missing, throws, or rejects a write degrades to in-memory state for the session.
 * - Other tabs are followed through the `storage` event.
 * - A doc written by a NEWER version of the app is never reset, rewritten or removed (R-H, PRD 18.3): the store
 *   goes read-only. It shows the fields it understands and lets toggles work in memory for the session.
 */

export type ProgressSnapshot = {
  /** False on the server and until the first client mount has read storage. */
  readonly hydrated: boolean;
  readonly state: ProgressState;
  /** False when localStorage is missing, throws, or a write failed (P-3). */
  readonly storageAvailable: boolean;
  /** Stored progress was unreadable and was reset; shown until dismissed (P-2). */
  readonly corruptNotice: boolean;
  /** Stored progress is from a newer version of the app: shown read-only, never written (R-H). */
  readonly readOnly: boolean;
};

const UNHYDRATED: ProgressSnapshot = Object.freeze({
  hydrated: false,
  // A fixed stand-in id, so nothing random is created at module load (server and client agree).
  state: createEmptyProgress(PLACEHOLDER_CLIENT_ID),
  storageAvailable: true,
  corruptNotice: false,
  readOnly: false,
});

let snapshot: ProgressSnapshot = UNHYDRATED;
let initialized = false;
/** localStorage.getItem worked at least once, so a fresh read is meaningful. */
let readable = false;
/** The last write succeeded (or none has been attempted). */
let writeOk = true;
let lastRaw: string | null = null;
let noticeDismissed = false;
let storageListening = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of [...listeners]) listener();
}

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const storage = window.localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

type Loaded = {
  state: ProgressState;
  readable: boolean;
  recovered: boolean;
  /** The stored doc is from a newer version: nothing was written, `state` is a best-effort read. */
  newer: boolean;
  raw: string | null;
};

/** The id this tab already holds, so an empty or unreadable store does not mint a second one. */
function sessionClientId(): string | undefined {
  const id = snapshot.state.community.clientId;
  return snapshot.hydrated && id !== PLACEHOLDER_CLIENT_ID ? id : undefined;
}

/**
 * Best-effort read of a newer doc: every field this version knows is used when it passes its own schema,
 * and treated as empty in memory when it does not. Nothing is written back.
 */
function readKnownFields(doc: Record<string, unknown>): ProgressState {
  const base = createEmptyProgress(sessionClientId());
  const shape = progressStateSchema.shape;
  const lessons = shape.lessons.safeParse(doc.lessons);
  const checklists = shape.checklists.safeParse(doc.checklists);
  const bookmarks = shape.bookmarks.safeParse(doc.bookmarks);
  const prefs = shape.prefs.safeParse(doc.prefs);
  const lastViewed = shape.lastViewed.safeParse(doc.lastViewed);
  const community = shape.community.safeParse(doc.community);
  return {
    version: PROGRESS_VERSION,
    lessons: lessons.success ? lessons.data : base.lessons,
    checklists: checklists.success ? checklists.data : base.checklists,
    bookmarks: bookmarks.success ? bookmarks.data : base.bookmarks,
    prefs: prefs.success ? prefs.data : base.prefs,
    lastViewed: lastViewed.success ? lastViewed.data : base.lastViewed,
    community: community.success ? community.data : base.community,
  };
}

/** Read + validate storage. Corrupt content is replaced by an empty document (P-2). Never throws. */
function loadFromStorage(): Loaded {
  const storage = getStorage();
  const unreadable: Loaded = { state: snapshot.state, readable: false, recovered: false, newer: false, raw: null };
  if (!storage) return unreadable;
  let raw: string | null;
  try {
    raw = storage.getItem(PROGRESS_STORAGE_KEY);
  } catch {
    return unreadable;
  }
  const parsed = parseProgressText(raw);
  if (parsed.kind === "ok") {
    return { state: parsed.state, readable: true, recovered: false, newer: false, raw };
  }
  if (parsed.kind === "newer") {
    return { state: readKnownFields(parsed.doc), readable: true, recovered: false, newer: true, raw };
  }
  if (parsed.kind === "empty") {
    return {
      state: createEmptyProgress(sessionClientId()),
      readable: true,
      recovered: false,
      newer: false,
      raw: null,
    };
  }
  // Corrupt: free the space and write a valid empty document (with a new clientId, P-2).
  const empty = createEmptyProgress();
  const emptyRaw = JSON.stringify(empty);
  let wrote = true;
  try {
    storage.removeItem(PROGRESS_STORAGE_KEY);
    storage.setItem(PROGRESS_STORAGE_KEY, emptyRaw);
  } catch {
    wrote = false;
  }
  writeOk = wrote;
  return { state: empty, readable: true, recovered: true, newer: false, raw: wrote ? emptyRaw : null };
}

function applyLoaded(loaded: Loaded): void {
  readable = loaded.readable;
  lastRaw = loaded.raw;
  if (loaded.recovered) noticeDismissed = false;
  const corruptNotice = loaded.recovered ? true : snapshot.corruptNotice && !noticeDismissed;
  snapshot = {
    hydrated: true,
    state: loaded.state,
    storageAvailable: loaded.readable && writeOk,
    corruptNotice,
    readOnly: loaded.newer,
  };
}

const PROBE_KEY = "fm-playground:probe";

/** True when a write is accepted (catches quota-full and write-blocked storage on load). */
function probeWrite(): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(PROBE_KEY, "1");
    storage.removeItem(PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}

function ensureInitialized(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  const loaded = loadFromStorage();
  if (loaded.readable && writeOk) writeOk = probeWrite();
  applyLoaded(loaded);
}

function onStorageEvent(event: StorageEvent): void {
  if (event.key !== null && event.key !== PROGRESS_STORAGE_KEY) return;
  if (!readable) return;
  const loaded = loadFromStorage();
  if (loaded.raw === lastRaw && !loaded.recovered) return;
  applyLoaded(loaded);
  emit();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!storageListening && typeof window !== "undefined") {
    storageListening = true;
    window.addEventListener("storage", onStorageEvent);
  }
  if (!initialized) {
    ensureInitialized();
    emit();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && storageListening) {
      storageListening = false;
      window.removeEventListener("storage", onStorageEvent);
    }
  };
}

export function getSnapshot(): ProgressSnapshot {
  return snapshot;
}

export function getServerSnapshot(): ProgressSnapshot {
  return UNHYDRATED;
}

/**
 * Read-only mode (a newer doc is stored): apply the reducer in memory only. Storage is read to see whether the
 * doc is still newer, and is never written, so it stays byte-identical. Returns false when the doc is no longer
 * newer (another tab replaced it), in which case the caller continues as normal.
 */
function updateInMemory(reducer: (state: ProgressState) => ProgressState): boolean {
  const loaded = loadFromStorage();
  if (!loaded.newer) {
    applyLoaded(loaded);
    return false;
  }
  const next = reducer(snapshot.state);
  if (next !== snapshot.state) {
    snapshot = { ...snapshot, state: next };
    emit();
  }
  return true;
}

/**
 * Apply a pure reducer: re-read storage (so other tabs' writes are kept), reduce, persist.
 * When storage is unusable the change lives in memory for this session only. When storage holds a newer
 * version's doc, the change lives in memory only and storage is never touched.
 */
export function updateProgress(reducer: (state: ProgressState) => ProgressState): void {
  if (typeof window === "undefined") return;
  ensureInitialized();
  if (snapshot.readOnly && updateInMemory(reducer)) return;
  let base = snapshot.state;
  if (readable && writeOk) {
    const loaded = loadFromStorage();
    if (loaded.newer) {
      // Another tab just stored a newer doc: switch to read-only and apply this change in memory.
      applyLoaded(loaded);
      updateInMemory(reducer);
      emit();
      return;
    }
    if (loaded.readable) {
      base = loaded.state;
      readable = true;
      if (loaded.recovered) {
        noticeDismissed = false;
        snapshot = { ...snapshot, corruptNotice: true };
      }
    } else {
      readable = false;
    }
  }
  const next = reducer(base);
  if (next === base && readable && writeOk) {
    // Nothing to persist; still adopt a fresher document read from another tab.
    if (base !== snapshot.state || !snapshot.hydrated || snapshot.readOnly) {
      snapshot = { ...snapshot, hydrated: true, state: base, readOnly: false };
      emit();
    }
    return;
  }
  const raw = JSON.stringify(next);
  let wrote = false;
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(PROGRESS_STORAGE_KEY, raw);
      wrote = true;
    } catch {
      wrote = false;
    }
  }
  writeOk = wrote;
  if (wrote) lastRaw = raw;
  const storageAvailable = readable && wrote;
  if (
    next === snapshot.state &&
    storageAvailable === snapshot.storageAvailable &&
    snapshot.hydrated &&
    !snapshot.readOnly
  ) {
    return;
  }
  snapshot = { ...snapshot, hydrated: true, state: next, storageAvailable, readOnly: false };
  emit();
}

/**
 * Replace the progress (import). The caller has already validated it. This browser's own `community` is kept:
 * an import never changes the clientId or the display name (P-6).
 */
export function replaceProgress(next: ProgressState): void {
  updateProgress((current) => ({ ...next, community: current.community }));
}

/** Reset progress to empty (P-7; the confirmation lives in the UI). Keeps `community`. */
export function resetProgress(): void {
  updateProgress((current) => ({ ...createEmptyProgress(), community: current.community }));
}

export function dismissCorruptNotice(): void {
  noticeDismissed = true;
  if (!snapshot.corruptNotice) return;
  snapshot = { ...snapshot, corruptNotice: false };
  emit();
}

/** Current in-memory document (for export). Falls back to empty before hydration. */
export function getState(): ProgressState {
  return snapshot.state;
}

/** Test-only: return the module to its pre-hydration state. */
export function __resetProgressStoreForTests(): void {
  if (storageListening && typeof window !== "undefined") {
    window.removeEventListener("storage", onStorageEvent);
  }
  storageListening = false;
  listeners.clear();
  snapshot = UNHYDRATED;
  initialized = false;
  readable = false;
  writeOk = true;
  lastRaw = null;
  noticeDismissed = false;
}
