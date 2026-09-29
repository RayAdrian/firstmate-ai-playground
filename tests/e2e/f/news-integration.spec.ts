import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expectNoSeriousA11y, setServerNow } from "../../support";
import { cardTitles, go, resetDb, setCookie } from "./helpers";

// Wipes and reloads the shared DB with fixture variants, so it only runs when FM_F_INTEGRATION=1, alone,
// under the db lock (same convention as tests/e2e/b). It restores fx-base afterwards.
//   db-lock.sh env FM_F_INTEGRATION=1 PLAYWRIGHT_PORT=<port> npx playwright test tests/e2e/f/news-integration
test.skip(process.env.FM_F_INTEGRATION !== "1", "set FM_F_INTEGRATION=1 (destructive: reloads fixture variants)");
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ context, baseURL }) => {
  await setServerNow(context, baseURL ?? "", "2026-09-30T13:00:00+08:00");
});
test.afterAll(() => {
  if (process.env.FM_F_INTEGRATION === "1") resetDb("fx-base");
});

function serviceDb() {
  const text = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  const get = (n: string) => text.match(new RegExp(`^${n}=(.*)$`, "m"))?.[1]?.trim() ?? "";
  return createClient(get("SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
}

test.describe("fx-no-news", () => {
  test.beforeAll(() => resetDb("fx-no-news"));

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

test.describe("fx-news-lowbar", () => {
  test.beforeAll(() => resetDb("fx-news-lowbar"));

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

  test("axe on the empty and low-bar states", async ({ page }) => {
    await go(page, "/news");
    await expectNoSeriousA11y(page);
  });
});

test.describe("fx-news-archive-60", () => {
  test.beforeAll(() => resetDb("fx-news-archive-60"));

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

test.describe("test hooks on fx-base", () => {
  test.beforeAll(() => resetDb("fx-base"));

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

  test("TC-F-43 archive error boundary shows a safe message and Retry recovers", async ({ page, context, baseURL }) => {
    await setCookie(context, baseURL ?? "", "fm_test_throw", `news-archive:${Date.now()}`);
    await page.goto("/news/archive");
    const alert = page.getByRole("alert").filter({ hasText: "This page couldn't load." });
    await expect(alert).toBeVisible();
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/\bat \w|\.tsx?\b|Injected test failure|digest/i);
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("article")).toHaveCount(25);
  });
});
