import { expect, test } from "@playwright/test";
import {
  NOW,
  doc,
  oneComplete,
  orphans,
  seedProgress,
  setCookie,
  waitProgressHydrated,
} from "./support";
import { collectConsole, setServerNow } from "../../support";

test.beforeEach(async ({ context, baseURL }) => {
  await setServerNow(context, baseURL!, NOW);
});

const l1 = (page: import("@playwright/test").Page) => page.getByRole("region", { name: /^Level 1/ });
const l2 = (page: import("@playwright/test").Page) => page.getByRole("region", { name: /^Level 2/ });

test.describe("curriculum structure and progress", () => {
  test("TC-C-01/03/06 levels in order, lessons by sort, archived hidden", async ({ page }) => {
    await page.goto("/curriculum");
    await expect(page.getByRole("heading", { level: 1, name: "Curriculum" })).toBeVisible();
    const regions = page.getByRole("region", { name: /^Level \d/ });
    await expect(regions).toHaveCount(2);
    await expect(regions.nth(0)).toContainText("Foundations");
    await expect(regions.nth(0)).toContainText("One-line summary A");
    await expect(regions.nth(1)).toContainText("Context engineering");
    await expect(regions.nth(1)).toContainText("One-line summary B");
    await expect(l1(page).getByRole("link")).toHaveText(["Your first agent session", "Permissions and sandboxing"]);
    const l2Links = l2(page).getByRole("link");
    await expect(l2Links).toHaveCount(2);
    await expect(page.locator('a[href="/lessons/l2-retired"]')).toHaveCount(0);
    await expect(page.getByText("Retired")).toHaveCount(0);
  });

  test("TC-C-04 row shows title, objective, minutes and a verified line; no 'Not started'", async ({ page }) => {
    await seedProgress(page, doc());
    await page.goto("/curriculum");
    await waitProgressHydrated(page);
    const row = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: "Your first agent session" }) });
    await expect(row.getByRole("link", { name: "Your first agent session" })).toHaveAttribute(
      "href",
      "/lessons/l1-first-session",
    );
    await expect(row).toContainText("Run an interactive session in both tools.");
    await expect(row).toContainText("20 min");
    await expect(row).toContainText("Verified 20 Sep 2026 · Claude Code v2.1.0 / Codex v0.40.0");
    await expect(page.getByText(/not started/i)).toHaveCount(0);
  });

  test("TC-C-05/10 completion and level progress come from localStorage", async ({ page }) => {
    await seedProgress(page, oneComplete);
    await page.goto("/curriculum");
    await waitProgressHydrated(page);
    const done = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: "Your first agent session" }) });
    await expect(done.getByText("Completed")).toBeVisible();
    const other = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: "Permissions and sandboxing" }) });
    await expect(other.getByText("Completed")).toHaveCount(0);
    await expect(l1(page)).toContainText("1 / 2");
    await expect(l1(page).getByRole("progressbar", { name: "Level 1" })).toHaveAttribute("aria-valuenow", "50");
    await expect(l2(page)).toContainText("0 / 2");
    await expect(l2(page).getByRole("progressbar", { name: "Level 2" })).toHaveAttribute("aria-valuenow", "0");
  });

  test("TC-C-07 archived completion is not counted", async ({ page }) => {
    const problems = collectConsole(page);
    await seedProgress(
      page,
      doc({ lessons: { "l2-retired": { completedAt: "2026-09-01T00:00:00.000Z" } } }),
    );
    await page.goto("/curriculum");
    await waitProgressHydrated(page);
    await expect(l2(page)).toContainText("0 / 2");
    await expect(l2(page).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    expect(problems()).toEqual([]);
  });

  test("TC-C-14 unknown slugs do not inflate counts", async ({ page }) => {
    const problems = collectConsole(page);
    await seedProgress(page, orphans);
    await page.goto("/curriculum");
    await waitProgressHydrated(page);
    await expect(l1(page)).toContainText("1 / 2");
    await expect(page.getByText("deleted-lesson-slug")).toHaveCount(0);
    expect(problems()).toEqual([]);
  });

  test("TC-C-08 every lesson is one click away and nothing is locked", async ({ page }) => {
    test.setTimeout(120_000); // first compile of each lesson route in dev can be slow under load
    for (const [slug, title] of [
      ["l1-first-session", "Your first agent session"],
      ["l1-permissions", "Permissions and sandboxing"],
      ["l2-context-files", "Project instructions"],
      ["l2-memory", "Memory"],
    ] as const) {
      await page.goto("/curriculum");
      const link = page.locator(`a[href="/lessons/${slug}"]`);
      await expect(link).not.toHaveAttribute("aria-disabled", "true");
      await Promise.all([page.waitForURL(`**/lessons/${slug}`, { timeout: 60_000 }), link.click()]);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      if (title) await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    }
    await page.goto("/curriculum");
    await expect(page.getByText(/^locked$/i)).toHaveCount(0);
    await expect(page.locator("[aria-disabled=true], svg.lucide-lock")).toHaveCount(0);
  });
});

test.describe("verified and outdated badges (C-5)", () => {
  test("TC-C-16/17 61 days shows the badge, exactly 60 does not", async ({ page }) => {
    await page.goto("/curriculum");
    const permissions = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: "Permissions and sandboxing" }) });
    await expect(permissions.getByText("May be outdated")).toBeVisible();
    const context = page.getByRole("listitem").filter({ has: page.locator('a[href="/lessons/l2-context-files"]') });
    await expect(context.getByText("May be outdated")).toHaveCount(0);
    await page.goto("/lessons/l1-permissions");
    await expect(page.getByText("May be outdated")).toBeVisible();
    await page.goto("/lessons/l2-context-files");
    await expect(page.getByText("May be outdated")).toHaveCount(0);
  });

  test("TC-C-18 the boundary follows the Manila clock, not the browser zone", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ timezoneId: "America/Los_Angeles" });
    const page = await ctx.newPage();
    const problems = collectConsole(page);
    await setServerNow(ctx, baseURL!, "2026-09-29T23:30:00+08:00");
    await page.goto(`${baseURL}/curriculum`);
    await expect(page.getByText("May be outdated")).toHaveCount(0);
    await setServerNow(ctx, baseURL!, "2026-09-30T00:30:00+08:00");
    await page.reload();
    await expect(page.getByText("May be outdated")).toBeVisible();
    expect(problems()).toEqual([]);
    await ctx.close();
  });
});

test.describe("curriculum states", () => {
  test("TC-C-70 server HTML carries no completion state", async ({ request }) => {
    for (const path of ["/curriculum", "/lessons/l1-first-session"]) {
      const html = await (await request.get(path)).text();
      expect(html).not.toMatch(/Not started|Completed|Undo|1 \/ 2/);
      expect(html).not.toContain('role="progressbar"');
    }
  });

  test("TC-C-70 hydrates stored progress without a hydration warning or a 'not started' flash", async ({ page }) => {
    const problems = collectConsole(page);
    await page.addInitScript(() => {
      (window as unknown as { __seen: string[] }).__seen = [];
      new MutationObserver(() => {
        const text = document.body?.innerText ?? "";
        for (const t of ["Not started", "Completed"]) {
          if (text.includes(t)) (window as unknown as { __seen: string[] }).__seen.push(t);
        }
      }).observe(document, { childList: true, subtree: true, characterData: true });
    });
    await seedProgress(page, oneComplete);
    await page.goto("/curriculum");
    await waitProgressHydrated(page);
    const seen = await page.evaluate(() => (window as unknown as { __seen: string[] }).__seen);
    expect(seen).not.toContain("Not started");
    expect(problems()).toEqual([]);
  });

  test("TC-C-65 loading skeleton is shown while the query is slow", async ({ page, context, baseURL }) => {
    await setCookie(context, baseURL!, "fm_test_delay", "curriculum:1500");
    await page.goto("/");
    const nav = page.goto("/curriculum", { waitUntil: "commit" });
    await expect(page.getByTestId("curriculum-skeleton")).toHaveAttribute("aria-busy", "true");
    await nav;
    await expect(page.getByRole("region", { name: /^Level 1/ })).toBeVisible({ timeout: 10_000 });
  });

  test("TC-C-66 a failing query shows an alert with retry, no internals", async ({ page, context, baseURL }) => {
    await setCookie(context, baseURL!, "fm_test_fail", "curriculum");
    await page.goto("/curriculum");
    const alert = page.getByRole("alert").filter({ hasText: "couldn't load" });
    await expect(alert).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/Injected test failure|SELECT|stack/i);
    await context.clearCookies({ name: "fm_test_fail" });
    await setServerNow(context, baseURL!, NOW);
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("region", { name: /^Level \d/ })).toHaveCount(2);
  });
});
