import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Every PRD section 8 route plus a guaranteed 404.
const ROUTES = [
  "/",
  "/curriculum",
  "/lessons/example-lesson",
  "/exercises",
  "/news",
  "/news/archive",
  "/bookmarks",
  "/progress",
  "/this-route-does-not-exist",
];

for (const route of ROUTES) {
  test(`smoke + axe: ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
}
