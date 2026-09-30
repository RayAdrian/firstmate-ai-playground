// Public API of the progress layer (WS-D). See README.md in this folder.

// Client hooks (hydration-safe; each returns `hydrated`).
export {
  useBookmark,
  useBookmarks,
  useChecklist,
  useLastViewed,
  useLessonCompletion,
  useLessonsProgress,
  useProgressState,
  useProgressStatus,
  useToolPref,
  useTrackLastViewed,
} from "./hooks";

// The two global banners (P-2, P-3).
export { ProgressNotices } from "./notices";

// Live-region helper.
export { announce } from "./announce";

// Pure reducers, selectors and parsing (usable on the server too).
export {
  addBookmark,
  emptyState,
  isBookmarked,
  markComplete,
  removeBookmark,
  setLastViewed,
  setToolPref,
  toggleBookmark,
  toggleChecklistItem,
  undoComplete,
  type BookmarkKind,
} from "./reducers";
export {
  checklistFor,
  countCompleted,
  countFileContents,
  isLessonComplete,
  sortedBookmarks,
  summarize,
  type BookmarkEntry,
  type ProgressCounts,
} from "./selectors";
export { describeInvalid, parseProgressText, type InvalidReason, type ParseResult } from "./parse";
export { MIGRATIONS, MigrationError, migrate, type Migration } from "./migrate";
export {
  MAX_IMPORT_BYTES,
  exportFilename,
  parseImportText,
  pluralize,
  readImportFile,
  serializeProgress,
  type ImportResult,
} from "./io";

// Store (advanced use: imperative access, import/reset).
export {
  dismissCorruptNotice,
  getState,
  replaceProgress,
  resetProgress,
  updateProgress,
  type ProgressSnapshot,
} from "./store";
