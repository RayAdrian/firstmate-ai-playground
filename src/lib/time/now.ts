import "server-only";
import { cookies } from "next/headers";
import { formatInTimeZone } from "date-fns-tz";

export const TEST_NOW_COOKIE = "fm_test_now";
const MANILA = "Asia/Manila";

/**
 * Server "now". Use this instead of `new Date()` in server code that depends on today.
 * Under FM_TEST_MODE=1 (E2E only) the `fm_test_now` cookie (ISO string) overrides it; an
 * absent or invalid cookie falls back to the real time. Without the flag the cookie is ignored.
 */
export async function getNow(): Promise<Date> {
  if (process.env.FM_TEST_MODE !== "1") return new Date();
  const raw = (await cookies()).get(TEST_NOW_COOKIE)?.value;
  const parsed = raw ? new Date(raw) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
}

/** YYYY-MM-DD of `d` in Asia/Manila (the digest date). */
export function manilaDate(d: Date): string {
  return formatInTimeZone(d, MANILA, "yyyy-MM-dd");
}
