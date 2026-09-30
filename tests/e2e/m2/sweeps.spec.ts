import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";
import { NEWS_ITEMS } from "../../fixtures/news";
import { blockStorage, collectConsole, setServerNow } from "../../support";
import { ERROR_ROUTES, NOW, ROUTES, codexPref, doc, oneComplete, orphans, readProgress, seedProgress, waitHydrated } from "./support";

test.beforeEach(async ({ context, baseURL }) => {
  await setServerNow(context, baseURL!, NOW);
});

const WIDTHS = [360, 768, 1440] as const;
const SCHEMES = ["light", "dark"] as const;

// Progress with content on every page: a completed lesson, a checklist, and one lesson plus one news bookmark.
const richProgress = doc({
  ...oneComplete,
  checklists: { "ex-fx-auto": { c1: true } },
  bookmarks: {
    lessons: { "l2-context-files": "2026-09-29T03:00:00.000Z" },
    news: { [NEWS_ITEMS.find((i) => i.alias === "n02")!.id]: "2026-09-29T04:00:00.000Z" },
  },
  lastViewed: { slug: "l2-context-files", at: "2026-09-29T05:00:00.000Z" },
});

async function axeBlocking(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  const blocking = violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${label}: ${v.id} (${v.impact}) ${v.nodes
          .slice(0, 3)
          .map((n) => `${n.target.join(" ")} [${n.any.map((a) => a.message).join("; ")}]`)
          .join(" | ")}`,
    );
  expect(blocking).toEqual([]);
}

async function landmarks(page: Page, label: string) {
  expect(await page.getByRole("heading", { level: 1 }).count(), `${label} h1`).toBe(1);
  expect(await page.getByRole("main").count(), `${label} main`).toBe(1);
  // One exposed "Main" navigation: the desktop one from 768px; below that the menu is a closed disclosure.
  const wide = (page.viewportSize()?.width ?? 0) >= 768;
  expect(await page.getByRole("navigation", { name: "Main" }).count(), `${label} nav`).toBe(wide ? 1 : 0);
}

for (const scheme of SCHEMES) {
  for (const width of WIDTHS) {
    test.describe(`axe sweep ${scheme} ${width}`, () => {
      test.use({ viewport: { width, height: 900 }, colorScheme: scheme });

      test(`TC-M2-21/24 AC: D-2.1 every route, ${scheme}, ${width}px`, async ({ page }) => {
        test.setTimeout(240_000);
        await seedProgress(page, richProgress);
        for (const route of [...ROUTES, ...ERROR_ROUTES]) {
          const res = await page.goto(route);
          expect(res?.status(), route).toBe(ERROR_ROUTES.includes(route as never) ? 404 : 200);
          await waitHydrated(page);
          await landmarks(page, route);
          await axeBlocking(page, `${route} ${scheme} ${width}`);
        }
      });

      test(`TC-M2-22/23 AC: D-2.1 lesson tabs and expanded states, ${scheme}, ${width}px`, async ({ page }) => {
        test.setTimeout(240_000);
        await seedProgress(page, richProgress);
        for (const slug of ["l1-first-session", "l1-permissions", "l2-context-files", "l2-memory"]) {
          for (const tool of ["claude", "codex"]) {
            await page.goto(`/lessons/${slug}?tool=${tool}`);
            await waitHydrated(page);
            await axeBlocking(page, `${slug}?tool=${tool} ${scheme} ${width}`);
          }
        }
        await page.goto("/lessons/l1-first-session");
        await waitHydrated(page);
        const compare = page.getByText("Compare with reference solution");
        if (await compare.count()) {
          await compare.first().click();
          // Back to the top before axe: on a scrolled page axe's target-size check counts the sticky header's links
          // as overlapping targets deeper in the page (verified with elementsFromPoint: nothing actually covers them).
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForTimeout(500); // let the disclosure settle so axe measures final geometry
          await axeBlocking(page, `reference solution open ${scheme} ${width}`);
        }
        await page.goto("/news");
        await waitHydrated(page);
        const unscored = page.getByText(/^Unscored \(\d+\)/);
        if (await unscored.count()) {
          await unscored.first().click();
          await page.waitForTimeout(500);
          await axeBlocking(page, `unscored open ${scheme} ${width}`);
        }
        if (width < 768) {
          await page.getByRole("button", { name: "Menu" }).click();
          await expect(page.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "true");
          await axeBlocking(page, `menu open ${scheme} ${width}`);
        } else {
          await expect(page.getByRole("button", { name: "Menu" })).toHaveCount(0);
          await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link")).toHaveCount(5);
        }
      });
    });
  }
}

test.describe("no horizontal scroll (D-3.1)", () => {
  for (const width of [360, 768, 1024, 1440]) {
    test(`TC-M2-26 AC: D-3.1 every route at ${width}px`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width, height: 900 });
      await seedProgress(page, richProgress);
      for (const route of [...ROUTES, ...ERROR_ROUTES]) {
        await page.goto(route);
        await waitHydrated(page);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${route} at ${width}`).toBeLessThanOrEqual(0);
      }
    });
  }

  test("TC-M2-26 step 2: the plain code block scrolls inside its own box at 360", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    await page.goto("/lessons/l1-first-session");
    await waitHydrated(page);
    const pre = page.getByLabel("Code: text").first();
    if (await pre.count()) {
      expect(await pre.evaluate((el) => getComputedStyle(el).overflowX)).toMatch(/auto|scroll/);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe("hydration sweep (P-5, S9-09)", () => {
  const runs = { "ls-one-complete": oneComplete, "ls-codex-pref": codexPref, "ls-orphans": orphans } as const;
  for (const [name, progress] of Object.entries(runs)) {
    test(`TC-M2-29 AC: P-5.1 no console errors or hydration warnings with ${name}`, async ({ page }) => {
      test.setTimeout(180_000);
      const problems = collectConsole(page);
      await seedProgress(page, progress);
      for (const route of ROUTES) {
        await page.goto(route);
        await waitHydrated(page);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(300);
        if (name === "ls-codex-pref" && route.startsWith("/lessons/")) {
          await expect(page.getByRole("tablist", { name: "Tool" }).getByRole("tab", { name: "Codex CLI" })).toHaveAttribute(
            "aria-selected",
            "true",
          );
          await expect(page).toHaveURL(/\?tool=codex/);
        }
      }
      expect(problems()).toEqual([]);
    });
  }

  test("TC-M2-29 step 2: server HTML never contains client-only progress state", async ({ request }) => {
    for (const route of ROUTES) {
      const html = await (await request.get(route)).text();
      expect(html, route).not.toContain('role="progressbar"');
      expect(html, route).not.toContain("Completed ✓ · Undo");
      expect(html, route).not.toMatch(/>1 \/ 2</);
      if (route.startsWith("/lessons/")) {
        expect(html, route).toMatch(/aria-selected="true"[^>]*>(<[^>]+>)*[^<]*Claude Code|Claude Code/);
      }
    }
  });

  test("TC-M2-30 AC: P-5.1 no 'not started' flash before hydration on the curriculum", async ({ page }) => {
    await seedProgress(page, oneComplete);
    // Only scripts are held back (the document and stylesheets are not), so the server-rendered placeholders show.
    const scripts = /\/_next\/static\/chunks\/.*\.js/;
    const hold = async (route: Route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    };
    await page.route(scripts, hold);
    await page.goto("/curriculum", { waitUntil: "commit" });
    const placeholders = page.getByTestId("progress-placeholder");
    await expect(placeholders.first()).toBeAttached({ timeout: 30_000 });
    // One synchronous snapshot inside the 2s script delay: nothing that looks like progress is on screen yet.
    const snapshot = await page.evaluate(() => ({
      bars: document.querySelectorAll('[role="progressbar"]').length,
      text: document.body.innerText,
    }));
    expect(snapshot.bars).toBe(0);
    expect(snapshot.text).not.toMatch(/\d \/ \d/);
    expect(snapshot.text).not.toContain("Completed");
    await expect(page.locator('a[href="/lessons/l1-first-session"]')).toBeVisible();
    await page.unroute(scripts, hold);
    await expect(page.getByRole("progressbar", { name: "Level 1" })).toHaveAttribute("aria-valuenow", "50", {
      timeout: 30_000,
    });
  });
});

test.describe("storage blocked (P-3, S9-10)", () => {
  test("TC-M2-37 AC: P-3.1 every route shows the banner and nothing throws", async ({ page }) => {
    test.setTimeout(180_000);
    const problems = collectConsole(page);
    await blockStorage(page);
    for (const route of ROUTES) {
      await page.goto(route);
      await waitHydrated(page);
      await expect(
        page.getByRole("status").filter({ hasText: "Progress can't be saved in this browser" }),
        route,
      ).toBeVisible();
    }
    await page.goto("/lessons/l1-first-session");
    await waitHydrated(page);
    await page.getByRole("tablist", { name: "Tool" }).getByRole("tab", { name: "Codex CLI" }).click();
    await expect(page).toHaveURL(/\?tool=codex/);
    await page.getByRole("button", { name: "Mark complete" }).click();
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Curriculum" }).click();
    await expect(page.getByText("Completed", { exact: true })).toBeVisible();
    expect(problems()).toEqual([]);
  });
});

test.describe("integration cleanups", () => {
  test("bookmarks empty-state links are at least 44px tall", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await seedProgress(page, doc());
    await page.goto("/bookmarks");
    await waitHydrated(page);
    for (const name of ["Browse curriculum", "Today's digest"]) {
      const box = await page.getByRole("link", { name }).boundingBox();
      expect(box?.height, name).toBeGreaterThanOrEqual(44);
    }
  });

  test("progress and bookmarks pages start at the same height as the other pages", async ({ page }) => {
    await seedProgress(page, doc());
    const tops: Record<string, number> = {};
    for (const route of ["/curriculum", "/progress", "/bookmarks"]) {
      await page.goto(route);
      await waitHydrated(page);
      tops[route] = (await page.getByRole("heading", { level: 1 }).boundingBox())!.y;
    }
    expect(tops["/progress"]).toBeCloseTo(tops["/curriculum"], 0);
    expect(tops["/bookmarks"]).toBeCloseTo(tops["/curriculum"], 0);
  });

  test("bookmarked news uses the shared NewsCard (score tile, source, stamp)", async ({ page }) => {
    await seedProgress(page, richProgress);
    await page.goto("/bookmarks");
    await waitHydrated(page);
    const card = page.getByRole("region", { name: "News (1)" }).getByRole("article");
    await expect(card).toHaveCount(1);
    await expect(card).toContainText("Relevance score");
    await expect(card).toContainText("Fixture OpenAI");
    await card.getByRole("button", { name: /^Bookmark: / }).click();
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
    await expect(page.locator("#fm-live")).toHaveText("Removed from bookmarks");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("region", { name: "News (1)" }).getByRole("article")).toHaveCount(1);
    expect(Object.keys((await readProgress(page))?.bookmarks.news ?? {})).toHaveLength(1);
  });

  test("archive past the last page: honest title, no Clear filters, Prev goes to the last real page", async ({ page }) => {
    await page.goto("/news/archive?page=999");
    await expect(page.getByRole("region", { name: "No results on this page" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Clear filters" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Previous page" })).toHaveAttribute("href", "/news/archive?page=2");
    await expect(page.getByRole("link", { name: "Back to page 1" })).toBeVisible();
  });

  test("with a filter active the empty state still says so", async ({ page }) => {
    await page.goto("/news/archive?source=no-such-source");
    await expect(page.getByRole("region", { name: "No items match these filters" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Clear filters" })).toHaveCount(1);
  });

  test("a curriculum failure hook no longer breaks lessons or exercises", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "fm_test_fail", value: "curriculum", url: baseURL! }]);
    await page.goto("/curriculum");
    await expect(page.getByRole("heading", { level: 1, name: "Something went wrong" })).toBeVisible();
    for (const route of ["/lessons/l1-first-session", "/exercises"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("Something went wrong");
    }
  });

  test("a lesson shows its skeleton during a slow load and the real 404 still works", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "fm_test_delay", value: encodeURIComponent("lesson:1500"), url: baseURL! }]);
    await page.goto("/lessons/l1-first-session", { waitUntil: "commit" });
    await expect(page.getByTestId("lesson-skeleton")).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("heading", { level: 1, name: "Your first agent session" })).toBeVisible({
      timeout: 10_000,
    });
    const missing = await page.goto("/lessons/does-not-exist");
    expect(missing?.status()).toBe(404);
  });
});
