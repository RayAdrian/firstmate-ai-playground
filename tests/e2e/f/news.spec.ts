import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";

import { blockStorage, collectConsole, expectNoSeriousA11y, progressDoc, readProgress, seedProgress, setServerNow } from "../../support";
import { NEWS_ITEMS } from "../../fixtures/news";
import { cardTitles, fixture, go, resetDb, itemId, NOW_DEFAULT, patchItems, setCookie } from "./helpers";

// Runs against fx-base (`npm run db:reset:test`). Tests that patch fixture rows restore them afterwards, so
// the file is serial. Variant/destructive cases live in news-integration.spec.ts (FM_F_INTEGRATION=1).
test.describe.configure({ mode: "serial" });

type ProgressDoc = { bookmarks: { news: Record<string, string> } };
const DIGEST_ORDER = ["n01", "n02", "n19", "n03", "n04", "n05", "n06", "n07", "n08", "n09"];
const digestTitles = () => DIGEST_ORDER.map((a) => fixture(a).title);

test.beforeEach(async ({ context, baseURL }) => {
  await setServerNow(context, baseURL ?? "", NOW_DEFAULT);
});

const digestList = (page: Page) => page.getByRole("list", { name: "Today's digest" });

test.describe("digest (N-1)", () => {
  test("TC-F-01 header shows the latest successful run date and finish time", async ({ page }) => {
    await go(page, "/news");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Today's digest");
    await expect(page.locator("main, body").first()).toContainText("Wed 30 Sep · updated 08:03");
    const text = await page.locator("body").innerText();
    expect(text).not.toContain("12:31");
    expect(text).not.toContain("12:30");
    expect(text).not.toContain("No digest yet today");
  });

  test("TC-F-03 partial run counts as the digest, keyed on its own digest date", async ({ page, context, baseURL }) => {
    await setServerNow(context, baseURL ?? "", "2026-09-29T13:00:00+08:00");
    await go(page, "/news");
    await expect(page.locator("body")).toContainText("Tue 29 Sep · updated 08:04");
    expect(await cardTitles(digestList(page))).toEqual(["n20", "n24", "n21"].map((a) => fixture(a).title));
    await expect(page.getByRole("button", { name: /^Unscored \(2\)$/ })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("No digest yet today");
  });

  test("TC-F-05 exact top-10 order with cap", async ({ page }) => {
    await go(page, "/news");
    expect(await cardTitles(digestList(page))).toEqual(digestTitles());
    for (const alias of ["n10", "n11", "n12", "n13", "n14"]) {
      await expect(digestList(page).getByText(fixture(alias).title, { exact: true })).toHaveCount(0);
    }
  });

  test("TC-F-07 score 60 is included and 59 is not", async ({ page }) => {
    const restore = await patchItems(
      Object.fromEntries(
        ["n01", "n02", "n03", "n04", "n05", "n06", "n07", "n08", "n09", "n10", "n11", "n19"].map((a) => [a, { score: 50 }]),
      ),
    );
    try {
      await go(page, "/news");
      expect(await cardTitles(digestList(page))).toEqual([fixture("n12").title]);
      await expect(digestList(page)).toContainText("60");
      await expect(page.getByText(fixture("n13").title)).toHaveCount(0);
    } finally {
      await restore();
    }
  });
});

test.describe("item fields and safe rendering (N-1.3)", () => {
  test("TC-F-10 an item shows link, source, date, score, tags and why-it-matters", async ({ page }) => {
    await go(page, "/news");
    const n01 = fixture("n01");
    const card = digestList(page).getByRole("article").first();
    const link = card.getByRole("link", { name: `${n01.title} (opens in new tab)` });
    await expect(link).toHaveAttribute("href", n01.url);
    await expect(card).toContainText("Relevance score");
    await expect(card).toContainText("95");
    await expect(card).toContainText("Why it matters");
    await expect(card).toContainText(n01.why_it_matters ?? "");
    const stamp = (await card.locator("time").getAttribute("datetime")) ?? "";
    expect(Date.parse(stamp)).toBe(Date.parse(n01.published_at ?? ""));
    await expect(card.getByRole("list", { name: "Tags" }).getByRole("listitem")).toHaveCount(n01.tags.length);
  });

  test("TC-F-11 external title links open safely", async ({ page }) => {
    await go(page, "/news");
    const links = digestList(page).getByRole("link");
    expect(await links.count()).toBe(10);
    for (const link of await links.all()) {
      await expect(link).toHaveAttribute("target", "_blank");
      const rel = (await link.getAttribute("rel")) ?? "";
      expect(rel).toContain("noopener");
      expect(rel).toContain("noreferrer");
    }
  });

  test("TC-F-12 an item without tags renders no tag list", async ({ page }) => {
    await go(page, "/news");
    const n05 = digestList(page).getByRole("article").filter({ hasText: fixture("n05").title });
    await expect(n05.getByRole("list", { name: "Tags" })).toHaveCount(0);
    await expect(n05).toContainText("80");
  });

  test("TC-F-13 title and why-it-matters are plain text", async ({ page }) => {
    await go(page, "/news");
    await page.waitForLoadState("networkidle");
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    const n19 = digestList(page).getByRole("article").filter({ hasText: "Ignore previous instructions" });
    await expect(n19).toContainText("Ignore previous instructions <b>bold</b>");
    await expect(n19).toContainText('<img src=x onerror="window.__xss=3">Plain text only');
    await expect(n19.locator("img")).toHaveCount(0);
    await expect(n19.locator("b")).toHaveCount(0);
  });

  test("TC-F-14 a non-http(s) URL is not rendered as a link", async ({ page }) => {
    const restore = await patchItems({ n02: { url: "javascript:window.__xss=4" } });
    try {
      await go(page, "/news");
      const n02 = digestList(page).getByRole("article").filter({ hasText: fixture("n02").title });
      await expect(n02.getByRole("link")).toHaveCount(0);
      await expect(n02.getByRole("heading", { level: 3 })).toContainText(fixture("n02").title);
      expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    } finally {
      await restore();
    }
  });

  test("TC-F-15 long unbroken strings wrap at 360px", async ({ page }) => {
    const restore = await patchItems({
      n01: { title: "A".repeat(200), url: `https://example.com/${"x".repeat(300)}` },
    });
    try {
      await page.setViewportSize({ width: 360, height: 800 });
      await go(page, "/news");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    } finally {
      await restore();
    }
  });
});

test.describe("unscored section (N-2.1)", () => {
  test("TC-F-16/17/18 collapsed, counts pending and failed, shows titles only", async ({ page }) => {
    await go(page, "/news");
    const button = page.getByRole("button", { name: /^Unscored \(\d+\)$/ });
    await expect(button).toHaveText("Unscored (3)");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    for (const a of ["n15", "n16", "n17"]) await expect(page.getByText(fixture(a).title)).toBeHidden();

    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    const panel = page.locator(`#${await button.getAttribute("aria-controls")}`);
    expect((await cardTitles(panel)).sort()).toEqual(["n15", "n16", "n17"].map((a) => fixture(a).title).sort());
    await expect(panel).not.toContainText("Why it matters");
    await expect(panel.getByRole("list", { name: "Tags" })).toHaveCount(0);
    await expect(panel).toContainText("Scoring failed");
    for (const a of ["n18", "n25", "n26"]) await expect(page.getByText(fixture(a).title)).toHaveCount(0);
    // still never in the ranked list
    expect(await cardTitles(digestList(page))).toEqual(digestTitles());
  });

  test("TC-F-20 keyboard operation keeps focus and wires aria-controls", async ({ page }) => {
    await go(page, "/news");
    const button = page.getByRole("button", { name: /^Unscored \(3\)$/ });
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(button).toBeFocused();
    await page.keyboard.press("Space");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(button).toBeFocused();
    await expect(page.locator(`#${await button.getAttribute("aria-controls")}`)).toHaveCount(1);
  });
});

test.describe("stale digest and Manila time (N-3.1)", () => {
  test("TC-F-21/22 no run today: stale notice, latest digest, copyable command", async ({ page, context, baseURL }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await setServerNow(context, baseURL ?? "", "2026-10-01T09:00:00+08:00");
    await go(page, "/news");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Latest digest");
    await expect(page.locator("body")).toContainText("No digest yet today. Showing Wed 30 Sep");
    await expect(page.getByRole("list", { name: "Latest digest" }).getByRole("article")).toHaveCount(10);
    await expect(page.locator("code", { hasText: "npm run news:run" })).toBeVisible();
    await page.getByRole("button", { name: /^Copy/ }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("npm run news:run");
    await expect(page.locator("#fm-live, [role=status]").filter({ hasText: "Copied" }).first()).toBeAttached();
  });

  test("TC-F-23 the Manila midnight boundary decides staleness", async ({ page, context, baseURL }) => {
    const stale = "No digest yet today. Showing Wed 30 Sep";
    await setServerNow(context, baseURL ?? "", "2026-10-01T07:59:00+08:00");
    await go(page, "/news");
    await expect(page.locator("body")).toContainText(stale);
    await setServerNow(context, baseURL ?? "", "2026-09-30T23:59:00+08:00");
    await go(page, "/news");
    await expect(page.locator("body")).not.toContainText("No digest yet today");
    await expect(page.locator("body")).toContainText("Wed 30 Sep · updated 08:03");
    await setServerNow(context, baseURL ?? "", "2026-10-01T00:00:00+08:00");
    await go(page, "/news");
    await expect(page.locator("body")).toContainText(stale);
  });

  test("TC-F-24 early Manila morning: yesterday's run is stale", async ({ page, context, baseURL }) => {
    await setServerNow(context, baseURL ?? "", "2026-09-30T00:30:00+08:00");
    await go(page, "/news");
    await expect(page.locator("body")).toContainText("No digest yet today. Showing Tue 29 Sep");
    expect(await cardTitles(page.getByRole("list", { name: "Latest digest" }))).toEqual(
      ["n20", "n24", "n21"].map((a) => fixture(a).title),
    );
  });

  for (const timezoneId of ["America/Los_Angeles", "UTC"]) {
    test(`TC-F-25 browser zone ${timezoneId} does not change dates or times`, async ({ browser, baseURL }) => {
      const context = await browser.newContext({ timezoneId });
      await setServerNow(context, baseURL ?? "", NOW_DEFAULT);
      const page = await context.newPage();
      const restore = await patchItems({ n01: { published_at: "2026-09-29T16:30:00Z" } });
      try {
        const logs = collectConsole(page);
        await go(page, "/news");
        await page.waitForLoadState("networkidle");
        await expect(page.locator("body")).toContainText("Wed 30 Sep · updated 08:03");
        await expect(page.locator("body")).not.toContainText("No digest yet today");
        await expect(digestList(page).getByRole("article").first().locator("time")).toHaveText("Wed 30 Sep, 00:30");
        expect(logs()).toEqual([]);
      } finally {
        await restore();
        await context.close();
      }
    });
  }
});

test.describe("archive (N-4.1)", () => {
  const results = (page: Page) => page.getByRole("heading", { level: 2, name: "Results" }).locator("xpath=following::ol[1]");
  const countText = async (page: Page) => (await page.locator("main p, body p").filter({ hasText: /items? · page|^0 items/ }).first().innerText()).trim();

  test("TC-F-26 unfiltered: 25 newest first, next page link", async ({ page }) => {
    await go(page, "/news/archive");
    await expect(results(page).getByRole("article")).toHaveCount(25);
    const stamps = await results(page).locator("time").evaluateAll((els) => els.map((e) => Date.parse(e.getAttribute("datetime") ?? "")));
    expect([...stamps].sort((a, b) => b - a)).toEqual(stamps);
    await expect(page.getByRole("link", { name: "Next page" })).toHaveAttribute("href", /page=2/);
    expect(await countText(page)).toContain("30 items · page 1 of 2");
  });

  test("TC-F-27 minimum score filter offers 0/40/60/80 and narrows the set", async ({ page }) => {
    await go(page, "/news/archive");
    const select = page.getByLabel("Minimum score", { exact: true });
    expect(await select.locator("option").evaluateAll((o) => o.map((x) => (x as HTMLOptionElement).value))).toEqual(["0", "40", "60", "80"]);
    const expected: Record<string, string> = { "40": "21 items", "60": "18 items", "80": "9 items" };
    for (const [min, count] of Object.entries(expected)) {
      await go(page, "/news/archive");
      await page.getByLabel("Minimum score", { exact: true }).selectOption(min);
      await page.getByRole("button", { name: "Apply filters" }).click();
      await expect(page).toHaveURL(new RegExp(`min=${min}`));
      expect(await countText(page)).toContain(count);
    }
  });

  test("TC-F-28 source and date range filters", async ({ page }) => {
    await go(page, "/news/archive");
    await page.getByLabel("Source", { exact: true }).selectOption("fx-simon");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/source=fx-simon/);
    const simon = NEWS_ITEMS.filter((i) => i.source_slug === "fx-simon");
    expect((await cardTitles(results(page))).sort()).toEqual(simon.map((i) => i.title).sort());

    await go(page, "/news/archive");
    await page.getByLabel("From", { exact: true }).fill("2026-09-28");
    await page.getByLabel("To", { exact: true }).fill("2026-09-28");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/from=2026-09-28&to=2026-09-28/);
    expect((await cardTitles(results(page))).sort()).toEqual(["n27", "n28", "n29", "n30"].map((a) => fixture(a).title).sort());

    await go(page, "/news/archive?from=2026-09-29&to=2026-09-30");
    expect(await countText(page)).toContain("26 items · page 1 of 2");
    await expect(results(page).getByRole("article")).toHaveCount(25);
  });

  test("TC-F-29 tags are OR semantics via repeated params", async ({ page }) => {
    const want = (tags: string[]) => new Set(["n01", "n02", "n03", "n04", "n05", "n06", "n07", "n08", "n09", "n10", "n11", "n12", "n13", "n14", "n19", "n20", "n21", "n22", "n23", "n24", "n27", "n28", "n29", "n30"].filter((a) => fixture(a).tags.some((t) => tags.includes(t))));
    await go(page, "/news/archive");
    await page.getByRole("group", { name: "Tags" }).getByLabel("Security").check();
    await page.getByRole("group", { name: "Tags" }).getByLabel("Tooling").check();
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/tag=tooling&tag=security|tag=security&tag=tooling/);
    const expected = want(["security", "tooling"]);
    expect((await cardTitles(results(page))).length).toBe(Math.min(25, expected.size));
    for (const t of await cardTitles(results(page))) {
      const item = [...expected].map(fixture).find((f) => f.title === t);
      expect(item, `${t} should match security or tooling`).toBeTruthy();
    }
  });

  test("TC-F-30 combined filters apply together", async ({ page }) => {
    await go(page, "/news/archive?min=80&from=2026-09-29&to=2026-09-30");
    const expected = ["n01", "n02", "n03", "n04", "n05", "n19", "n20", "n24"];
    expect((await cardTitles(results(page))).sort()).toEqual(expected.map((a) => fixture(a).title).sort());
  });

  test("TC-F-31 the URL round-trips through reload and history", async ({ page }) => {
    await go(page, "/news/archive");
    await page.getByLabel("Minimum score", { exact: true }).selectOption("60");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await page.getByRole("group", { name: "Tags" }).getByLabel("Security").check();
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/tag=security/);
    const filtered = await cardTitles(results(page));
    await page.reload();
    await expect(page.getByLabel("Minimum score", { exact: true })).toHaveValue("60");
    await expect(page.getByRole("group", { name: "Tags" }).getByLabel("Security")).toBeChecked();
    expect(await cardTitles(results(page))).toEqual(filtered);
    await page.goBack();
    await expect(page).not.toHaveURL(/tag=/);
    await expect(page.getByLabel("Minimum score", { exact: true })).toHaveValue("60");
    await expect(page.getByRole("group", { name: "Tags" }).getByLabel("Security")).not.toBeChecked();
    await page.goForward();
    await expect(page).toHaveURL(/tag=security/);
  });

  test("TC-F-32 changing a filter returns to page 1", async ({ page }) => {
    await go(page, "/news/archive?page=2");
    await expect(results(page).getByRole("article")).toHaveCount(5);
    await page.getByLabel("Minimum score", { exact: true }).selectOption("80");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).not.toHaveURL(/page=/);
    expect(await countText(page)).toContain("9 items");
  });

  test("TC-F-33 invalid parameters degrade to defaults", async ({ page }) => {
    const logs = collectConsole(page);
    const urls = [
      "/news/archive?min=55",
      "/news/archive?min=abc",
      "/news/archive?page=0",
      "/news/archive?page=-1",
      "/news/archive?page=abc",
      "/news/archive?to=yesterday",
      "/news/archive?to=0000-01-01",
      "/news/archive?from=9999-12-31",
      "/news/archive?tag=not-a-tag",
    ];
    for (const url of urls) {
      const res = await go(page, url);
      expect(res?.status(), url).toBe(200);
      expect(await countText(page), url).toContain("30 items");
    }
    expect((await go(page, "/news/archive?from=2026-13-45"))?.status()).toBe(200);
    await expect(page.getByLabel("Minimum score", { exact: true })).toHaveValue("0");
    await expect(page.getByRole("checkbox", { name: "not-a-tag" })).toHaveCount(0);
    expect(logs()).toEqual([]);
  });

  test("TC-F-34 out-of-range page and inverted range", async ({ page }) => {
    expect((await go(page, "/news/archive?page=999"))?.status()).toBe(200);
    // M2: no filter is active, so the past-the-end state must not claim filters or offer to clear them.
    await expect(page.getByRole("region", { name: "No results on this page" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Clear filters" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Previous page" })).toHaveAttribute("href", "/news/archive?page=2");
    await expect(page.getByRole("link", { name: "Back to page 1" })).toHaveAttribute("href", "/news/archive");
    await expect(page.locator("body")).not.toContainText("page 999");
    expect((await go(page, "/news/archive?from=2026-09-30&to=2026-09-28"))?.status()).toBe(200);
    await expect(page.getByText("End date is before start date.")).toBeVisible();
    expect(await countText(page)).toContain("30 items");
  });

  test("TC-F-35 injection strings in parameters are inert", async ({ page }) => {
    const res = await go(page, 
      "/news/archive?tag=' OR 1=1--&source=%3Cscript%3Ewindow.__xss%3D5%3C%2Fscript%3E&from=2026-09-01'",
    );
    expect(res?.status()).toBe(200);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    expect(await page.locator("script", { hasText: "__xss" }).count()).toBe(0);
    expect(await countText(page)).toContain("30 items");
  });

  test("TC-F-36 unknown and empty sources show the empty state", async ({ page }) => {
    for (const query of ["source=no-such-source", "source=fx-anthropic&from=2026-09-28&to=2026-09-28"]) {
      expect((await go(page, `/news/archive?${query}`))?.status()).toBe(200);
      await expect(page.getByRole("region", { name: "No items match these filters" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Clear filters" })).toHaveCount(1);
    }
  });

  test("TC-F-38 pagination preserves filters", async ({ page }) => {
    await go(page, "/news/archive?from=2026-09-29&to=2026-09-30");
    await page.getByRole("link", { name: "Next page" }).click();
    await expect(page).toHaveURL(/from=2026-09-29/);
    await expect(page).toHaveURL(/to=2026-09-30/);
    await expect(page).toHaveURL(/page=2/);
    await expect(results(page).getByRole("article")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Previous page" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Next page" })).toHaveCount(0);
    await expect(page.getByText("2", { exact: true }).and(page.locator("[aria-current=page]"))).toBeVisible();
  });

  test("TC-F-39 clear filters resets URL and results", async ({ page }) => {
    await go(page, "/news/archive?source=fx-anthropic&from=2026-09-28&to=2026-09-28");
    await expect(page.getByRole("region", { name: "No items match these filters" })).toBeVisible();
    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(/\/news\/archive$/);
    await expect(results(page).getByRole("article")).toHaveCount(25);
    await expect(page.getByLabel("Minimum score", { exact: true })).toHaveValue("0");
  });

  test("filter chips remove one filter each and work as plain links", async ({ page }) => {
    await go(page, "/news/archive?tag=security&tag=tooling&min=60");
    await page.getByRole("link", { name: "Remove filter: Tooling" }).click();
    await expect(page).toHaveURL(/tag=security/);
    await expect(page).not.toHaveURL(/tooling/);
    await expect(page).toHaveURL(/min=60/);
  });

  test("filter submit hands focus to the results heading", async ({ page }) => {
    await go(page, "/news/archive");
    await page.getByLabel("Minimum score", { exact: true }).selectOption("60");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Results" })).toBeFocused();
  });
});

test.describe("bookmarks (N-5.1)", () => {
  test("TC-F-45 toggle persists by DB id and survives reload", async ({ page }) => {
    await go(page, "/news");
    const n01 = fixture("n01");
    const id = await itemId("n01");
    const button = page.getByRole("button", { name: `Bookmark: ${n01.title}` });
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    const stored = (await readProgress(page)) as ProgressDoc | null;
    expect(Object.keys(stored?.bookmarks.news ?? {})).toEqual([id]);
    expect(Date.parse(stored?.bookmarks.news[id] ?? "")).not.toBeNaN();
    await page.reload();
    await expect(page.getByRole("button", { name: `Bookmark: ${n01.title}` })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: `Bookmark: ${n01.title}` }).click();
    await expect(page.getByRole("button", { name: `Bookmark: ${n01.title}` })).toHaveAttribute("aria-pressed", "false");
    expect(Object.keys(((await readProgress(page)) as ProgressDoc | null)?.bookmarks.news ?? {})).toEqual([]);
  });

  test("TC-F-46 bookmarks work from the archive and from Unscored", async ({ page }) => {
    await go(page, "/news/archive?from=2026-09-28&to=2026-09-28");
    await page.getByRole("button", { name: `Bookmark: ${fixture("n27").title}` }).click();
    await go(page, "/news");
    await page.getByRole("button", { name: /^Unscored \(3\)$/ }).click();
    await page.getByRole("button", { name: `Bookmark: ${fixture("n15").title}` }).click();
    const ids = Object.keys(((await readProgress(page)) as ProgressDoc | null)?.bookmarks.news ?? {}).sort();
    expect(ids).toEqual([await itemId("n27"), await itemId("n15")].sort());
  });

  test("TC-F-47 server HTML never claims a pressed bookmark; blocked storage still works", async ({ page, request, baseURL }) => {
    const id = await itemId("n01");
    await seedProgress(page, progressDoc({ bookmarks: { lessons: {}, news: { [id]: "2026-09-29T01:00:00.000Z" } } }));
    const logs = collectConsole(page);
    const raw = await request.get("/news", { headers: { cookie: `fm_test_now=${NOW_DEFAULT}` } });
    expect(await raw.text()).not.toContain('aria-pressed="true"');
    await go(page, "/news");
    await expect(page.getByRole("button", { name: `Bookmark: ${fixture("n01").title}` })).toHaveAttribute("aria-pressed", "true");
    expect(logs()).toEqual([]);

    const blocked = await page.context().newPage();
    await blockStorage(blocked);
    await blocked.goto(`${baseURL}/news`);
    await expect(digestList(blocked).getByRole("article")).toHaveCount(10);
    const button = blocked.getByRole("button", { name: `Bookmark: ${fixture("n01").title}` });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await blocked.close();
  });
});

test.describe("accessibility and responsive (D-*)", () => {
  test("TC-F-48 axe: digest, unscored expanded, stale, archive states", async ({ page, context, baseURL }) => {
    await go(page, "/news");
    await expectNoSeriousA11y(page);
    await page.getByRole("button", { name: /^Unscored/ }).click();
    await expectNoSeriousA11y(page);
    await setServerNow(context, baseURL ?? "", "2026-10-01T09:00:00+08:00");
    await go(page, "/news");
    await expectNoSeriousA11y(page);
    await setServerNow(context, baseURL ?? "", NOW_DEFAULT);
    for (const url of ["/news/archive", "/news/archive?tag=security&min=60", "/news/archive?source=no-such-source"]) {
      await go(page, url);
      await expectNoSeriousA11y(page);
    }
  });

  test("TC-F-49 one h1 and no skipped heading levels", async ({ page }) => {
    for (const url of ["/news", "/news/archive"]) {
      await go(page, url);
      const levels = await page.getByRole("heading").evaluateAll((els) => els.map((e) => Number(e.tagName.slice(1))));
      expect(levels.filter((l) => l === 1)).toHaveLength(1);
      levels.forEach((l, i) => {
        if (i > 0) expect(l - (levels[i - 1] ?? l), url).toBeLessThanOrEqual(1);
      });
    }
    await go(page, "/news");
    await expect(page.getByRole("heading", { level: 2, name: /^Unscored/ })).toBeVisible();
  });

  // M2: one test per viewport (one test with nine serial navigations timed out under dev-server load). Each patches
  // n01's tags and always restores them, and the file runs alone (mutating project in playwright.config.ts).
  for (const [width, height] of [[360, 800], [768, 1024], [1024, 768], [1440, 900]] as const) {
    test(`TC-F-52 no horizontal scroll at ${width}, chips wrap`, async ({ page }) => {
      test.slow();
      const restore = await patchItems({ n01: { tags: ["new-model", "tooling", "framework", "security", "business"] } });
      try {
        await page.setViewportSize({ width, height });
        for (const url of ["/news", "/news/archive"]) {
          await go(page, url);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          expect(overflow, `${url} @${width}`).toBeLessThanOrEqual(0);
        }
        if (width === 360) {
          await go(page, "/news");
          const ys = await digestList(page).getByRole("article").first().getByRole("list", { name: "Tags" }).getByRole("listitem")
            .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().y)));
          expect(new Set(ys).size).toBeGreaterThan(1);
        }
      } finally {
        await restore();
      }
    });
  }
});

test("test hooks are inert without the cookies (no delay, no throw)", async ({ page, context, baseURL }) => {
  await setCookie(context, baseURL ?? "", "fm_test_throw", "someone-else");
  const res = await go(page, "/news/archive");
  expect(res?.status()).toBe(200);
});

// ---- Destructive cases: reload fixture variants. Only with FM_F_INTEGRATION=1 (see header). Same file as the
// cases above so one serial worker runs them; separate files would run in parallel workers and clobber fixtures.
function serviceDb() {
  const text = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  const get = (n: string) => text.match(new RegExp(`^${n}=(.*)$`, "m"))?.[1]?.trim() ?? "";
  return createClient(get("SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
}

test.describe("integration: fx-no-news", () => {
  test.beforeAll(() => {
    test.skip(process.env.FM_F_INTEGRATION !== "1", "set FM_F_INTEGRATION=1");
    resetDb("fx-no-news");
  });

  test("TC-F-40 no runs ever shows the empty state, and TC-F-04 a new run shows without a rebuild", async ({ page }) => {
    await go(page, "/news");
    const empty = page.getByRole("region", { name: "No news yet. Run npm run news:run." });
    await expect(empty).toBeVisible();
    await expect(empty.locator("code", { hasText: "npm run news:run" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^Unscored/ })).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("No digest yet today");

    const db = serviceDb();
    const { data: source } = await db.from("news_sources").select("id").limit(1).single();
    const run = await db.from("ingest_runs").insert({
      started_at: "2026-09-30T08:00:00+08:00",
      finished_at: "2026-09-30T08:03:00+08:00",
      trigger: "manual",
      status: "success",
    });
    expect(run.error).toBeNull();
    const item = await db.from("news_items").insert({
      source_id: source?.id,
      canonical_url: "https://fixtures.example/dynamic-probe",
      url: "https://fixtures.example/dynamic-probe",
      title: "Dynamic render probe",
      published_at: "2026-09-30T06:00:00+08:00",
      first_seen_at: "2026-09-30T08:01:00+08:00",
      digest_date: "2026-09-30",
      score: 77,
      tags: ["tooling"],
      why_it_matters: "Probe",
      scoring_status: "scored",
      attempts: 1,
    });
    expect(item.error).toBeNull();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Today's digest");
    expect(await cardTitles(page.getByRole("list", { name: "Today's digest" }))).toEqual(["Dynamic render probe"]);
    await expect(page.locator("body")).toContainText("Wed 30 Sep · updated 08:03");
  });

  test("TC-F-40b only failed runs still means no news yet", async ({ page }) => {
    const db = serviceDb();
    await db.from("news_items").delete().neq("title", "");
    await db.from("ingest_runs").delete().neq("status", "none");
    await db.from("ingest_runs").insert({
      started_at: "2026-09-30T08:00:00+08:00",
      finished_at: "2026-09-30T08:01:00+08:00",
      trigger: "schedule",
      status: "failed",
    });
    await go(page, "/news");
    await expect(page.getByRole("region", { name: "No news yet. Run npm run news:run." })).toBeVisible();
  });
});

test.describe("integration: fx-news-lowbar", () => {
  test.beforeAll(() => {
    test.skip(process.env.FM_F_INTEGRATION !== "1", "set FM_F_INTEGRATION=1");
    resetDb("fx-news-lowbar");
  });

  test("TC-F-41 nothing above the bar links to today's archive", async ({ page }) => {
    await go(page, "/news");
    await expect(page.locator("body")).toContainText("Wed 30 Sep · updated 08:03");
    await expect(page.getByRole("region", { name: "Nothing above the relevance bar today" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Today's digest" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Unscored/ })).toHaveCount(0);
    const link = page.getByRole("link", { name: "See today's items in the archive" });
    await expect(link).toHaveAttribute("href", "/news/archive?from=2026-09-30&to=2026-09-30&min=0");
    await link.click();
    await expect(page.getByRole("heading", { level: 2, name: "Results" })).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(5);
  });

  test("nothing above the bar offers Show all, which lists the sub-bar items", async ({ page }) => {
    await go(page, "/news");
    const showAll = page.getByRole("region", { name: "Nothing above the relevance bar today" }).getByRole("link", { name: "Show all (5)" });
    await expect(showAll).toHaveAttribute("href", "/news?show=all");
    await showAll.click();
    await expect(page).toHaveURL(/\/news\?show=all$/);
    await expect(page.getByRole("link", { name: "All (5)" })).toHaveAttribute("aria-current", "true");
    await expect(page.getByRole("list", { name: "Below the relevance bar" }).getByRole("article")).toHaveCount(5);
  });

  test("axe on the empty and low-bar states", async ({ page }) => {
    await go(page, "/news");
    await expectNoSeriousA11y(page);
  });
});

test.describe("integration: fx-news-archive-60", () => {
  test.beforeAll(() => {
    test.skip(process.env.FM_F_INTEGRATION !== "1", "set FM_F_INTEGRATION=1");
    resetDb("fx-news-archive-60");
  });

  test("TC-F-37 pages of 25, 25, 25, 15 with no overlap and filters kept in links", async ({ page }) => {
    const seen: string[] = [];
    const sizes: number[] = [];
    for (let n = 1; n <= 4; n++) {
      await go(page, n === 1 ? "/news/archive" : `/news/archive?page=${n}`);
      const titles = await cardTitles(page.getByRole("heading", { level: 2, name: "Results" }).locator("xpath=following::ol[1]"));
      sizes.push(titles.length);
      seen.push(...titles);
      await expect(page.getByRole("link", { name: "Next page" })).toHaveCount(n < 4 ? 1 : 0);
      await expect(page.getByRole("link", { name: "Previous page" })).toHaveCount(n > 1 ? 1 : 0);
    }
    expect(sizes).toEqual([25, 25, 25, 15]);
    expect(new Set(seen).size).toBe(90);
    await go(page, "/news/archive?from=2026-09-01");
    const href = await page.getByRole("link", { name: "Next page" }).getAttribute("href");
    expect(href).toContain("from=2026-09-01");
    expect(href).toContain("page=2");
  });
});

test.describe("integration: test hooks on fx-base", () => {
  test.beforeAll(() => {
    test.skip(process.env.FM_F_INTEGRATION !== "1", "set FM_F_INTEGRATION=1");
    resetDb("fx-base");
  });

  test("TC-F-42 loading skeleton appears while the read is delayed", async ({ page, context, baseURL }) => {
    await setCookie(context, baseURL ?? "", "fm_test_delay_ms", "1500");
    for (const [url, id] of [["/news", "news-skeleton"], ["/news/archive", "archive-skeleton"]] as const) {
      await page.goto(url, { waitUntil: "commit" });
      const skeleton = page.getByTestId(id);
      await expect(skeleton).toBeVisible();
      await expect(skeleton).toHaveAttribute("aria-busy", "true");
      expect(await skeleton.locator("[aria-hidden=true]").count()).toBeGreaterThanOrEqual(3);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId(id)).toHaveCount(0);
    }
  });

  test("TC-F-43 archive error boundary shows a safe message and Try again recovers", async ({ page, context, baseURL }) => {
    await setCookie(context, baseURL ?? "", "fm_test_throw", `news-archive:${Date.now()}`);
    await page.goto("/news/archive");
    await expect(page.getByRole("heading", { level: 1, name: "Something went wrong" })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "This page" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to curriculum" })).toBeVisible();
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/\bat \w|\.tsx?\b|Injected test failure|digest/i);
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("article")).toHaveCount(25);
  });
});

test.afterAll(() => {
  if (process.env.FM_F_INTEGRATION === "1") resetDb("fx-base");
});
