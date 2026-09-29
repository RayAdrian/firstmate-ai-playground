import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  KEY,
  blockStorage,
  collectConsole,
  doc,
  oneComplete,
  readProgress,
  readRaw,
  seedProgress,
} from "./helpers";

const IMPORT_LABEL = "Import progress file";

const importDoc = doc({
  lessons: {
    "l1-first-session": { completedAt: "2026-09-20T01:00:00.000Z" },
    "l1-permissions": { completedAt: "2026-09-21T01:00:00.000Z" },
    "l2-context-files": { completedAt: "2026-09-22T01:00:00.000Z" },
  },
  bookmarks: {
    lessons: { "l1-first-session": "2026-09-23T01:00:00.000Z" },
    news: {
      "d0000000-0000-4000-8000-000000000001": "2026-09-24T01:00:00.000Z",
      "d0000000-0000-4000-8000-000000000002": "2026-09-25T01:00:00.000Z",
    },
  },
  prefs: { tool: "codex" },
});

function upload(page: Page, name: string, content: string | Buffer, mimeType = "application/json") {
  return page.getByLabel(IMPORT_LABEL).setInputFiles({
    name,
    mimeType,
    buffer: typeof content === "string" ? Buffer.from(content) : content,
  });
}

test.describe("/progress: hydration safety (P-5)", () => {
  test("server HTML has a neutral placeholder and no progress state", async ({ request }) => {
    const res = await request.get("/progress");
    expect(res.ok()).toBe(true);
    const html = await res.text();
    expect(html).toContain('data-testid="progress-placeholder"');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toMatch(/not started/i);
    expect(html).not.toMatch(/lessons complete/i);
    expect(html).not.toContain("Completed ✓");
  });

  test("no hydration warnings and shows stored state after mount", async ({ page }) => {
    const con = collectConsole(page);
    await seedProgress(
      page,
      doc({ ...oneComplete, checklists: { "ex-x": { a: true, b: true } }, prefs: { tool: "codex" } }),
    );
    await page.goto("/progress");
    await expect(page.getByText(/1 lesson complete|1 of \d+ lessons complete/)).toBeVisible();
    await expect(page.getByText("2 checklist items")).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(con.hydration).toEqual([]);
    expect(con.errors).toEqual([]);
  });

  test("read-only loads never write storage (TC-D-13)", async ({ page }) => {
    await page.addInitScript((key) => {
      const original = Storage.prototype.setItem;
      (window as unknown as { __writes: number }).__writes = 0;
      Storage.prototype.setItem = function (k: string, v: string) {
        if (k === key) (window as unknown as { __writes: number }).__writes += 1;
        return original.call(this, k, v);
      };
    }, KEY);
    await page.goto("/progress");
    await expect(page.getByText(/lessons? complete/)).toBeVisible();
    await page.goto("/bookmarks");
    await expect(page.getByRole("heading", { level: 1, name: "Bookmarks" })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __writes: number }).__writes)).toBe(0);
  });
});

test.describe("/progress: corrupted state (P-2)", () => {
  test("invalid JSON is reset with a dismissible notice, focus to the heading", async ({ page }) => {
    const con = collectConsole(page);
    await seedProgress(page, '{"version":1,');
    await page.goto("/progress");
    const notice = page.getByRole("status").filter({ hasText: "Saved progress was unreadable and has been reset" });
    await expect(notice).toBeVisible();
    const stored = await readProgress(page);
    expect(stored).toEqual(doc());
    await notice.getByRole("button", { name: "Dismiss" }).click();
    await expect(notice).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "Progress" })).toBeFocused();
    await page.reload();
    await expect(page.getByText(/lessons? complete/)).toBeVisible();
    await expect(page.getByText("Saved progress was unreadable")).toHaveCount(0);
    expect(con.errors).toEqual([]);
  });

  for (const [name, raw] of [
    ["schema mismatch", '{"version":1,"lessons":"nope"}'],
    ["number", "42"],
    ["array", "[]"],
    ["bad tool", JSON.stringify({ ...doc(), prefs: { tool: "vim" } })],
    ["bad timestamp", JSON.stringify(doc({ lessons: { a: { completedAt: "yesterday" } } }))],
    ["version 2", JSON.stringify({ ...doc(), version: 2 })],
    ["version 0", JSON.stringify({ ...doc(), version: 0 })],
    ["string version", JSON.stringify({ ...doc(), version: "1" })],
  ] as const) {
    test(`variant: ${name}`, async ({ page }) => {
      const con = collectConsole(page);
      await seedProgress(page, raw);
      await page.goto("/progress");
      await expect(page.getByText("Saved progress was unreadable and has been reset")).toBeVisible();
      expect(await readProgress(page)).toEqual(doc());
      expect(con.errors).toEqual([]);
    });
  }

  test("5 MB of garbage does not hang", async ({ page }) => {
    await seedProgress(page, "x".repeat(4.5 * 1024 * 1024));
    const start = Date.now();
    await page.goto("/progress");
    await expect(page.getByText("Saved progress was unreadable and has been reset")).toBeVisible();
    expect(Date.now() - start).toBeLessThan(10_000);
    expect(await readProgress(page)).toEqual(doc());
  });
});

test.describe("/progress: storage unavailable (P-3)", () => {
  test("banner shows, page works, controls act on the session", async ({ page }) => {
    const con = collectConsole(page);
    await blockStorage(page);
    await page.goto("/progress");
    await expect(page.getByRole("heading", { level: 1, name: "Progress" })).toBeVisible();
    await expect(
      page.getByRole("status").filter({ hasText: "Progress can't be saved in this browser" }),
    ).toBeVisible();
    await expect(page.getByText("Saved progress was unreadable")).toHaveCount(0);
    await upload(page, "p.json", JSON.stringify(importDoc));
    await page.getByRole("button", { name: "Replace my progress" }).click();
    await expect(page.getByText("Progress imported: 3 lessons, 3 bookmarks.")).toBeVisible();
    await expect(page.getByText(/^3 (of \d+ )?lessons complete/)).toBeVisible();
    expect(con.errors).toEqual([]);
  });

  test("export still downloads the in-session state", async ({ page }) => {
    await blockStorage(page);
    await page.goto("/progress");
    await upload(page, "p.json", JSON.stringify(importDoc));
    await page.getByRole("button", { name: "Replace my progress" }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export progress" }).click();
    const file = await (await download).path();
    const { readFileSync } = await import("node:fs");
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(importDoc);
  });

  test("quota error on write: banner after the failed write, storage unchanged", async ({ page }) => {
    await seedProgress(page, oneComplete);
    await page.addInitScript(() => {
      Storage.prototype.setItem = function () {
        throw new DOMException("full", "QuotaExceededError");
      };
    });
    await page.goto("/progress");
    await expect(page.getByText(/1 (of \d+ )?lessons? complete/)).toBeVisible();
    await upload(page, "p.json", JSON.stringify(importDoc));
    await page.getByRole("button", { name: "Replace my progress" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Progress can't be saved in this browser" }),
    ).toBeVisible();
    await expect(page.getByText(/^3 (of \d+ )?lessons complete/)).toBeVisible();
    expect(await readRaw(page)).toBe(JSON.stringify(oneComplete));
  });
});

test.describe("/progress: export (P-6.1)", () => {
  test.use({ timezoneId: "Asia/Manila", permissions: ["clipboard-read", "clipboard-write"] });

  test("downloads a dated file and copies the JSON", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-09-30T13:00:00+08:00"));
    await seedProgress(page, oneComplete);
    await page.goto("/progress");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export progress" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("fm-playground-progress-2026-09-30.json");
    const { readFileSync } = await import("node:fs");
    const fromFile: unknown = JSON.parse(readFileSync(await download.path(), "utf8"));
    expect(fromFile).toEqual(await readProgress(page));
    await expect(page.getByText("Downloaded and copied to clipboard.")).toBeVisible();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(JSON.parse(clip)).toEqual(fromFile);
    await expect(page.locator("#fm-live")).toHaveText("Progress exported and copied");
  });

  test("uses the browser's local date (TC-D-37)", async ({ browser }) => {
    const context = await browser.newContext({ timezoneId: "America/Los_Angeles" });
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-09-30T23:30:00Z"));
    await page.goto("/progress");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export progress" }).click();
    expect((await downloadPromise).suggestedFilename()).toBe("fm-playground-progress-2026-09-30.json");
    await context.close();
  });

  test("clipboard denied: download still happens, JSON is offered for manual copy", async ({ page }) => {
    const con = collectConsole(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => Promise.reject(new DOMException("denied", "NotAllowedError")) },
      });
    });
    await seedProgress(page, oneComplete);
    await page.goto("/progress");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export progress" }).click();
    await downloadPromise;
    await expect(page.getByText("Downloaded. Copy to clipboard was blocked.")).toBeVisible();
    await expect(page.getByText(/Press (⌘|Ctrl\+)C to copy/)).toBeVisible();
    await expect(page.getByRole("textbox", { name: /Exported progress/ })).toHaveValue(/"version": 1/);
    expect(con.errors).toEqual([]);
  });
});

test.describe("/progress: import (P-6.2)", () => {
  test("valid file: preview first, replace only on confirm, then reflects everywhere", async ({ page }) => {
    await seedProgress(page, oneComplete);
    await page.goto("/progress");
    const before = await readRaw(page);
    await upload(page, "import.json", JSON.stringify(importDoc));
    const preview = page.getByRole("status").filter({ hasText: "Importing replaces everything saved in this browser." });
    await expect(preview).toContainText("3 lessons");
    await expect(preview).toContainText("3 bookmarks");
    expect(await readRaw(page)).toBe(before);
    await page.getByRole("button", { name: "Replace my progress" }).click();
    expect(await readProgress(page)).toEqual(importDoc);
    const done = page.getByText("Progress imported: 3 lessons, 3 bookmarks.");
    await expect(done).toBeVisible();
    await expect(page.getByText(/^3 (of \d+ )?lessons complete/)).toBeVisible();
    // Focus moves to the success notice (its wrapper).
    await expect(page.locator("div[tabindex='-1']").filter({ has: done })).toBeFocused();
  });

  test("cancel leaves state untouched and returns focus to the file input", async ({ page }) => {
    await seedProgress(page, oneComplete);
    await page.goto("/progress");
    const before = await readRaw(page);
    await upload(page, "import.json", JSON.stringify(importDoc));
    await page.getByRole("button", { name: "Cancel" }).click();
    expect(await readRaw(page)).toBe(before);
    await expect(page.getByRole("button", { name: "Replace my progress" })).toHaveCount(0);
    await expect(page.getByLabel(IMPORT_LABEL)).toBeFocused();
  });

  const bad: [string, string | Buffer, string, string][] = [
    ["bad json", '{"version":1,', "application/json", "invalid JSON"],
    ["wrong shape", '{"version":1,"lessons":[]}', "application/json", "not a progress file"],
    ["version 99", JSON.stringify({ ...doc(), version: 99 }), "application/json", "unsupported version 99"],
    ["empty file", "", "application/json", "the file is empty"],
    ["missing version", '{"lessons":{}}', "application/json", "missing `version`"],
    ["a photo", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]), "image/png", "invalid JSON"],
    ["a 10 MB file", Buffer.from(`[${'"x",'.repeat(2_600_000)}"y"]`), "application/json", "too large"],
  ];
  for (const [name, content, mime, reason] of bad) {
    test(`rejects ${name} without touching state`, async ({ page }) => {
      const con = collectConsole(page);
      await seedProgress(page, oneComplete);
      await page.goto("/progress");
      const before = await readRaw(page);
      await upload(page, "bad.json", content, mime);
      // Next.js renders its own route announcer with role=alert, so match by text.
      const alert = page.getByRole("alert").filter({ hasText: "This file isn't a valid progress export." });
      await expect(alert).toContainText("This file isn't a valid progress export.");
      await expect(alert).toContainText(reason);
      await expect(page.getByRole("button", { name: "Replace my progress" })).toHaveCount(0);
      expect(await readRaw(page)).toBe(before);
      expect(con.errors).toEqual([]);
    });
  }

  test("prototype-pollution payload cannot pollute", async ({ page }) => {
    await seedProgress(page, oneComplete);
    await page.goto("/progress");
    await upload(
      page,
      "evil.json",
      '{"version":1,"lessons":{"__proto__":{"polluted":true}},"checklists":{},"bookmarks":{"lessons":{},"news":{}},"prefs":{"tool":"claude","__proto__":{"isAdmin":true}},"lastViewed":null}',
    );
    await page.getByRole("button", { name: "Replace my progress" }).click();
    expect(await page.evaluate(() => ({}) as Record<string, unknown>).then((o) => o.polluted)).toBeUndefined();
    expect(await readRaw(page)).not.toMatch(/__proto__/);
  });

  test("keeps unknown slugs and news ids (P-4)", async ({ page }) => {
    await seedProgress(page, oneComplete);
    await page.goto("/progress");
    const future = doc({ lessons: { "lesson-from-future": { completedAt: "2026-09-20T00:00:00.000Z" } } });
    await upload(page, "f.json", JSON.stringify(future));
    await expect(page.getByRole("status").filter({ hasText: "1 lesson," })).toBeVisible();
    await page.getByRole("button", { name: "Replace my progress" }).click();
    expect(await readProgress(page)).toEqual(future);
  });
});

test.describe("/progress: reset (P-7)", () => {
  test("requires typing reset; near misses stay inert", async ({ page }) => {
    await seedProgress(page, oneComplete);
    await page.goto("/progress");
    const button = page.getByRole("button", { name: "Reset all progress" });
    const input = page.getByLabel("Type reset to confirm");
    await expect(button).toBeDisabled();
    for (const near of ["Reset", "RESET", "rese", "resett", "rеset"]) {
      await input.fill(near);
      await expect(button).toBeDisabled();
      await input.press("Enter");
      await expect(page.getByText("Type reset exactly to confirm.")).toBeVisible();
      expect(await readProgress(page)).toEqual(oneComplete);
    }
    await input.fill("reset");
    await expect(button).toBeEnabled();
    await button.click();
    const done = page.getByRole("status").filter({ hasText: "All progress has been reset." });
    await expect(done).toBeVisible();
    expect(await readProgress(page)).toEqual(doc());
    await expect(page.getByText(/^0 (of \d+ )?lessons complete/)).toBeVisible();
  });
});

test.describe("/progress: cross-tab (P-1)", () => {
  test("another tab's change appears without a reload", async ({ context }) => {
    const a = await context.newPage();
    const b = await context.newPage();
    await a.goto("/progress");
    await b.goto("/progress");
    await expect(b.getByText(/^0 (of \d+ )?lessons complete/)).toBeVisible();
    await upload(a, "i.json", JSON.stringify(importDoc));
    await a.getByRole("button", { name: "Replace my progress" }).click();
    await expect(b.getByText(/^3 (of \d+ )?lessons complete/)).toBeVisible({ timeout: 2000 });
  });

  test("interleaved writes always leave a valid document", async ({ context }) => {
    const a = await context.newPage();
    const b = await context.newPage();
    await a.goto("/progress");
    await b.goto("/progress");
    for (let i = 0; i < 5; i++) {
      await Promise.all([
        upload(a, "i.json", JSON.stringify(importDoc)).then(() =>
          a.getByRole("button", { name: "Replace my progress" }).click(),
        ),
        b.getByLabel("Type reset to confirm").fill("reset").then(() =>
          b.getByRole("button", { name: "Reset all progress" }).click(),
        ),
      ]);
      const raw = await readRaw(a);
      expect(() => JSON.parse(raw ?? "")).not.toThrow();
      await expect(a.getByText("Saved progress was unreadable")).toHaveCount(0);
    }
  });
});

test.describe("/progress: accessibility", () => {
  test("no serious axe violations", async ({ page }) => {
    await seedProgress(page, oneComplete);
    await page.goto("/progress");
    await expect(page.getByText(/lessons? complete/)).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });
});
