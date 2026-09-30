// Pure helpers shared by the curriculum, lesson and exercise UI (safe on server and client).

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A lesson is "May be outdated" once it was last verified more than this many days ago (C-5.2). */
export const OUTDATED_AFTER_DAYS = 60;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function dateToUtcMs(iso: string): number | null {
  const m = ISO_DATE.exec(iso);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** "2026-09-20" -> "20 Sep 2026". Returns null for anything that is not a YYYY-MM-DD date. */
export function formatVerifiedDate(iso: string): string | null {
  const m = ISO_DATE.exec(iso);
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return null;
  return `${Number(m[3])} ${month} ${m[1]}`;
}

/** Whole calendar days from `from` to `to` (both YYYY-MM-DD). null if either is invalid. */
export function daysBetween(from: string, to: string): number | null {
  const a = dateToUtcMs(from);
  const b = dateToUtcMs(to);
  if (a === null || b === null) return null;
  return Math.round((b - a) / 86_400_000);
}

/** C-5.2: strictly more than 60 days old (exactly 60 is not outdated). */
export function isOutdated(lastVerifiedOn: string | null, today: string): boolean {
  if (!lastVerifiedOn) return false;
  const days = daysBetween(lastVerifiedOn, today);
  return days !== null && days > OUTDATED_AFTER_DAYS;
}

export type ToolVersions = { claude_code?: string; codex_cli?: string };

/** "Verified 20 Sep 2026 · Claude Code v2.1.0 / Codex v0.40.0" (parts are dropped when unknown). */
export function verifiedLine(lastVerifiedOn: string | null, versions: ToolVersions): string | null {
  const date = lastVerifiedOn ? formatVerifiedDate(lastVerifiedOn) : null;
  const tools = [
    versions.claude_code ? `Claude Code v${versions.claude_code}` : null,
    versions.codex_cli ? `Codex v${versions.codex_cli}` : null,
  ].filter((s): s is string => s !== null);
  const parts = [date ? `Verified ${date}` : null, tools.length > 0 ? tools.join(" / ") : null].filter(
    (s): s is string => s !== null,
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Whole-number percentage, rounded half up. 0 when the total is 0 (never NaN). */
export function percent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.floor((done / total) * 100 + 0.5)));
}
