// Time helpers. Asia/Manila is UTC+8 with no DST, so a fixed offset is exact.
import type { Env } from "./env";
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** "Now", overridable with FM_NOW for tests (an ISO timestamp with offset). */
export function now(env: Env = process.env): Date {
  if (env.FM_NOW) {
    const d = new Date(env.FM_NOW);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function manilaShifted(input: Date | string): Date {
  const d = typeof input === "string" ? new Date(input) : input;
  return new Date(d.getTime() + MANILA_OFFSET_MS);
}

/** Asia/Manila calendar date (yyyy-mm-dd) of an instant. */
export function digestDate(input: Date | string): string {
  return manilaShifted(input).toISOString().slice(0, 10);
}

/** Hour of day (0-23) in Asia/Manila. */
export function manilaHour(input: Date | string): number {
  return manilaShifted(input).getUTCHours();
}

/** ISO timestamp with a +08:00 offset, e.g. 2026-09-30T08:00:00+08:00. */
export function manilaTimestamp(input: Date | string): string {
  return manilaShifted(input).toISOString().replace(/\.\d{3}Z$/, "+08:00");
}

/** PRD I-2.3: strictly older than 7x24h before `firstSeen`. */
export function isOlderThanBackfillWindow(publishedAt: string, firstSeen: Date): boolean {
  const published = new Date(publishedAt).getTime();
  if (Number.isNaN(published)) return false;
  return firstSeen.getTime() - published > 7 * DAY_MS;
}
