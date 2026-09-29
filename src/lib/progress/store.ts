import { PROGRESS_STORAGE_KEY, createEmptyProgress, type ProgressState } from "@/lib/contracts";
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
 */

export type ProgressSnapshot = {
  /** False on the server and until the first client mount has read storage. */
  readonly hydrated: boolean;
  readonly state: ProgressState;
  /** False when localStorage is missing, throws, or a write failed (P-3). */
  readonly storageAvailable: boolean;
  /** Stored progress was unreadable and was reset; shown until dismissed (P-2). */
  readonly corruptNotice: boolean;
};

const UNHYDRATED: ProgressSnapshot = Object.freeze({
  hydrated: false,
  state: createEmptyProgress(),
  storageAvailable: true,
  corruptNotice: false,
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

type Loaded = { state: ProgressState; readable: boolean; recovered: boolean; raw: string | null };

/** Read + validate storage. Corrupt content is replaced by an empty document (P-2). Never throws. */
function loadFromStorage(): Loaded {
  const storage = getStorage();
  if (!storage) return { state: snapshot.state, readable: false, recovered: false, raw: null };
  let raw: string | null;
  try {
    raw = storage.getItem(PROGRESS_STORAGE_KEY);
  } catch {
    return { state: snapshot.state, readable: false, recovered: false, raw: null };
  }
  const parsed = parseProgressText(raw);
  if (parsed.kind === "ok") return { state: parsed.state, readable: true, recovered: false, raw };
  if (parsed.kind === "empty") {
    return { state: createEmptyProgress(), readable: true, recovered: false, raw: null };
  }
  // Corrupt: free the space and write a valid empty document.
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
  return { state: empty, readable: true, recovered: true, raw: wrote ? emptyRaw : null };
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
  };
}

function ensureInitialized(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  applyLoaded(loadFromStorage());
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
 * Apply a pure reducer: re-read storage (so other tabs' writes are kept), reduce, persist.
 * When storage is unusable the change lives in memory for this session only.
 */
export function updateProgress(reducer: (state: ProgressState) => ProgressState): void {
  if (typeof window === "undefined") return;
  ensureInitialized();
  let base = snapshot.state;
  if (readable && writeOk) {
    const loaded = loadFromStorage();
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
    if (base !== snapshot.state || !snapshot.hydrated) {
      snapshot = { ...snapshot, hydrated: true, state: base };
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
    snapshot.hydrated
  ) {
    return;
  }
  snapshot = { ...snapshot, hydrated: true, state: next, storageAvailable };
  emit();
}

/** Replace the whole document (import). The caller has already validated it. */
export function replaceProgress(next: ProgressState): void {
  updateProgress(() => next);
}

/** Reset to an empty document (P-7; the confirmation lives in the UI). */
export function resetProgress(): void {
  updateProgress(() => createEmptyProgress());
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
