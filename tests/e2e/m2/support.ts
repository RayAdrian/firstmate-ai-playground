import type { BrowserContext, Page } from "@playwright/test";
import { progressDoc, readProgress as readRaw, seedProgress } from "../../support";

// WS-M2 e2e helpers. Runs against fx-base (`npm run db:reset:test`) with the test clock 2026-09-30 Manila.

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

export const TITLE = {
  firstSession: "Your first agent session",
  permissions: "Permissions and sandboxing",
  contextFiles: "Project instructions",
  memory: "Memory",
} as const;

/** ROUTES from docs/test-cases/ws-m2-integration.md. `/__ui/throw` is not implemented in this app (AMB-M1). */
export const ROUTES = [
  "/",
  "/curriculum",
  "/lessons/l1-first-session",
  "/lessons/l1-permissions",
  "/lessons/l2-memory",
  "/exercises",
  "/news",
  "/news/archive",
  "/bookmarks",
  "/progress",
] as const;

export const ERROR_ROUTES = ["/does-not-exist", "/lessons/does-not-exist"] as const;

export async function readProgress(page: Page): Promise<Doc | null> {
  return (await readRaw(page)) as Doc | null;
}

export async function setCookie(context: BrowserContext, baseURL: string, name: string, value: string) {
  await context.addCookies([{ name, value: encodeURIComponent(value), url: baseURL }]);
}

/**
 * Wait until the page has hydrated. Every route mounts the progress store, and the "Skip to content" link plus the
 * placeholders/skeletons going away is the observable signal.
 */
export async function waitHydrated(page: Page): Promise<void> {
  await page.waitForLoadState("load");
  // A streamed page keeps its real content in a hidden node until the Suspense swap: wait for a VISIBLE h1.
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="progress-placeholder"]') === null &&
      document.querySelector('[data-testid$="-skeleton"]') === null,
  );
}

/** Sum of layout-shift entries without recent input; install with `page.addInitScript(LAYOUT_SHIFT_OBSERVER)`. */
export const LAYOUT_SHIFT_OBSERVER = () => {
  const w = window as unknown as { __cls: number };
  w.__cls = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
      if (!entry.hadRecentInput) w.__cls += entry.value;
    }
  }).observe({ type: "layout-shift", buffered: true });
};

export const readCls = (page: Page) => page.evaluate(() => (window as unknown as { __cls: number }).__cls);
