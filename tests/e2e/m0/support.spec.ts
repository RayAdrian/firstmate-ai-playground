import { expect, test } from "@playwright/test";
import {
  blockStorage,
  collectConsole,
  freezeClock,
  progressDoc,
  readProgress,
  seedProgress,
} from "../../support";

test("seedProgress seeds localStorage before app scripts and readProgress reads it back", async ({ page }) => {
  const doc = progressDoc({ prefs: { tool: "codex" } });
  await seedProgress(page, doc);
  await page.goto("/");
  expect(await readProgress(page)).toMatchObject({ prefs: { tool: "codex" } });
});

test("blockStorage makes localStorage throw", async ({ page }) => {
  await blockStorage(page);
  await page.goto("/");
  const threw = await page.evaluate(() => {
    try {
      void window.localStorage;
      return false;
    } catch (e) {
      return (e as DOMException).name;
    }
  });
  expect(threw).toBe("SecurityError");
});

test("freezeClock fixes browser Date", async ({ page }) => {
  await freezeClock(page, "2026-09-30T08:03:00+08:00");
  await page.goto("/");
  expect(await page.evaluate(() => new Date().toISOString().slice(0, 13))).toBe("2026-09-30T00");
});

test("collectConsole reports console errors", async ({ page }) => {
  const problems = collectConsole(page);
  await page.goto("/");
  await page.evaluate(() => console.error("boom"));
  expect(problems()).toEqual(["console.error: boom"]);
});

test("@prod runs against a production server", async ({ request }) => {
  // `next dev` pages load the HMR client; a production build never does.
  const html = await (await request.get("/")).text();
  expect(html).not.toContain("hmr-client");
});
