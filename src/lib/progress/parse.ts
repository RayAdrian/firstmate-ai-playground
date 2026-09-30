import { progressStateSchema, type ProgressState } from "@/lib/contracts";
import { migrate, MigrationError } from "./migrate";

export type InvalidReason =
  | "empty-file"
  | "invalid-json"
  | "not-an-object"
  | "missing-version"
  | "unsupported-version"
  | "invalid-shape";

export type InvalidResult = { kind: "invalid"; reason: InvalidReason; version?: unknown };

export type ParseResult = { kind: "empty" } | { kind: "ok"; state: ProgressState } | InvalidResult;

/** Keys that could be used for prototype pollution; dropped while parsing. */
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function safeReviver(key: string, value: unknown): unknown {
  return FORBIDDEN_KEYS.has(key) ? undefined : value;
}

/**
 * Parse and validate progress JSON text (a stored value or an imported file).
 * `null` (nothing stored) is `empty`. Never throws.
 * An unreadable, unknown or unmigratable version is `invalid`.
 */
export function parseProgressText(text: string | null): ParseResult {
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
  const doc = raw as Record<string, unknown>;
  if (!("version" in doc)) return { kind: "invalid", reason: "missing-version" };
  let migrated: Record<string, unknown>;
  try {
    migrated = migrate(doc);
  } catch (err) {
    if (err instanceof MigrationError) {
      return { kind: "invalid", reason: "unsupported-version", version: doc.version };
    }
    return { kind: "invalid", reason: "invalid-shape" };
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
export function describeInvalid(result: InvalidResult): string {
  if (result.reason === "unsupported-version" && typeof result.version === "number") {
    return `unsupported version ${result.version}`;
  }
  return REASON_TEXT[result.reason];
}
