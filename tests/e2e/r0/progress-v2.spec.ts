import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { PROGRESS_STORAGE_KEY } from "../../../src/lib/contracts/progress";
import { collectConsole, progressDoc, seedProgress } from "../../support";

const KEY = PROGRESS_STORAGE_KEY;
const NEWER_NOTICE =
  "This browser has progress from a newer version of the Playground. It's shown read-only here. Reload to get the latest version.";
const L1 = "/lessons/l1-first-session";
const MINE = "11111111-2222-4333-8444-555555555555";
const OTHER = "99999999-9999-4999-8999-999999999999";

const readRaw = (page: Page) => page.evaluate((key) => window.localStorage.getItem(key), KEY);

const V3_EXTRA = JSON.stringify({ ...progressDoc(), version: 3, futureField: { shape: "unknown" } });
const V99_JUNK = JSON.stringify({ version: 99, lessons: "nope", bookmarks: 7 });

test.describe("R-H: a newer doc is read-only and byte-identical", () => {
  for (const [name, raw] of [
    ["v3 with an unknown extra field", V3_EXTRA],
    ["v99 whose known fields are invalid", V99_JUNK],
  ] as const) {
    test(`loading routes and toggling leaves the stored string byte-identical: ${name}`, async ({ page }) => {
      const problems = collectConsole(page);
      await seedProgress(page, raw);
      for (const route of ["/", "/curriculum", "/progress", "/bookmarks", L1]) {
        await page.goto(route);
        await expect(page.getByText(NEWER_NOTICE)).toBeVisible();
        expect(await readRaw(page)).toBe(raw);
      }
      await page.goto(L1);
      await page.getByRole("button", { name: "Mark complete" }).click();
      await expect(page.getByText("Completed ✓ · Undo")).toBeVisible();
      await page.getByRole("region", { name: /^Exercise/ }).getByRole("checkbox").first().click();
      await page.getByRole("button", { name: /^Bookmark/ }).first().click();
      expect(await readRaw(page)).toBe(raw);
      expect(problems()).toEqual([]);
    });
  }

  test("a storage event delivering a newer doc to an open tab leaves it byte-identical", async ({ context }) => {
    const a = await context.newPage();
    const b = await context.newPage();
    const problems = collectConsole(a);
    await a.goto(L1);
    await expect(a.getByRole("button", { name: "Mark complete" })).toBeVisible();
    await expect(a.getByText(NEWER_NOTICE)).toHaveCount(0);
    await b.goto("/curriculum");
    await b.evaluate(([key, value]) => window.localStorage.setItem(key as string, value as string), [KEY, V3_EXTRA]);
    await expect(a.getByText(NEWER_NOTICE)).toBeVisible();
    await a.getByRole("button", { name: "Mark complete" }).click();
    expect(await readRaw(a)).toBe(V3_EXTRA);
    expect(problems()).toEqual([]);
  });
});

test.describe("P-6 / P-7: community stays out of exports and imports, and survives a reset", () => {
  const mine = () => ({
    ...progressDoc(),
    community: { clientId: MINE, displayName: "Secret Name", namePrompted: true },
  });

  test("the exported file has no community key, clientId or name", async ({ page }) => {
    await seedProgress(page, mine());
    await page.goto("/progress");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export progress" }).click();
    const text = readFileSync(await (await downloadPromise).path(), "utf8");
    expect(text).not.toContain("community");
    expect(text).not.toContain(MINE);
    expect(text).not.toContain("Secret Name");
    expect(JSON.parse(text).version).toBe(2);
  });

  test("importing a file that carries a community leaves the local clientId and name unchanged", async ({ page }) => {
    await seedProgress(page, mine());
    await page.goto("/progress");
    const file = {
      ...progressDoc(),
      lessons: { "l1-first-session": { completedAt: "2026-09-20T01:00:00.000Z" } },
      community: { clientId: OTHER, displayName: "Evil", namePrompted: true },
    };
    await page.getByLabel("Import progress file").setInputFiles({
      name: "import.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(file)),
    });
    await page.getByRole("button", { name: "Replace my progress" }).click();
    await expect(page.getByText("Progress imported: 1 lesson, 0 bookmarks.")).toBeVisible();
    const stored = JSON.parse((await readRaw(page)) ?? "null");
    expect(stored.lessons["l1-first-session"]).toBeDefined();
    expect(stored.community).toEqual({ clientId: MINE, displayName: "Secret Name", namePrompted: true });
  });

  test("reset keeps community and says so", async ({ page }) => {
    await seedProgress(page, mine());
    await page.goto("/progress");
    await page.getByLabel("Type reset to confirm").fill("reset");
    await page.getByRole("button", { name: "Reset all progress" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Your stars, reactions and name are kept." })).toBeVisible();
    const stored = JSON.parse((await readRaw(page)) ?? "null");
    expect(stored.lessons).toEqual({});
    expect(stored.community).toEqual({ clientId: MINE, displayName: "Secret Name", namePrompted: true });
  });

  test("a stored v1 doc is migrated on the first write: progress kept, a clientId added", async ({ page }) => {
    const v1 = {
      version: 1,
      lessons: { "l2-context-files": { completedAt: "2026-09-20T01:00:00.000Z" } },
      checklists: {},
      bookmarks: { lessons: {}, news: {} },
      prefs: { tool: "codex" },
      lastViewed: null,
    };
    await seedProgress(page, JSON.stringify(v1));
    await page.goto(L1);
    await page.getByRole("button", { name: "Mark complete" }).click();
    await expect(page.getByText("Completed ✓ · Undo")).toBeVisible();
    const stored = JSON.parse((await readRaw(page)) ?? "null");
    expect(stored.version).toBe(2);
    expect(stored.lessons["l2-context-files"]).toBeDefined();
    expect(stored.prefs.tool).toBe("codex");
    expect(stored.community.clientId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
