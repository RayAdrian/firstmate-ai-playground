// Pure Asia/Manila date helpers. Everything on the news pages is Manila time regardless of the
// browser or server zone, so server HTML and client render can never disagree (PRD N-1, P-5.1).
import { formatInTimeZone } from "date-fns-tz";

export const NEWS_TZ = "Asia/Manila";


/** A plain yyyy-MM-dd digest date as an instant (noon Manila, so the day never shifts). */
function digestInstant(date: string): Date {
  return new Date(`${date}T12:00:00+08:00`);
}

/** "Wed 30 Sep" for a yyyy-MM-dd digest date. */
export function formatDigestDay(date: string): string {
  return formatInTimeZone(digestInstant(date), NEWS_TZ, "EEE d MMM");
}

/** "08:03" (24h, Manila). */
export function formatTime(instant: Date | string): string {
  return formatInTimeZone(instant, NEWS_TZ, "HH:mm");
}

/** "Wed 30 Sep, 06:10" */
export function formatShortStamp(instant: Date | string): string {
  return formatInTimeZone(instant, NEWS_TZ, "EEE d MMM, HH:mm");
}

/** "Tue 29 Sep 2026, 06:10" */
export function formatFullStamp(instant: Date | string): string {
  return formatInTimeZone(instant, NEWS_TZ, "EEE d MMM yyyy, HH:mm");
}

/** True for a real calendar date written as yyyy-MM-dd. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
