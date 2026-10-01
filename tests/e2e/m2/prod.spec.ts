// Production-build checks (E2E_PROD=1 E2E_FM_TEST_MODE=1 npm run e2e). Skipped in the default dev run.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { collectConsole, setServerNow } from "../../support";
import { ERROR_ROUTES, LAYOUT_SHIFT_OBSERVER, NOW, ROUTES, oneComplete, readCls, seedProgress, waitHydrated } from "./support";

test.beforeEach(async ({ context, baseURL }) => {
  await setServerNow(context, baseURL!, NOW);
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

test.describe("production build", () => {
  test("no emitted client chunk contains shiki, including lazily loaded ones @prod", async () => {
    const root = path.join(process.cwd(), ".next", "static");
    const chunks = walk(root).filter((f) => f.endsWith(".js"));
    expect(chunks.length).toBeGreaterThan(0);
    const offenders = chunks.filter((file) => {
      const body = readFileSync(file, "utf8");
      return /createHighlighter|ShikiError|@shikijs|shiki\/core|oniguruma/i.test(body);
    });
    expect(offenders.map((f) => path.relative(root, f))).toEqual([]);
  });

  test("TC-M2-36 AC: S9-22 every route answers with the right status and title @prod", async ({ page, request }) => {
    const problems = collectConsole(page);
    for (const route of ROUTES) {
      const res = await request.get(route);
      expect(res.status(), route).toBe(200);
      await page.goto(route);
      await waitHydrated(page);
      await expect(page, route).toHaveTitle(/ · First Mate AI Playground$/);
    }
    for (const route of ERROR_ROUTES) {
      expect((await request.get(route)).status(), route).toBe(404);
    }
    expect((await request.get("/lessons/l2-retired")).status()).toBe(404);
    await page.goto("/does-not-exist");
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to curriculum" })).toBeVisible();
    await page.goto("/lessons/does-not-exist");
    await expect(page.getByRole("heading", { level: 1, name: "Lesson not found" })).toBeVisible();
    // The 404 responses log a resource error in Chromium; anything else is a real problem.
    expect(problems().filter((p) => !/404/.test(p))).toEqual([]);
  });

  for (const route of ["/", "/curriculum", "/lessons/l1-first-session", "/news"]) {
    test(`TC-M2-32 AC: D-4.2 CLS on ${route} stays under 0.05 @prod`, async ({ page }) => {
      await page.addInitScript(LAYOUT_SHIFT_OBSERVER);
      await seedProgress(page, oneComplete);
      await page.goto(route);
      await waitHydrated(page);
      await page.waitForTimeout(3000);
      expect(await readCls(page)).toBeLessThan(0.05);
    });
  }

  test("the production home page has no test hooks: fm_test_delay is ignored @prod", async ({ page, context, baseURL }) => {
    test.skip(process.env.E2E_FM_TEST_MODE === "1", "test mode is on for this run");
    await context.addCookies([{ name: "fm_test_delay", value: encodeURIComponent("/:5000"), url: baseURL! }]);
    const start = Date.now();
    await page.goto("/");
    await waitHydrated(page);
    expect(Date.now() - start).toBeLessThan(4000);
  });
});
