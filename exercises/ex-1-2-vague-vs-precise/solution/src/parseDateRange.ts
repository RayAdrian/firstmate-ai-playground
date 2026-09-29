export interface DateRange {
  /** Inclusive, YYYY-MM-DD. */
  start: string;
  /** Inclusive, YYYY-MM-DD. */
  end: string;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/** Day number since 1970-01-01, or throws RangeError if the date does not exist. */
function toDayNumber(iso: string): number {
  const m = ISO_DATE.exec(iso);
  if (!m) throw new RangeError(`invalid date: ${iso}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d);
  // Date.UTC rolls 2026-02-30 over to March, so round-trip to detect impossible dates.
  if (fromDayNumber(ms / MS_PER_DAY) !== iso) throw new RangeError(`invalid date: ${iso}`);
  return ms / MS_PER_DAY;
}

function fromDayNumber(n: number): string {
  return new Date(n * MS_PER_DAY).toISOString().slice(0, 10);
}

function lastDayOfMonth(year: number, month: number): string {
  // Day 0 of the next month is the last day of this one.
  return fromDayNumber(Date.UTC(year, month, 0) / MS_PER_DAY);
}

function ordered(start: string, end: string): DateRange {
  if (toDayNumber(start) > toDayNumber(end)) throw new RangeError("start is after end");
  return { start, end };
}

/**
 * Parse a human date range into inclusive ISO dates. See SPEC.md.
 * `today` is passed in so the function never reads the clock or the time zone.
 */
export function parseDateRange(input: string, today: string): DateRange {
  const todayN = toDayNumber(today);
  const text = input.trim().replace(/\s+/g, " ").toLowerCase();

  const last = /^last (\d+) days?$/.exec(text);
  if (last) {
    const n = Number(last[1]);
    if (n < 1) throw new RangeError("invalid day count: must be at least 1");
    return { start: fromDayNumber(todayN - (n - 1)), end: today };
  }

  if (text === "this month") {
    const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
    return { start: `${today.slice(0, 7)}-01`, end: lastDayOfMonth(y, m) };
  }

  const pair = /^(\S+) to (\S+)$/.exec(text);
  if (pair) return ordered(pair[1], pair[2]);

  if (ISO_DATE.test(text)) {
    toDayNumber(text);
    return { start: text, end: text };
  }

  throw new RangeError(`unrecognized range: ${input}`);
}
