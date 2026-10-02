import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11y, setServerNow } from "../../support";
import { cardTitles, fixture, go, NOW_DEFAULT } from "./helpers";

// Read-only specs against fx-base: digest days are 2026-09-28 (success), 09-29 (partial) and 09-30 (success;
// a failed manual run the same day never counts). Server "now" is Wed 30 Sep 13:00 Manila.
test.beforeEach(async ({ context, baseURL }) => {
  await setServerNow(context, baseURL ?? "", NOW_DEFAULT);
});

const stepper = (page: Page) => page.getByRole("navigation", { name: "Digest day" });
const toggle = (page: Page) => page.getByRole("navigation", { name: "Items to show" });
const titles = (aliases: string[]) => aliases.map((a) => fixture(a).title);

test.describe("day navigation", () => {
  test("today: no next link, previous goes to the day before", async ({ page }) => {
    await go(page, "/news");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Today's digest");
    await expect(stepper(page)).toContainText("Wed 30 Sep");
    await expect(stepper(page).getByRole("link", { name: "Next day" })).toHaveCount(0);
    const prev = stepper(page).getByRole("link", { name: "Previous day" });
    await expect(prev).toHaveAttribute("href", "/news?date=2026-09-29");
    expect((await prev.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test("a past day shows its own digest, relevance bar and unscored section", async ({ page }) => {
    await go(page, "/news?date=2026-09-29");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Digest for Tue 29 Sep");
    await expect(page.locator("body")).toContainText("Tue 29 Sep · updated 08:04");
    expect(await cardTitles(page.getByRole("list", { name: "Digest for Tue 29 Sep" }))).toEqual(
      titles(["n20", "n24", "n21"]),
    );
    await expect(page.getByRole("button", { name: /^Unscored \(2\)$/ })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("No digest yet today");
  });

  test("stepping back and forward walks the digest days", async ({ page }) => {
    await go(page, "/news");
    await stepper(page).getByRole("link", { name: "Previous day" }).click();
    await expect(page).toHaveURL(/\/news\?date=2026-09-29$/);
    await expect(stepper(page)).toContainText("Tue 29 Sep");
    await stepper(page).getByRole("link", { name: "Previous day" }).click();
    await expect(page).toHaveURL(/date=2026-09-28/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Digest for Mon 28 Sep");
    // The oldest day has no previous link.
    await expect(stepper(page).getByRole("link", { name: "Previous day" })).toHaveCount(0);
    await stepper(page).getByRole("link", { name: "Next day" }).click();
    await expect(page).toHaveURL(/date=2026-09-29/);
  });

  test("an empty day is skipped by previous, and shows a no-digest state when opened directly", async ({ page }) => {
    // 27 Sep has no run. Next from there goes to the nearest day with a digest, 28 Sep.
    await go(page, "/news?date=2026-09-27");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Digest for Sun 27 Sep");
    await expect(page.getByRole("region", { name: "No digest for Sun 27 Sep" })).toBeVisible();
    await expect(stepper(page).getByRole("link", { name: "Previous day" })).toHaveCount(0);
    await expect(stepper(page).getByRole("link", { name: "Next day" })).toHaveAttribute("href", "/news?date=2026-09-28");
  });

  test("today's date in the URL shows today's digest", async ({ page }) => {
    await go(page, "/news?date=2026-09-30");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Today's digest");
  });

  test("invalid and future dates show a notice and the latest digest", async ({ page }) => {
    for (const bad of ["nope", "2026-13-40", "2026-10-05"]) {
      await go(page, `/news?date=${bad}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Today's digest");
      await expect(page.getByText(/Showing the latest digest/)).toBeVisible();
      await expect(page.locator("body")).toContainText("Wed 30 Sep · updated 08:03");
    }
  });

  test("keyboard: stepper links are reachable and activate with Enter", async ({ page }) => {
    await go(page, "/news");
    await stepper(page).getByRole("link", { name: "Previous day" }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/date=2026-09-29/);
  });

  test("axe on a past day and at 360px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await go(page, "/news?date=2026-09-29&show=all");
    await expectNoSeriousA11y(page);
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollW).toBeLessThanOrEqual(360);
  });
});

test.describe("relevance toggle", () => {
  test("defaults to Relevant with counts, matching the current list", async ({ page }) => {
    await go(page, "/news");
    const rel = toggle(page).getByRole("link", { name: "Relevant (10)" });
    const all = toggle(page).getByRole("link", { name: "All (15)" });
    await expect(rel).toHaveAttribute("aria-current", "true");
    await expect(all).not.toHaveAttribute("aria-current", "true");
    await expect(page.getByText("Below the bar")).toHaveCount(0);
    expect((await all.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test("All shows every scored item, sub-bar ones after a divider with the score in text", async ({ page }) => {
    await go(page, "/news");
    await toggle(page).getByRole("link", { name: "All (15)" }).click();
    await expect(page).toHaveURL(/\/news\?show=all$/);
    await expect(toggle(page).getByRole("link", { name: "All (15)" })).toHaveAttribute("aria-current", "true");

    const above = await cardTitles(page.getByRole("list", { name: "Today's digest" }));
    expect(above).toHaveLength(13);
    expect(above.slice(0, 3)).toEqual(titles(["n01", "n02", "n19"]));
    await expect(page.getByRole("heading", { name: /^Below the bar/ })).toBeVisible();
    const below = page.getByRole("list", { name: "Below the relevance bar" });
    expect(await cardTitles(below)).toEqual(titles(["n13", "n14"]));
    await expect(below.getByRole("article").first()).toContainText("Relevance score 59 out of 100");
    // Unscored section is unchanged.
    await expect(page.getByRole("button", { name: /^Unscored \(3\)$/ })).toBeVisible();
  });

  test("an invalid show value falls back to Relevant", async ({ page }) => {
    await go(page, "/news?show=everything");
    await expect(toggle(page).getByRole("link", { name: /^Relevant/ })).toHaveAttribute("aria-current", "true");
  });

  test("show and date combine: stepper keeps show, toggle keeps date", async ({ page }) => {
    await go(page, "/news?show=all");
    await expect(stepper(page).getByRole("link", { name: "Previous day" })).toHaveAttribute(
      "href",
      "/news?date=2026-09-29&show=all",
    );
    await stepper(page).getByRole("link", { name: "Previous day" }).click();
    await expect(page).toHaveURL(/date=2026-09-29&show=all/);
    // 29 Sep: ranked n20, n24, n21 and below the bar n22 (45), n23 (20).
    expect(await cardTitles(page.getByRole("list", { name: "Digest for Tue 29 Sep" }))).toEqual(
      titles(["n20", "n24", "n21"]),
    );
    expect(await cardTitles(page.getByRole("list", { name: "Below the relevance bar" }))).toEqual(
      titles(["n22", "n23"]),
    );
    await expect(toggle(page).getByRole("link", { name: "Relevant (3)" })).toHaveAttribute(
      "href",
      "/news?date=2026-09-29",
    );
    await toggle(page).getByRole("link", { name: "Relevant (3)" }).click();
    await expect(page).toHaveURL(/\/news\?date=2026-09-29$/);
    await expect(page.getByText("Below the bar")).toHaveCount(0);
  });

  test("axe in All view (light)", async ({ page }) => {
    await go(page, "/news?show=all");
    await expectNoSeriousA11y(page);
  });
});

test.describe("dark scheme", () => {
  test.use({ colorScheme: "dark" });
  test("axe in All view on a past day (dark)", async ({ page }) => {
    await go(page, "/news?date=2026-09-29&show=all");
    await expectNoSeriousA11y(page);
  });
});
