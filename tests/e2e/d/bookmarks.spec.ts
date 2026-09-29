import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  D,
  blockStorage,
  collectConsole,
  createDbRows,
  deleteDbRows,
  doc,
  readProgress,
  seedProgress,
} from "./helpers";

// These tests need known lessons and news rows, so they share DB rows created once (serial => one worker).
test.describe.configure({ mode: "serial" });

let created: Awaited<ReturnType<typeof createDbRows>>;
test.beforeAll(async () => {
  created = await createDbRows();
});
test.afterAll(async () => {
  await deleteDbRows(created);
});

const bookmarked = doc({
  bookmarks: {
    lessons: {
      [D.lessonA]: "2026-09-29T01:00:00.000Z",
      [D.lessonB]: "2026-09-30T02:00:00.000Z",
      [D.lessonArchived]: "2026-09-30T03:00:00.000Z",
      "deleted-lesson-slug": "2026-09-30T04:00:00.000Z",
    },
    news: {
      [D.newsA]: "2026-09-30T01:00:00.000Z",
      [D.newsB]: "2026-09-28T01:00:00.000Z",
    },
  },
});

test("server HTML shows the skeleton, never the empty state (TC-D-47, P-5)", async ({ request }) => {
  const html = await (await request.get("/bookmarks")).text();
  expect(html).toContain('data-testid="bookmarks-skeleton"');
  expect(html).toContain('aria-busy="true"');
  expect(html).not.toContain("Nothing bookmarked yet");
  expect(html).not.toContain("Item no longer available");
});

test("empty state after hydration (TC-D-47)", async ({ page }) => {
  await page.goto("/bookmarks");
  await expect(page.getByText("Nothing bookmarked yet")).toBeVisible();
  await expect(page.getByText("Bookmarks stay in this browser.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse curriculum" })).toHaveAttribute("href", "/curriculum");
  await expect(page.getByRole("link", { name: "Today's digest" })).toHaveAttribute("href", "/news");
  await expect(page.getByTestId("bookmarks-skeleton")).toHaveCount(0);
});

test("lists lessons and news newest first, hides archived and deleted lessons (TC-D-48, P-4)", async ({
  page,
}) => {
  const con = collectConsole(page);
  await seedProgress(page, bookmarked);
  await page.goto("/bookmarks");
  const lessons = page.getByRole("region", { name: /^Lessons \(\d+\)$/ });
  const news = page.getByRole("region", { name: /^News \(\d+\)$/ });
  await expect(lessons.getByRole("heading", { name: "Lessons (2)" })).toBeVisible();
  const lessonLinks = lessons.getByRole("link");
  await expect(lessonLinks).toHaveText([D.titleB, D.titleA]);
  await expect(lessonLinks.first()).toHaveAttribute("href", `/lessons/${D.lessonB}`);
  await expect(news.getByRole("heading", { name: "News (2)" })).toBeVisible();
  const newsLinks = news.getByRole("link");
  await expect(newsLinks).toHaveText([`${D.newsTitleA} (opens in new tab)`, `${D.newsTitleB} (opens in new tab)`]);
  await expect(newsLinks.first()).toHaveAttribute("href", "https://example.com/d-test/a");
  await expect(newsLinks.first()).toHaveAttribute("rel", /noopener/);
  await expect(page.getByText("deleted-lesson-slug")).toHaveCount(0);
  await expect(page.getByText("D-TEST retired")).toHaveCount(0);
  await expect(lessons.getByRole("button", { name: `Bookmark: ${D.titleA}` })).toHaveAttribute("aria-pressed", "true");
  await page.waitForLoadState("networkidle");
  expect(con.errors).toEqual([]);
  expect(con.hydration).toEqual([]);
  // Hidden bookmarks stay in storage.
  const stored = await readProgress(page);
  expect(Object.keys(stored?.bookmarks.lessons ?? {})).toHaveLength(4);
});

test("a news bookmark whose item is gone shows 'Item no longer available' and can be removed (TC-D-49)", async ({
  page,
}) => {
  const con = collectConsole(page);
  await seedProgress(
    page,
    doc({
      bookmarks: {
        lessons: {},
        news: { [D.newsA]: "2026-09-30T01:00:00.000Z", [D.newsGone]: "2026-09-30T02:00:00.000Z" },
      },
    }),
  );
  await page.goto("/bookmarks");
  await expect(page.getByText("Item no longer available")).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(D.newsTitleA) })).toBeVisible();
  await page.getByRole("button", { name: "Remove bookmark" }).click();
  await expect.poll(async () => Object.keys((await readProgress(page))?.bookmarks.news ?? {})).toEqual([D.newsA]);
  expect(con.errors).toEqual([]);
});

test("a non-UUID news id is unavailable, not an error (TC-D-49)", async ({ page }) => {
  const con = collectConsole(page);
  await seedProgress(page, doc({ bookmarks: { lessons: {}, news: { n01: "2026-09-30T01:00:00.000Z" } } }));
  await page.goto("/bookmarks");
  await expect(page.getByText("Item no longer available")).toBeVisible();
  expect(con.errors).toEqual([]);
});

test("removing announces, offers Undo, and Undo restores the original position", async ({ page }) => {
  await seedProgress(page, bookmarked);
  await page.goto("/bookmarks");
  const lessons = page.getByRole("region", { name: /^Lessons \(\d+\)$/ });
  await lessons.getByRole("button", { name: `Bookmark: ${D.titleB}` }).click();
  await expect(page.locator("#fm-live")).toHaveText("Removed from bookmarks");
  const undo = lessons.getByRole("button", { name: "Undo" });
  await expect(undo).toBeVisible();
  await expect(undo).toBeFocused();
  expect(Object.keys((await readProgress(page))?.bookmarks.lessons ?? {})).not.toContain(D.lessonB);
  await undo.click();
  await expect(lessons.getByRole("link")).toHaveText([D.titleB, D.titleA]);
  const stored = await readProgress(page);
  expect(stored?.bookmarks.lessons[D.lessonB]).toBe("2026-09-30T02:00:00.000Z");
  await expect(lessons.getByRole("button", { name: `Bookmark: ${D.titleB}` })).toBeFocused();
});

test("removing the last bookmarks leads to the empty state after Undo expires", async ({ page }) => {
  await seedProgress(page, doc({ bookmarks: { lessons: { [D.lessonA]: "2026-09-29T01:00:00.000Z" }, news: {} } }));
  await page.goto("/bookmarks");
  await page.getByRole("button", { name: `Bookmark: ${D.titleA}` }).click();
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
  await expect(page.getByText("Nothing bookmarked yet")).toBeVisible({ timeout: 12_000 });
});

test("storage blocked: banner plus the normal empty state (TC-D-20)", async ({ page }) => {
  const con = collectConsole(page);
  await blockStorage(page);
  await page.goto("/bookmarks");
  await expect(
    page.getByRole("status").filter({ hasText: "Progress can't be saved in this browser" }),
  ).toBeVisible();
  await expect(page.getByText("Nothing bookmarked yet")).toBeVisible();
  expect(con.errors).toEqual([]);
});

test("cross-tab: removing in one tab updates the other (TC-D-34)", async ({ context }) => {
  const a = await context.newPage();
  await seedProgress(a, bookmarked);
  await a.goto("/bookmarks");
  const b = await context.newPage();
  await b.goto("/bookmarks");
  await expect(b.getByRole("heading", { name: "Lessons (2)" })).toBeVisible();
  await a.getByRole("button", { name: `Bookmark: ${D.titleA}` }).click();
  await expect(b.getByRole("heading", { name: "Lessons (1)" })).toBeVisible({ timeout: 2000 });
});

test("no serious axe violations", async ({ page }) => {
  await seedProgress(page, bookmarked);
  await page.goto("/bookmarks");
  await expect(page.getByRole("heading", { name: "Lessons (2)" })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(D.newsTitleA) })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
});
