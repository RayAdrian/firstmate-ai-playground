import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  NOW,
  doc,
  oneComplete,
  orphans,
  readProgress,
  seedProgress,
  waitLessonHydrated,
  waitProgressHydrated,
} from "./support";
import { collectConsole, setServerNow } from "../../support";

const L1 = "/lessons/l1-first-session";
const L2 = "/lessons/l2-context-files";

test.beforeEach(async ({ context, baseURL }) => {
  await setServerNow(context, baseURL!, NOW);
});

const panel = (page: Page) => page.getByRole("region", { name: /^Exercise/ });

test.describe("exercise panel (E-1 to E-3)", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("TC-C-54 automated exercise shows every field and copyable commands", async ({ page }) => {
    await page.goto(L1);
    await waitLessonHydrated(page);
    const p = panel(page);
    await expect(p.getByRole("heading", { level: 3 })).toBeVisible();
    await expect(p).toContainText("Goal:");
    await expect(p).toContainText("exercises/ex-fx-auto/starter");
    await p.getByRole("button", { name: "Copy code: Setup" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "cp -r exercises/ex-fx-auto/starter ~/fm-ex/ex-fx-auto && cd ~/fm-ex/ex-fx-auto && npm i",
    );
    await p.getByRole("button", { name: "Copy code: Verify" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("npm test");
    await expect(p.getByRole("checkbox")).toHaveCount(3);
  });

  test("TC-C-55 manual exercise shows 'Manual verification' and no verify copy button", async ({ page }) => {
    await page.goto(L2);
    const p = panel(page);
    await expect(p.getByText("Manual verification")).toBeVisible();
    await expect(p.getByRole("button", { name: "Copy code: Verify" })).toHaveCount(0);
    await expect(p.getByRole("button", { name: "Copy code: Setup" })).toBeVisible();
    await expect(p).not.toContainText("null");
  });

  test("TC-C-56 starter prompts follow the tool tabs both ways", async ({ page }) => {
    await seedProgress(page, doc());
    await page.goto(L1);
    await waitLessonHydrated(page);
    const p = panel(page);
    const promptTabs = p.getByRole("tablist", { name: "Starting prompt" });
    await expect(p.getByRole("tabpanel", { name: "Claude Code" })).toContainText("Claude prompt fx");
    await page.getByRole("tablist", { name: "Tool" }).getByRole("tab", { name: "Codex CLI" }).click();
    await expect(p.getByRole("tabpanel", { name: "Codex CLI" })).toContainText("Codex prompt fx");
    await promptTabs.getByRole("tab", { name: "Claude Code" }).click();
    await expect(page.getByRole("tablist", { name: "Tool" }).getByRole("tab", { name: "Claude Code" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect((await readProgress(page))?.prefs.tool).toBe("claude");
    await expect(page).toHaveURL(/\?tool=claude/);
    const ids = await page.evaluate(() => Array.from(document.querySelectorAll("[id]")).map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("TC-C-57 checkboxes are native, labelled, keyboard operable and persist", async ({ page }) => {
    await seedProgress(page, doc());
    await page.goto(L1);
    await waitLessonHydrated(page);
    const p = panel(page);
    const first = p.getByRole("checkbox", { name: "Test is green" });
    expect(await first.evaluate((el) => el.tagName)).toBe("INPUT");
    await p.getByText("Test is green").click();
    await p.getByRole("checkbox", { name: "No test files edited" }).focus();
    await page.keyboard.press("Space");
    const stored = await readProgress(page);
    expect(stored?.checklists["ex-fx-auto"]).toMatchObject({ c1: true, c2: true });
    expect(stored?.checklists["ex-fx-auto"].c3 ?? false).toBe(false);
    await page.reload();
    await waitLessonHydrated(page);
    await expect(first).toBeChecked();
    await expect(p.getByRole("checkbox", { name: "No test files edited" })).toBeChecked();
    await expect(p.getByRole("checkbox", { name: "Diff reviewed" })).not.toBeChecked();
  });

  test("TC-C-59 unknown item ids are ignored in display and count", async ({ page }) => {
    const problems = collectConsole(page);
    await seedProgress(page, orphans);
    await page.goto(L1);
    await waitLessonHydrated(page);
    const p = panel(page);
    await expect(p.getByRole("checkbox")).toHaveCount(3);
    await expect(p.getByRole("group", { name: "Checklist" })).toContainText("1 of 3 done");
    await p.getByText("No test files edited").click();
    await p.getByText("Diff reviewed").click();
    await expect(p.getByText("Exercise complete")).toBeVisible();
    expect(problems()).toEqual([]);
  });

  test("TC-C-60 finishing the checklist does not complete the lesson", async ({ page }) => {
    await seedProgress(page, doc());
    await page.goto(L2);
    await waitLessonHydrated(page);
    const p = panel(page);
    await p.getByText("CLAUDE.md written").click();
    await p.getByText("AGENTS.md mirrors it").click();
    await expect(p.getByText("Exercise complete")).toBeVisible();
    await expect(page.locator("#fm-live")).toHaveText("Exercise complete");
    expect((await readProgress(page))?.lessons["l2-context-files"]).toBeUndefined();
    await expect(page.getByRole("button", { name: "Mark complete" })).toBeVisible();
    await p.getByText("AGENTS.md mirrors it").click();
    await expect(p.getByText("Exercise complete")).toHaveCount(0);
  });

  test("TC-C-61/62 reference solution: collapsed, keyboard-operable, exact diff command, 3 and 2 notes", async ({ page }) => {
    await page.goto(L1);
    await waitLessonHydrated(page);
    const button = page.getByRole("button", { name: "Compare with reference solution" });
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText("exercises/ex-fx-auto/solution", { exact: true })).toBeHidden();
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("exercises/ex-fx-auto/solution", { exact: true })).toBeVisible();
    const region = page.locator(`[id="${await button.getAttribute("aria-controls")}"]`);
    await expect(region.getByRole("listitem")).toHaveText(["Fixes the root cause.", "Leaves tests untouched.", "Small diff."]);
    await region.getByRole("button", { name: "Copy code: Terminal" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "git diff --no-index exercises/ex-fx-auto/starter exercises/ex-fx-auto/solution",
    );
    await button.focus();
    await page.keyboard.press("Space");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await page.goto(L2);
    await page.getByRole("button", { name: "Compare with reference solution" }).click();
    await expect(page.getByText("Keeps both files in sync.")).toBeVisible();
    await expect(page.getByText("Stays under 100 lines.")).toBeVisible();
  });
});

test.describe("/exercises (E-5)", () => {
  test("TC-C-63 lists exercises with level, lesson link, verify type and progress", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedProgress(page, doc({ checklists: { "ex-fx-auto": { c1: true, c2: true } } }));
    await page.goto("/exercises");
    await waitProgressHydrated(page);
    const table = page.getByRole("table", { name: "Exercises" });
    await expect(table.getByRole("columnheader")).toHaveText(["Level", "Exercise", "Lesson", "Verify", "Progress"]);
    const rows = table.locator("tbody tr");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("L1");
    await expect(rows.nth(0).getByRole("link")).toHaveAttribute("href", "/lessons/l1-first-session#exercise");
    await expect(rows.nth(0)).toContainText("Auto");
    await expect(rows.nth(0)).toContainText("2 / 3");
    await expect(rows.nth(1)).toContainText("L2");
    await expect(rows.nth(1)).toContainText("Manual");
    await expect(rows.nth(1).getByText("No progress yet")).toBeAttached();
  });

  test("cards replace the table below lg", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/exercises");
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByRole("article")).toHaveCount(2);
  });
});

test.describe("accessibility (D-2)", () => {
  async function serious(page: Page) {
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    return results.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
  }

  test("TC-C-71 no serious axe violations on the curriculum and exercises pages", async ({ page }) => {
    await seedProgress(page, oneComplete);
    for (const path of ["/curriculum", "/exercises"]) {
      await page.goto(path);
      await waitProgressHydrated(page);
      expect(await serious(page), path).toEqual([]);
    }
  });

  test("TC-C-71 no serious axe violations on lessons in both tab states and with the disclosure open", async ({ page }) => {
    await seedProgress(page, oneComplete);
    for (const slug of ["l1-first-session", "l1-permissions"]) {
      for (const tool of ["claude", "codex"]) {
        await page.goto(`/lessons/${slug}?tool=${tool}`);
        await waitLessonHydrated(page);
        expect(await serious(page), `${slug} ${tool}`).toEqual([]);
      }
    }
    await page.goto("/lessons/l1-first-session");
    await waitLessonHydrated(page);
    await page.getByRole("button", { name: "Compare with reference solution" }).click();
    expect(await serious(page), "disclosure open").toEqual([]);
  });
});
