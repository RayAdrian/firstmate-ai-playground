import type { BrowserContext, Page } from "@playwright/test";
import { progressDoc, readProgress as readRaw, seedProgress } from "../../support";

// WS-C e2e helpers. Shared helpers live in tests/support; only C-specific ones are here.
// Runs against fx-base (`npm run db:reset:test`) with the test clock 2026-09-30 Manila.

export { seedProgress };
export const NOW = "2026-09-30T13:00:00+08:00";

export const doc = progressDoc;
export type Doc = ReturnType<typeof progressDoc>;

export const oneComplete = progressDoc({
  lessons: { "l1-first-session": { completedAt: "2026-09-29T01:00:00.000Z" } },
});
export const codexPref = progressDoc({ prefs: { tool: "codex" } });
export const orphans = progressDoc({
  lessons: {
    "l1-first-session": { completedAt: "2026-09-29T01:00:00.000Z" },
    "deleted-lesson-slug": { completedAt: "2026-09-01T00:00:00.000Z" },
  },
  checklists: { "ex-fx-auto": { c1: true, zzz: true } },
});

export async function readProgress(page: Page): Promise<Doc | null> {
  return (await readRaw(page)) as Doc | null;
}

/** fm_test_fail / fm_test_delay cookies (honoured only under FM_TEST_MODE=1). */
export async function setCookie(context: BrowserContext, baseURL: string, name: string, value: string) {
  await context.addCookies([{ name, value: encodeURIComponent(value), url: baseURL }]);
}

/** Curriculum / exercises: progress placeholders are gone once the store has read localStorage. */
export async function waitProgressHydrated(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="progress-placeholder"]') === null &&
      document.querySelector("h1") !== null,
  );
}

/** Lesson page: the bookmark toggle is disabled until progress has hydrated. */
export async function waitLessonHydrated(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Bookmark" }).and(page.locator(":enabled")).waitFor();
}
