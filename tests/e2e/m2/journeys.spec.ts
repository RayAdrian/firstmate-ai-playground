import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { NEWS_ITEMS } from "../../fixtures/news";
import { collectConsole, setServerNow } from "../../support";
import { NOW, TITLE, doc, oneComplete, readProgress, seedProgress, waitHydrated } from "./support";

test.beforeEach(async ({ context, baseURL }) => {
  await setServerNow(context, baseURL!, NOW);
});

const news = (alias: string) => NEWS_ITEMS.find((i) => i.alias === alias)!;
const mainNav = (page: Page) => page.getByRole("navigation", { name: "Main" });
const lessonNav = (page: Page) => page.getByRole("navigation", { name: "Lesson" });
const toolTabs = (page: Page) => page.getByRole("tablist", { name: "Tool" });
const markComplete = (page: Page) => page.getByRole("button", { name: "Mark complete" });

async function lessonReady(page: Page) {
  // The Bookmark toggle is disabled until the progress store has hydrated, and exists on every lesson.
  await page.getByRole("button", { name: "Bookmark", exact: true }).and(page.locator(":enabled")).waitFor();
}

test.describe("Cross-feature journeys", () => {
  test("TC-M2-13 AC: L-5.1 mark complete, then the curriculum reflects it without a reload", async ({ page }) => {
    await seedProgress(page, doc());
    await page.goto("/curriculum");
    await waitHydrated(page);
    await page.evaluate(() => ((window as unknown as { __noReload: number }).__noReload = 1));
    await page.getByRole("link", { name: TITLE.firstSession }).click();
    await lessonReady(page);
    await markComplete(page).click();
    await expect(page.getByText("Completed ✓ · Undo")).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
    await expect(page.locator("#fm-live")).toHaveText("Lesson marked complete");
    await mainNav(page).getByRole("link", { name: "Curriculum" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Curriculum" })).toBeVisible();
    const row = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: TITLE.firstSession }) });
    await expect(row.getByText("Completed")).toBeVisible();
    await expect(page.getByRole("region", { name: /^Level 1/ })).toContainText("1 / 2");
    await expect(page.getByRole("progressbar", { name: "Level 1" })).toHaveAttribute("aria-valuenow", "50");
    expect(await page.evaluate(() => (window as unknown as { __noReload?: number }).__noReload)).toBe(1);
  });

  test("TC-M2-14 AC: E-2.3 finishing the checklist does not complete the lesson", async ({ page }) => {
    await seedProgress(page, doc());
    await page.goto("/lessons/l1-first-session");
    await lessonReady(page);
    const group = page.getByRole("group", { name: "Checklist" });
    for (const label of ["Test is green", "No test files edited", "Diff reviewed"]) {
      await group.getByText(label).click();
    }
    await expect(page.getByRole("main").getByText("Exercise complete")).toBeVisible();
    await expect(page.locator("#fm-live")).toHaveText("Exercise complete");
    await expect(markComplete(page)).toBeVisible();

    await mainNav(page).getByRole("link", { name: "Curriculum" }).click();
    await expect(page.getByRole("region", { name: /^Level 1/ })).toContainText("0 / 2");
    await expect(page.getByText("Completed", { exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: "First Mate AI Playground" }).click();
    await waitHydrated(page);
    await expect(page.getByRole("progressbar", { name: "Level 1" })).toHaveAttribute("aria-valuenow", "0");

    const stored = await readProgress(page);
    expect(stored?.lessons["l1-first-session"]).toBeUndefined();
    expect(stored?.checklists["ex-fx-auto"]).toEqual({ c1: true, c2: true, c3: true });
  });

  test("TC-M2-15 AC: L-8.1 bookmark a lesson and a news item, then view them on /bookmarks", async ({ page }) => {
    await seedProgress(page, doc());
    await page.goto("/lessons/l2-context-files");
    await lessonReady(page);
    const lessonButton = page.getByRole("button", { name: "Bookmark", exact: true });
    await lessonButton.click();
    await expect(lessonButton).toHaveAttribute("aria-pressed", "true");

    await page.goto("/news");
    await waitHydrated(page);
    const newsButton = page.getByRole("button", { name: `Bookmark: ${news("n02").title}` });
    await newsButton.and(page.locator(":not([aria-disabled=true])")).click();
    await expect(newsButton).toHaveAttribute("aria-pressed", "true");

    await mainNav(page).getByRole("link", { name: "Bookmarks" }).click();
    await waitHydrated(page);
    const lessons = page.getByRole("region", { name: "Lessons (1)" });
    await expect(lessons.getByRole("link", { name: TITLE.contextFiles })).toHaveAttribute(
      "href",
      "/lessons/l2-context-files",
    );
    const newsRegion = page.getByRole("region", { name: "News (1)" });
    await expect(newsRegion.getByRole("article")).toHaveCount(1);
    await expect(newsRegion.getByRole("link", { name: `${news("n02").title} (opens in new tab)` })).toBeVisible();

    const stored = await readProgress(page);
    expect(Object.keys(stored?.bookmarks.lessons ?? {})).toEqual(["l2-context-files"]);
    expect(Object.keys(stored?.bookmarks.news ?? {})).toHaveLength(1);
    expect(Number.isNaN(Date.parse(stored?.bookmarks.lessons["l2-context-files"] ?? ""))).toBe(false);
  });

  test("TC-M2-17 AC: P-6.1 export, reset and import round trip", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.clock.setFixedTime(new Date("2026-09-30T13:00:00+08:00"));
    await seedProgress(
      page,
      doc({
        ...oneComplete,
        checklists: { "ex-fx-auto": { c1: true } },
        bookmarks: { lessons: { "l2-context-files": "2026-09-29T03:00:00.000Z" }, news: {} },
        prefs: { tool: "codex" },
      }),
    );
    await page.goto("/progress");
    await waitHydrated(page);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export progress" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("fm-playground-progress-2026-09-30.json");
    const file = await download.path();
    const exported = readFileSync(file, "utf8");
    await expect(page.locator("#fm-live")).toHaveText("Progress exported and copied");
    expect(JSON.parse(await page.evaluate(() => navigator.clipboard.readText()))).toEqual(JSON.parse(exported));

    await page.getByRole("textbox", { name: "Type reset to confirm" }).fill("reset");
    await page.getByRole("button", { name: "Reset all progress" }).click();
    await expect(page.getByRole("status").filter({ hasText: "All progress has been reset." })).toBeVisible();
    await mainNav(page).getByRole("link", { name: "Curriculum" }).click();
    await expect(page.getByRole("region", { name: /^Level 1/ })).toContainText("0 / 2");

    await mainNav(page).getByRole("link", { name: "Progress" }).click();
    await page.getByLabel("Import progress file").setInputFiles(file);
    const preview = page
      .getByRole("status")
      .filter({ hasText: "Importing replaces everything saved in this browser." });
    await expect(preview).toContainText(/1 lessons?/);
    await expect(preview).toContainText(/1 bookmarks?/);
    await page.getByRole("button", { name: "Replace my progress" }).click();
    await expect(page.getByRole("status").filter({ hasText: /^Progress imported:/ })).toBeVisible();

    await mainNav(page).getByRole("link", { name: "Curriculum" }).click();
    await expect(page.getByRole("region", { name: /^Level 1/ })).toContainText("1 / 2");
    await page.goto("/lessons/l1-first-session");
    await lessonReady(page);
    await expect(page.getByText("Completed ✓ · Undo")).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Test is green" })).toBeChecked();
    await expect(toolTabs(page).getByRole("tab", { name: "Codex CLI" })).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(/\?tool=codex/);
    await page.goto("/bookmarks");
    await waitHydrated(page);
    await expect(page.getByRole("region", { name: "Lessons (1)" })).toContainText(TITLE.contextFiles);
    // Viewing the lesson after the import records lastViewed; everything else round-trips exactly.
    expect({ ...(await readProgress(page)), lastViewed: null }).toEqual({ ...JSON.parse(exported), lastViewed: null });
  });

  test("TC-M2-18 AC: L-2.3 tool preference across lesson navigation", async ({ page }) => {
    await seedProgress(page, doc());
    await page.goto("/lessons/l1-first-session?tool=codex");
    await lessonReady(page);
    await expect(toolTabs(page).getByRole("tab", { name: "Codex CLI" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tablist", { name: "Starting prompt" }).getByRole("tab", { name: "Codex CLI" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // A URL alone never writes the preference.
    expect((await readProgress(page))?.prefs.tool ?? "claude").toBe("claude");

    await lessonNav(page).getByRole("link", { name: /^Next: / }).click();
    await expect(page).toHaveURL(/\/lessons\/l1-permissions$/);
    await lessonReady(page);
    await expect(toolTabs(page).getByRole("tab", { name: "Claude Code" })).toHaveAttribute("aria-selected", "true");

    await page.goto("/lessons/l2-context-files");
    await lessonReady(page);
    await toolTabs(page).getByRole("tab", { name: "Codex CLI" }).click();
    await expect.poll(async () => (await readProgress(page))?.prefs.tool).toBe("codex");
    const historyBefore = await page.evaluate(() => history.length);
    await lessonNav(page).getByRole("link", { name: /^Next: / }).click();
    await expect(page).toHaveURL(/\/lessons\/l2-memory/);
    await expect(toolTabs(page).getByRole("tab", { name: "Codex CLI" })).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(/\?tool=codex/);
    expect(await page.evaluate(() => history.length)).toBe(historyBefore + 1);
  });

  test("TC-M2-20 AC: C-3.1 internal lesson links stay in the tab and Back keeps the tool", async ({ page }) => {
    await seedProgress(page, doc());
    await page.goto("/lessons/l1-first-session?tool=codex");
    await lessonReady(page);
    const internal = page.locator('article a[href="/lessons/l1-permissions"]').first();
    await expect(internal).not.toHaveAttribute("target", /.+/);
    await expect(internal).not.toContainText("opens in new tab");
    await internal.click();
    await expect(page).toHaveURL(/\/lessons\/l1-permissions/);
    await page.goBack();
    await expect(page).toHaveURL(/\/lessons\/l1-first-session\?tool=codex$/);
    await expect(toolTabs(page).getByRole("tab", { name: "Codex CLI" })).toHaveAttribute("aria-selected", "true");
  });

  test("TC-M2-19 AC: D-2.2 keyboard-only journey", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await seedProgress(page, doc());
    await page.goto("/curriculum");
    await waitHydrated(page);

    const focusRing = () =>
      page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return "body";
        const s = getComputedStyle(el);
        return s.outlineStyle !== "none" || s.boxShadow !== "none" ? "ok" : `no-indicator:${el.tagName}`;
      });
    const checkFocus = async () => expect(await focusRing()).toBe("ok");

    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await checkFocus();
    await page.keyboard.press("Enter");
    await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe("main");

    const firstLesson = page.getByRole("link", { name: TITLE.firstSession });
    for (let i = 0; i < 30 && !(await firstLesson.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press("Tab");
    }
    await expect(firstLesson).toBeFocused();
    await checkFocus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/lessons\/l1-first-session/);
    await lessonReady(page);

    const selected = toolTabs(page).getByRole("tab", { selected: true });
    for (let i = 0; i < 40 && !(await selected.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press("Tab");
    }
    await expect(selected).toBeFocused();
    await checkFocus();
    await page.keyboard.press("ArrowRight");
    const codex = toolTabs(page).getByRole("tab", { name: "Codex CLI" });
    await expect(codex).toBeFocused();
    await expect(codex).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(/\?tool=codex/);

    const copy = page.getByRole("button", { name: "Copy code: bash" });
    for (let i = 0; i < 40 && !(await copy.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press("Tab");
    }
    await expect(copy).toBeFocused();
    await checkFocus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#fm-live")).toContainText("Copied");

    for (let i = 0; i < 40 && !(await markComplete(page).evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press("Tab");
    }
    await expect(markComplete(page)).toBeFocused();
    await checkFocus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Completed ✓ · Undo")).toBeVisible();
    await expect(page.locator("#fm-live")).toHaveText("Lesson marked complete");
    await expect(page.getByRole("button", { name: "Undo" })).toBeFocused();

    const next = lessonNav(page).getByRole("link", { name: /^Next: / });
    for (let i = 0; i < 40 && !(await next.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press("Tab");
    }
    await expect(next).toBeFocused();
    await checkFocus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/lessons\/l1-permissions/);
  });
});

test.describe("Full journey", () => {
  test("home to curriculum to lesson, switch tool, checklist, complete, Continue updates, bookmark, /bookmarks, /progress export", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const problems = collectConsole(page);
    await page.clock.setFixedTime(new Date("2026-09-30T13:00:00+08:00"));
    await page.goto("/");
    await waitHydrated(page);

    // Fresh browser: Continue is the first L1 lesson, and nothing is complete.
    const cont = page.getByRole("link", { name: /^Continue: .+/ });
    await expect(cont).toHaveAccessibleName(`Continue: ${TITLE.firstSession}`);
    await expect(page.getByRole("progressbar", { name: "Level 1" })).toHaveAttribute("aria-valuenow", "0");
    await expect(page.getByRole("list", { name: "Today's digest" }).getByRole("listitem")).toHaveCount(3);

    // Home to curriculum (View full curriculum), then into a lesson.
    await page.getByRole("link", { name: "View full curriculum" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Curriculum" })).toBeVisible();
    await page.getByRole("link", { name: TITLE.permissions }).click();
    await expect(page.getByRole("heading", { level: 1, name: TITLE.permissions })).toBeVisible();
    await lessonReady(page);

    // Switch tool: URL and preference follow.
    await toolTabs(page).getByRole("tab", { name: "Codex CLI" }).click();
    await expect(page).toHaveURL(/\?tool=codex/);
    await expect.poll(async () => (await readProgress(page))?.prefs.tool).toBe("codex");

    // Complete the lesson, then bookmark it.
    await markComplete(page).click();
    await expect(page.getByText("Completed ✓ · Undo")).toBeVisible();
    const bookmark = page.getByRole("button", { name: "Bookmark", exact: true });
    await bookmark.click();
    await expect(bookmark).toHaveAttribute("aria-pressed", "true");

    // The exercise checklist of the first lesson is independent of completion.
    await page.goto("/lessons/l1-first-session");
    await lessonReady(page);
    await page.getByRole("group", { name: "Checklist" }).getByText("Test is green").click();
    await expect(page.getByRole("group", { name: "Checklist" })).toContainText("1 of 3 done");

    // Home: Continue now points at the most recently viewed lesson, and Level 1 shows the completion.
    await page.getByRole("link", { name: "First Mate AI Playground" }).click();
    await waitHydrated(page);
    await expect(cont).toHaveAccessibleName(`Continue: ${TITLE.firstSession}`);
    await expect(page.getByRole("progressbar", { name: "Level 1" })).toHaveAttribute("aria-valuenow", "50");
    // View the permissions lesson last so it is the resume point.
    await page.goto("/lessons/l1-permissions");
    await lessonReady(page);
    await expect.poll(async () => (await readProgress(page))?.lastViewed?.slug).toBe("l1-permissions");
    await page.getByRole("link", { name: "First Mate AI Playground" }).click();
    await waitHydrated(page);
    // l1-permissions is complete, so Continue moves on to the next incomplete lesson in curriculum order.
    await expect(cont).toHaveAccessibleName(`Continue: ${TITLE.contextFiles}`);
    await expect(cont).toHaveAttribute("href", "/lessons/l2-context-files");

    // Bookmarks page lists the lesson.
    await mainNav(page).getByRole("link", { name: "Bookmarks" }).click();
    await waitHydrated(page);
    await expect(page.getByRole("region", { name: "Lessons (1)" }).getByRole("link", { name: TITLE.permissions })).toBeVisible();

    // Progress export contains all of it.
    await mainNav(page).getByRole("link", { name: "Progress" }).click();
    await waitHydrated(page);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export progress" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("fm-playground-progress-2026-09-30.json");
    const exported = JSON.parse(readFileSync(await download.path(), "utf8")) as ReturnType<typeof doc>;
    expect(Object.keys(exported.lessons)).toEqual(["l1-permissions"]);
    expect(Object.keys(exported.bookmarks.lessons)).toEqual(["l1-permissions"]);
    expect(exported.checklists["ex-fx-auto"]).toEqual({ c1: true });
    expect(exported.prefs.tool).toBe("codex");
    expect(exported.lastViewed?.slug).toBe("l1-permissions");
    expect(problems()).toEqual([]);
  });
});
