import { expect, test, type Page } from "@playwright/test";
import { NEWS_ITEMS } from "../../fixtures/news";
import { collectConsole, setServerNow } from "../../support";
import {
  LAYOUT_SHIFT_OBSERVER,
  NOW,
  TITLE,
  doc,
  oneComplete,
  orphans,
  readCls,
  readProgress,
  seedProgress,
  setCookie,
  waitHydrated,
} from "./support";

test.beforeEach(async ({ context, baseURL }) => {
  await setServerNow(context, baseURL!, NOW);
});

const cont = (page: Page) => page.getByRole("link", { name: /^Continue: .+/ });
const newsTitle = (alias: string) => NEWS_ITEMS.find((i) => i.alias === alias)!.title;

/** Visit a lesson and wait until the store is hydrated (the lesson records itself as last viewed after mount). */
async function view(page: Page, slug: string) {
  await page.goto(`/lessons/${slug}`);
  await page.getByRole("button", { name: "Bookmark", exact: true }).and(page.locator(":enabled")).waitFor();
  await expect.poll(async () => (await readProgress(page))?.lastViewed?.slug).toBe(slug);
}

test.describe("Home: Continue CTA (C-4)", () => {
  test("TC-M2-01 AC: C-4.1 links to the last viewed lesson", async ({ page }) => {
    await seedProgress(page, doc());
    await view(page, "l2-context-files");
    await page.goto("/");
    await waitHydrated(page);
    await expect(cont(page)).toHaveAccessibleName(`Continue: ${TITLE.contextFiles}`);
    await expect(cont(page)).toHaveAttribute("href", "/lessons/l2-context-files");
    await expect(page.getByRole("heading", { level: 2, name: TITLE.contextFiles })).toBeVisible();
    const stored = await readProgress(page);
    expect(stored?.lastViewed?.slug).toBe("l2-context-files");
    expect(Number.isNaN(Date.parse(stored?.lastViewed?.at ?? ""))).toBe(false);
    await cont(page).click();
    await expect(page).toHaveURL(/\/lessons\/l2-context-files$/);
  });

  test("TC-M2-02 AC: C-4.2 no history links to the first L1 lesson", async ({ page }) => {
    await seedProgress(page, doc());
    await page.goto("/");
    await waitHydrated(page);
    await expect(cont(page)).toHaveCount(1);
    await expect(cont(page)).toHaveAccessibleName(`Continue: ${TITLE.firstSession}`);
    await expect(cont(page)).toHaveAttribute("href", "/lessons/l1-first-session");
  });

  test("TC-M2-03 AC: C-4.1 the most recent view wins, not the furthest lesson", async ({ page }) => {
    await seedProgress(page, doc());
    await view(page, "l2-context-files");
    await view(page, "l1-permissions");
    await page.goto("/");
    await waitHydrated(page);
    await expect(cont(page)).toHaveAttribute("href", "/lessons/l1-permissions");
    expect((await readProgress(page))?.lastViewed?.slug).toBe("l1-permissions");
  });

  for (const slug of ["l2-retired", "deleted-lesson-slug"]) {
    test(`TC-M2-04 AC: C-4.2 unknown or archived last viewed (${slug}) falls back silently`, async ({ page }) => {
      const problems = collectConsole(page);
      await seedProgress(page, doc({ lastViewed: { slug, at: "2026-09-29T01:00:00.000Z" } }));
      await page.goto("/");
      await waitHydrated(page);
      await expect(cont(page)).toHaveAccessibleName(`Continue: ${TITLE.firstSession}`);
      await expect(cont(page)).toHaveAttribute("href", "/lessons/l1-first-session");
      await expect(page.locator("main [role=alert]")).toHaveCount(0);
      expect((await readProgress(page))?.lastViewed?.slug).toBe(slug);
      expect(problems()).toEqual([]);
    });
  }

  test("TC-M2-05 AC: C-4.1 hydration-safe, swaps in place without layout shift", async ({ page, request }) => {
    const html = await (await request.get("/")).text();
    expect(html).toMatch(/Continue: (<!-- -->)?Your first agent session/);
    expect(html).toContain('href="/lessons/l1-first-session"');
    expect(html).not.toContain('role="progressbar"');
    expect(html).not.toContain('href="/lessons/l2-context-files"');

    const problems = collectConsole(page);
    await page.addInitScript(LAYOUT_SHIFT_OBSERVER);
    await seedProgress(
      page,
      doc({ lastViewed: { slug: "l2-context-files", at: "2026-09-29T01:00:00.000Z" } }),
    );
    await page.goto("/");
    await waitHydrated(page);
    await expect(cont(page)).toHaveAccessibleName(`Continue: ${TITLE.contextFiles}`);
    await expect(cont(page)).toHaveAttribute("href", "/lessons/l2-context-files");
    await page.waitForTimeout(500);
    expect(await readCls(page)).toBeLessThan(0.05);
    expect(problems()).toEqual([]);
  });

  test("TC-M2-50 AC: C-4.1 resumes a completed last-viewed lesson, never 'Next up'", async ({ page }) => {
    await seedProgress(
      page,
      doc({ ...oneComplete, lastViewed: { slug: "l1-first-session", at: "2026-09-29T02:00:00.000Z" } }),
    );
    await page.goto("/");
    await waitHydrated(page);
    await expect(cont(page)).toHaveAccessibleName(`Continue: ${TITLE.firstSession}`);
    await expect(cont(page)).toHaveAttribute("href", "/lessons/l1-first-session");
    await expect(page.getByText(/next up/i)).toHaveCount(0);
  });
});

test.describe("Home: digest and levels (N-6, C-2, C-3)", () => {
  test("TC-M2-06 AC: N-6.1 top 3 digest items, compact, with See all", async ({ page }) => {
    await page.goto("/");
    const list = page.getByRole("list", { name: "Today's digest" });
    await expect(list.getByRole("listitem")).toHaveCount(3);
    await expect(list.getByRole("article")).toHaveCount(3);
    await expect(list.getByRole("heading", { level: 3 })).toHaveText([
      `${newsTitle("n01")} (opens in new tab)`,
      `${newsTitle("n02")} (opens in new tab)`,
      `${newsTitle("n19")} (opens in new tab)`,
    ]);
    await expect(page.getByRole("heading", { level: 2, name: "Today · Wed 30 Sep" })).toBeVisible();
    await expect(list.getByRole("list", { name: "Tags" })).toHaveCount(0);
    await expect(list.getByText("Why it matters")).toHaveCount(0);
    // n19's title is feed content: literal text, never markup.
    await expect(list.locator("b")).toHaveCount(0);
    await expect(list.getByRole("link", { name: `${newsTitle("n19")} (opens in new tab)` })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    await page.getByRole("link", { name: "See all" }).click();
    await expect(page).toHaveURL(/\/news$/);
  });

  test("TC-M2-08 AC: N-6.1 stale digest is labelled Latest, with a Stale badge and no 'today'", async ({
    page,
    context,
    baseURL,
  }) => {
    await setServerNow(context, baseURL!, "2026-10-01T09:00:00+08:00");
    await page.goto("/");
    const list = page.getByRole("list", { name: "Latest digest" });
    await expect(list.getByRole("listitem")).toHaveCount(3);
    await expect(page.getByRole("heading", { level: 2, name: "Latest · Wed 30 Sep" })).toBeVisible();
    await expect(page.getByText("Stale", { exact: true })).toBeVisible();
    await expect(page.getByRole("list", { name: "Today's digest" })).toHaveCount(0);
    await expect(page.getByRole("main")).not.toContainText(/today/i);
    await page.getByRole("link", { name: "See all" }).click();
    await expect(page).toHaveURL(/\/news$/);
  });

  test("TC-M2-51 AC: C-2.1 heading, level cards with progress, and curriculum link", async ({ page }) => {
    await seedProgress(page, oneComplete);
    await page.goto("/");
    await waitHydrated(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Learn Claude Code and Codex CLI, basics to orchestration",
    );
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    const levels = page.getByRole("link", { name: /^Level \d/ });
    await expect(levels).toHaveCount(2);
    await expect(levels.nth(0)).toHaveAccessibleName("Level 1 Foundations");
    await expect(levels.nth(1)).toHaveAccessibleName("Level 2 Context engineering");
    await expect(page.getByRole("progressbar", { name: "Level 1" })).toHaveAttribute("aria-valuenow", "50");
    await expect(page.getByRole("progressbar", { name: "Level 2" })).toHaveAttribute("aria-valuenow", "0");
    const card = (name: string) =>
      page.getByRole("listitem").filter({ has: page.getByRole("link", { name, exact: true }) });
    await expect(card("Level 1 Foundations")).toContainText("1 / 2");
    await expect(card("Level 2 Context engineering")).toContainText("0 / 2");
    await expect(page).toHaveTitle("Home · First Mate AI Playground");
    await expect(page.getByRole("link", { name: "View full curriculum" })).toHaveAttribute("href", "/curriculum");
    await levels.nth(1).click();
    await expect(page).toHaveURL(/\/curriculum#level-2$/);
  });

  test("TC-M2-52 AC: S9-03 home skeleton shows while loading, then swaps with no layout shift", async ({
    page,
    context,
    baseURL,
  }) => {
    await setCookie(context, baseURL!, "fm_test_delay", "/:1500");
    await page.addInitScript(LAYOUT_SHIFT_OBSERVER);
    await seedProgress(page, doc());
    // The page streams: "commit" returns while the delayed region is still suspended.
    await page.goto("/", { waitUntil: "commit" });
    const skeleton = page.getByTestId("home-skeleton");
    await expect(skeleton).toHaveAttribute("aria-busy", "true");
    await expect(skeleton).toHaveCount(0, { timeout: 10_000 });
    await expect(cont(page)).toBeVisible();
    await expect(page.getByRole("link", { name: /^Level \d/ })).toHaveCount(2);
    await expect(page.getByRole("list", { name: "Today's digest" }).getByRole("listitem")).toHaveCount(3);
    await waitHydrated(page);
    // The h1 is outside the suspended region, so the swap is content-only.
    expect(await readCls(page)).toBeLessThan(0.05);
  });

  test("orphan progress entries never show on the home levels", async ({ page }) => {
    await seedProgress(page, orphans);
    await page.goto("/");
    await waitHydrated(page);
    await expect(page.getByRole("progressbar", { name: "Level 1" })).toHaveAttribute("aria-valuenow", "50");
  });
});
