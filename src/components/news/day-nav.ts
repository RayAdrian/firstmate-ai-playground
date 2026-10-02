// Pure helpers for /news day navigation (`?date=YYYY-MM-DD`). Bad input degrades to the latest digest.
import { z } from "zod";
import { isIsoDate } from "./dates";

const dateParam = z.string().refine(isIsoDate);

export type DateParam =
  | { kind: "none" }
  | { kind: "date"; date: string }
  | { kind: "invalid" }
  | { kind: "future"; date: string };

/** Parse `?date=`. `today` is the Manila yyyy-MM-dd of the server clock. */
export function parseDigestDateParam(raw: string | string[] | undefined, today: string): DateParam {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value === "") return { kind: "none" };
  const parsed = dateParam.safeParse(value);
  if (!parsed.success) return { kind: "invalid" };
  return parsed.data > today ? { kind: "future", date: parsed.data } : { kind: "date", date: parsed.data };
}

/** The nearest digest day before and after `current`. `dates` are the digest days, any order. */
export function neighborDates(
  dates: readonly string[],
  current: string,
): { prev: string | null; next: string | null } {
  let prev: string | null = null;
  let next: string | null = null;
  for (const d of dates) {
    if (d < current && (prev === null || d > prev)) prev = d;
    if (d > current && (next === null || d < next)) next = d;
  }
  return { prev, next };
}

export type ShowMode = "relevant" | "all";

/** `?show=all` selects the All view. Anything else, including an invalid value, is Relevant. */
export function parseShowParam(raw: string | string[] | undefined): ShowMode {
  return (Array.isArray(raw) ? raw[0] : raw) === "all" ? "all" : "relevant";
}

/** /news URL for a day and view. Defaults are omitted; with no day, the latest digest. */
export function digestDayHref(date: string | null, show: ShowMode = "relevant"): string {
  const q = new URLSearchParams();
  if (date) q.set("date", date);
  if (show === "all") q.set("show", "all");
  const s = q.toString();
  return s ? `/news?${s}` : "/news";
}
