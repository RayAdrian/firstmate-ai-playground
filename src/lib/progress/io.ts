import type { ProgressState } from "@/lib/contracts";
import { describeInvalid, parseProgressText } from "./parse";
import { countFileContents } from "./selectors";

/** Import files larger than this are rejected before reading (a real export is a few KB). */
export const MAX_IMPORT_BYTES = 1_000_000;

/** The export text. `community` (clientId, display name) is never exported: a clientId is a bearer credential (P-6). */
export function serializeProgress(state: ProgressState): string {
  const { community: omitted, ...exported } = state;
  void omitted;
  return JSON.stringify(exported, null, 2);
}

/** `fm-playground-progress-YYYY-MM-DD.json`, dated in the browser's local time zone. */
export function exportFilename(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `fm-playground-progress-${day}.json`;
}

/**
 * `state.community` of an ok result is a stand-in, never the file's: `replaceProgress` keeps this browser's own
 * `community`, so an import cannot change the local clientId or display name (P-6).
 */
export type ImportResult =
  | { ok: true; state: ProgressState; lessons: number; bookmarks: number }
  | { ok: false; reason: string };

/** Validate the text of an import file. Nothing is written; the caller confirms first. */
export function parseImportText(text: string): ImportResult {
  const parsed = parseProgressText(text, { ignoreCommunity: true });
  if (parsed.kind === "ok") {
    return { ok: true, state: parsed.state, ...countFileContents(parsed.state) };
  }
  if (parsed.kind === "empty") return { ok: false, reason: "the file is empty" };
  return { ok: false, reason: describeInvalid(parsed) };
}

/** Size-check then read and validate a File. Never throws. */
export async function readImportFile(file: File): Promise<ImportResult> {
  if (file.size > MAX_IMPORT_BYTES) {
    return { ok: false, reason: "the file is too large (max 1 MB)" };
  }
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, reason: "the file could not be read" };
  }
  return parseImportText(text);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
