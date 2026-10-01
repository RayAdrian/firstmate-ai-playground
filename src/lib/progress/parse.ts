import { PLACEHOLDER_CLIENT_ID, PROGRESS_VERSION, createCommunity, progressStateSchema, type ProgressState } from "@/lib/contracts";
import { migrate, MigrationError } from "./migrate";

export type InvalidReason =
  | "empty-file"
  | "invalid-json"
  | "not-an-object"
  | "missing-version"
  | "unsupported-version"
  | "invalid-shape";

export type InvalidResult = { kind: "invalid"; reason: InvalidReason; version?: unknown };

/**
 * A doc written by a NEWER version of the app. It is never reset, rewritten or removed (R-H): the store reads the
 * fields it knows from `doc` and stays read-only. `doc` is the raw parsed object.
 */
export type NewerResult = { kind: "newer"; version: number; doc: Record<string, unknown> };

export type ParseResult = { kind: "empty" } | { kind: "ok"; state: ProgressState } | NewerResult | InvalidResult;

export type ParseOptions = {
  /**
   * Import mode (PRD P-6): drop any `community` key from the text and fill in a stand-in, so a hand-edited file can
   * never carry an identity in. The caller keeps the browser's own `community` (see `replaceProgress`).
   */
  ignoreCommunity?: boolean;
};

/** Keys that could be used for prototype pollution; dropped while parsing. */
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function safeReviver(key: string, value: unknown): unknown {
  return FORBIDDEN_KEYS.has(key) ? undefined : value;
}

/**
 * Parse and validate progress JSON text (a stored value or an imported file).
 * `null` (nothing stored) is `empty`. Never throws.
 * A version above the code's is `newer` (never treated as corrupt); an unreadable, older or unmigratable
 * version is `invalid`.
 */
export function parseProgressText(text: string | null, options: ParseOptions = {}): ParseResult {
  if (text === null) return { kind: "empty" };
  if (text.trim() === "") return { kind: "invalid", reason: "empty-file" };
  let raw: unknown;
  try {
    raw = JSON.parse(text, safeReviver);
  } catch {
    return { kind: "invalid", reason: "invalid-json" };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { kind: "invalid", reason: "not-an-object" };
  }
  let doc = raw as Record<string, unknown>;
  if (!("version" in doc)) return { kind: "invalid", reason: "missing-version" };
  if (typeof doc.version === "number" && Number.isInteger(doc.version) && doc.version > PROGRESS_VERSION) {
    return { kind: "newer", version: doc.version, doc };
  }
  if (options.ignoreCommunity) {
    const { community: ignored, ...rest } = doc;
    void ignored;
    doc = rest;
  }
  let migrated: Record<string, unknown>;
  try {
    migrated = migrate(doc);
  } catch (err) {
    if (err instanceof MigrationError) {
      return { kind: "invalid", reason: "unsupported-version", version: doc.version };
    }
    return { kind: "invalid", reason: "invalid-shape" };
  }
  if (options.ignoreCommunity) {
    migrated = { ...migrated, community: createCommunity(PLACEHOLDER_CLIENT_ID) };
  }
  const parsed = progressStateSchema.safeParse(migrated);
  if (!parsed.success) return { kind: "invalid", reason: "invalid-shape" };
  return { kind: "ok", state: parsed.data };
}

const REASON_TEXT: Record<InvalidReason, string> = {
  "empty-file": "the file is empty",
  "invalid-json": "invalid JSON",
  "not-an-object": "not a progress file",
  "missing-version": "missing `version`",
  "unsupported-version": "unsupported version",
  "invalid-shape": "not a progress file",
};

/** Short human reason for an import error. File content is never echoed. */
export function describeInvalid(result: InvalidResult | NewerResult): string {
  if (result.kind === "newer") return `unsupported version ${result.version}`;
  if (result.reason === "unsupported-version" && typeof result.version === "number") {
    return `unsupported version ${result.version}`;
  }
  return REASON_TEXT[result.reason];
}
