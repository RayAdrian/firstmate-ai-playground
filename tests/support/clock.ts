import type { BrowserContext, Page } from "@playwright/test";

/** Default fixed "now": Wed 30 Sep 2026, 08:03 in Asia/Manila. */
export const DEFAULT_NOW = "2026-09-30T08:03:00+08:00";

/**
 * Fix the browser clock's "now" (timers keep running). Client-side only: server rendering
 * is not affected, see `setServerNow`. Call before `page.goto`.
 */
export async function freezeClock(page: Page, iso: string = DEFAULT_NOW): Promise<void> {
  await page.clock.setFixedTime(new Date(iso));
}

/**
 * Override the server's "now" via the `fm_test_now` cookie (test-cases README section 4.1).
 * Only works if the app runs with FM_TEST_MODE=1 and implements that hook; ignored otherwise.
 */
export async function setServerNow(
  context: BrowserContext,
  baseURL: string,
  iso: string = DEFAULT_NOW,
): Promise<void> {
  await context.addCookies([{ name: "fm_test_now", value: iso, url: baseURL }]);
}
