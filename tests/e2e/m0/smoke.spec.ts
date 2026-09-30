import { expect, test } from "@playwright/test";
import { expectNoSeriousA11y } from "../../support";

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

    await expectNoSeriousA11y(page);
  });
}
