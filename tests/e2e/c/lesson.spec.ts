import { expect, test, type Page } from "@playwright/test";
import {
  NOW,
  codexPref,
  doc,
  oneComplete,
  readProgress,
  seedProgress,
  setCookie,
  waitLessonHydrated,
} from "./support";
import { collectConsole, setServerNow } from "../../support";

const L1 = "/lessons/l1-first-session";

test.beforeEach(async ({ context, baseURL }) => {
  await setServerNow(context, baseURL!, NOW);
});

const tab = (page: Page, name: string) => page.getByRole("tablist", { name: "Tool" }).getByRole("tab", { name });

test.describe("layout (L-1)", () => {
  test("TC-C-19 sections are in the required order", async ({ page }) => {
    await page.goto(L1);
    const order = await page.evaluate(() => {
      const q = (sel: string) => document.querySelector(sel);
      const els = [
        q("h1"),
        q("#concept"),
        q('[role="tablist"][aria-label="Tool"]'),
        q("section[aria-labelledby=differences]"),
        q("section[aria-labelledby='exercise exercise-title']"),
        q('nav[aria-label="Lesson"]'),
      ];
      if (els.some((e) => !e)) return null;
      return els.slice(1).map((el, i) => Boolean((els[i]!.compareDocumentPosition(el!) & Node.DOCUMENT_POSITION_FOLLOWING)));
    });
    expect(order).toEqual([true, true, true, true, true]);
    const header = page.locator("header").filter({ has: page.getByRole("heading", { level: 1 }) });
    await expect(header).toContainText("Run an interactive session in both tools.");
    await expect(header).toContainText("20 min");
    await expect(header).toContainText("Verified 20 Sep 2026 · Claude Code v2.1.0 / Codex v0.40.0");
  });

  test("TC-C-20 a lesson without an exercise has no exercise panel", async ({ page }) => {
    await page.goto("/lessons/l1-permissions");
    await expect(page.getByRole("region", { name: /^Exercise/ })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: "Exercise" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Key differences" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Lesson", exact: true })).toBeVisible();
  });
});

test.describe("tool tabs (L-2)", () => {
  test("TC-C-21 ARIA structure", async ({ page }) => {
    await seedProgress(page, doc());
    await page.goto(L1);
    const tablist = page.getByRole("tablist", { name: "Tool" });
    await expect(tablist.getByRole("tab")).toHaveText(["Claude Code", "Codex CLI"]);
    await expect(tab(page, "Claude Code")).toHaveAttribute("aria-selected", "true");
    await expect(tab(page, "Claude Code")).toHaveAttribute("tabindex", "0");
    await expect(tab(page, "Codex CLI")).toHaveAttribute("aria-selected", "false");
    await expect(tab(page, "Codex CLI")).toHaveAttribute("tabindex", "-1");
    for (const name of ["Claude Code", "Codex CLI"]) {
      const t = tab(page, name);
      const panelId = await t.getAttribute("aria-controls");
      const panel = page.locator(`[id="${panelId}"]`);
      await expect(panel).toHaveAttribute("aria-labelledby", (await t.getAttribute("id"))!);
      await expect(panel).toHaveAttribute("role", "tabpanel");
      await expect(t.locator('svg[aria-hidden="true"]')).toHaveCount(1);
    }
    await expect(page.locator("#panel-lesson-codex")).toBeHidden();
    await expect(page.locator("#panel-lesson-claude")).toHaveAttribute("tabindex", "0");
    const ids = await page.evaluate(() => Array.from(document.querySelectorAll("[id]")).map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("TC-C-22/23 arrows wrap, Home/End work, and the URL follows", async ({ page }) => {
    await page.goto(L1);
    await waitLessonHydrated(page);
    await tab(page, "Claude Code").focus();
    await page.keyboard.press("ArrowRight");
    await expect(tab(page, "Codex CLI")).toBeFocused();
    await expect(tab(page, "Codex CLI")).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(/\?tool=codex/);
    await page.keyboard.press("ArrowRight");
    await expect(tab(page, "Claude Code")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(tab(page, "Codex CLI")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(tab(page, "Claude Code")).toBeFocused();
    const y = await page.evaluate(() => window.scrollY);
    await page.keyboard.press("End");
    await expect(tab(page, "Codex CLI")).toBeFocused();
    await page.keyboard.press("Home");
    await expect(tab(page, "Claude Code")).toBeFocused();
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - y)).toBeLessThanOrEqual(50);
  });

  test("TC-C-24 Tab moves from the active tab into the panel", async ({ page }) => {
    await page.goto(L1);
    await tab(page, "Claude Code").focus();
    await page.keyboard.press("Tab");
    await expect(page.locator("#panel-lesson-claude")).toBeFocused();
  });

  test("TC-C-25 ?tool=codex opens Codex in the server HTML", async ({ page, request }) => {
    const html = await (await request.get(`${L1}?tool=codex`)).text();
    expect(html).toMatch(/id="tab-lesson-codex"[^>]*aria-selected="true"|aria-selected="true"[^>]*id="tab-lesson-codex"/);
    await page.goto(`${L1}?tool=codex`);
    await expect(tab(page, "Codex CLI")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel", { name: "Codex CLI" }).first()).toContainText("codex");
  });

  test("TC-C-26 clicking a tab rewrites ?tool without a reload or new document", async ({ page }) => {
    await page.goto(L1);
    await waitLessonHydrated(page);
    await page.evaluate(() => ((window as unknown as { __noReload: string }).__noReload = "marker"));
    const docRequests: string[] = [];
    page.on("request", (r) => {
      if (r.resourceType() === "document") docRequests.push(r.url());
    });
    await tab(page, "Codex CLI").click();
    await expect(page).toHaveURL(/\/lessons\/l1-first-session\?tool=codex$/);
    await tab(page, "Claude Code").click();
    await expect(page).toHaveURL(/\?tool=claude$/);
    expect(await page.evaluate(() => (window as unknown as { __noReload: string }).__noReload)).toBe("marker");
    expect(docRequests).toEqual([]);
  });

  for (const size of [
    { width: 1440, height: 900 },
    { width: 360, height: 800 },
  ]) {
    test(`TC-C-27 switching tabs keeps scroll within 50px at ${size.width}px`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(L1);
      await waitLessonHydrated(page);
      await page.getByRole("tablist", { name: "Tool" }).evaluate((el) => {
        el.scrollIntoView();
        window.scrollBy(0, -100);
      });
      const y0 = await page.evaluate(() => window.scrollY);
      await tab(page, "Codex CLI").click();
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
      expect(Math.abs((await page.evaluate(() => window.scrollY)) - y0)).toBeLessThanOrEqual(50);
      await tab(page, "Claude Code").click();
      expect(Math.abs((await page.evaluate(() => window.scrollY)) - y0)).toBeLessThanOrEqual(50);
    });
  }

  test("TC-C-28 default is Claude; a saved codex preference applies after hydration", async ({ browser, baseURL }) => {
    const a = await browser.newPage({ baseURL });
    await seedProgress(a, doc());
    await a.goto(L1);
    await expect(tab(a, "Claude Code")).toHaveAttribute("aria-selected", "true");
    await a.close();

    const b = await browser.newPage({ baseURL });
    const problems = collectConsole(b);
    await seedProgress(b, codexPref);
    await b.goto(L1);
    await expect(tab(b, "Codex CLI")).toHaveAttribute("aria-selected", "true");
    await expect(b).toHaveURL(/\?tool=codex/);
    expect(problems()).toEqual([]);
    await b.close();
  });

  test("TC-C-29 choosing a tab persists prefs.tool across lessons", async ({ page }) => {
    await seedProgress(page, doc());
    await page.goto(L1);
    await waitLessonHydrated(page);
    await tab(page, "Codex CLI").click();
    expect((await readProgress(page))?.prefs.tool).toBe("codex");
    await page.goto("/lessons/l2-context-files");
    await expect(tab(page, "Codex CLI")).toHaveAttribute("aria-selected", "true");
  });

  test("TC-C-30 an explicit ?tool wins and does not overwrite the preference", async ({ page }) => {
    await seedProgress(page, codexPref);
    await page.goto(`${L1}?tool=claude`);
    await waitLessonHydrated(page);
    await expect(tab(page, "Claude Code")).toHaveAttribute("aria-selected", "true");
    expect((await readProgress(page))?.prefs.tool).toBe("codex");
  });

  test("TC-C-31 invalid ?tool values fall back safely and are never echoed", async ({ page }) => {
    const problems = collectConsole(page);
    for (const [query, expected] of [
      ["?tool=cursor", "Claude Code"],
      ["?tool=", "Claude Code"],
      ["?tool=CODEX", "Claude Code"],
      ["?tool=codex&tool=claude", "Codex CLI"],
      ["?tool=%3Cscript%3E", "Claude Code"],
    ] as const) {
      const res = await page.goto(`${L1}${query}`);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("tablist", { name: "Tool" }).getByRole("tab", { selected: true })).toHaveText(expected);
      await expect(page.locator("body")).not.toContainText("<script>");
    }
    expect(problems()).toEqual([]);
  });
});

test.describe("differences and no-equivalent (L-3)", () => {
  test("TC-C-32/33 differences sit outside the tabs and show in both states", async ({ page }) => {
    await page.goto(L1);
    const callout = page.getByRole("region", { name: "Key differences" });
    await expect(callout.getByRole("listitem")).toHaveCount(3);
    expect(await callout.evaluate((el) => el.closest('[role="tabpanel"]'))).toBeNull();
    await tab(page, "Codex CLI").click();
    await expect(callout).toBeVisible();
    await expect(callout.getByRole("listitem")).toHaveCount(3);
    await page.goto("/lessons/l1-permissions");
    await expect(page.getByRole("region", { name: "Key differences" }).getByRole("listitem")).toHaveCount(1);
    await page.goto("/lessons/l2-context-files");
    await expect(page.getByRole("region", { name: "Key differences" }).getByRole("listitem")).toHaveCount(5);
  });

  test("TC-C-35 Codex tab shows the no-equivalent notice with the workaround", async ({ page }) => {
    await page.goto("/lessons/l1-permissions?tool=codex");
    const panel = page.getByRole("tabpanel", { name: "Codex CLI" });
    await expect(panel).toContainText("No native equivalent in Codex CLI (as of v0.40.0)");
    await expect(panel).toContainText("Workaround: use a sandbox profile");
    await expect(tab(page, "Codex CLI")).toBeEnabled();
  });
});

test.describe("code blocks (L-4)", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  const concept = (page: Page) => page.locator("#concept").locator("xpath=..");

  test("TC-C-37/40 every fenced block has a distinct copy button, a label and highlighting", async ({ page }) => {
    await page.goto(L1);
    const figures = concept(page).locator("figure");
    await expect(figures).toHaveCount(3);
    await expect(concept(page).getByRole("button", { name: /^Copy/ })).toHaveCount(3);
    await expect(figures.locator("figcaption")).toHaveText(["bash", "settings.json", "text"]);
    await expect(page.getByRole("button", { name: "Copy code: bash" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy code: settings.json" })).toBeVisible();
    expect(await figures.nth(0).locator("pre code span[style]").count()).toBeGreaterThan(1);
    expect(await figures.nth(1).locator("pre code span[style]").count()).toBeGreaterThan(1);
  });

  test("TC-C-38/39 copy writes the exact source and announces Copied", async ({ page }) => {
    await page.goto(L1);
    await waitLessonHydrated(page);
    const bash = page.getByRole("button", { name: "Copy code: bash" });
    await bash.click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "npm i -g @anthropic-ai/claude-code\nclaude --version",
    );
    await expect(page.locator("#fm-live")).toHaveText("Copied");
    await expect(bash).toBeFocused();
    await page.getByRole("button", { name: "Copy code: settings.json" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      '{ "permissions": { "allow": ["Bash(npm test)"] } }',
    );
  });

  test("TC-C-41 a denied clipboard selects the code and shows the hint", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: () => Promise.reject(new DOMException("denied", "NotAllowedError")) },
      });
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(L1);
    await waitLessonHydrated(page);
    await page.getByRole("button", { name: "Copy code: bash" }).click();
    await expect(page.locator("figure p").filter({ hasText: /^Press (⌘|Ctrl\+)C to copy$/ })).toBeVisible();
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(
      "npm i -g @anthropic-ai/claude-code\nclaude --version",
    );
    await expect(page.getByText("Copied", { exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe("mark complete (L-5)", () => {
  test("TC-C-42/43 mark complete stores an ISO time and the curriculum reflects it via client navigation", async ({ page }) => {
    await seedProgress(page, doc());
    await page.goto(L1);
    await waitLessonHydrated(page);
    await page.evaluate(() => ((window as unknown as { __spa: string }).__spa = "1"));
    await page.getByRole("button", { name: "Mark complete" }).click();
    await expect(page.getByText("Completed ✓ · Undo")).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo" })).toBeFocused();
    const stored = await readProgress(page);
    expect(stored?.lessons["l1-first-session"].completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
    expect(Math.abs(Date.parse(stored!.lessons["l1-first-session"].completedAt) - Date.now())).toBeLessThan(5000);
    await expect(page.locator("#fm-live")).toHaveText("Lesson marked complete");
    await page.getByRole("link", { name: "Curriculum" }).first().click();
    await page.waitForURL("**/curriculum");
    expect(await page.evaluate(() => (window as unknown as { __spa: string }).__spa)).toBe("1");
    await expect(page.getByRole("region", { name: /^Level 1/ })).toContainText("1 / 2");
  });

  test("TC-C-44 undo deletes the entry", async ({ page }) => {
    await seedProgress(page, oneComplete);
    await page.goto(L1);
    await waitLessonHydrated(page);
    await expect(page.getByText("Completed ✓ · Undo")).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    expect("l1-first-session" in (await readProgress(page))!.lessons).toBe(false);
    await expect(page.getByRole("button", { name: "Mark complete" })).toBeFocused();
    await page.reload();
    await expect(page.getByRole("button", { name: "Mark complete" })).toBeEnabled();
  });

  test("TC-C-45 a double click leaves storage and UI in agreement", async ({ page }) => {
    const problems = collectConsole(page);
    await seedProgress(page, doc());
    await page.goto(L1);
    await waitLessonHydrated(page);
    await page.getByRole("button", { name: "Mark complete" }).dblclick();
    const stored = await readProgress(page);
    const completed = "l1-first-session" in stored!.lessons;
    if (completed) await expect(page.getByText("Completed ✓ · Undo")).toBeVisible();
    else await expect(page.getByRole("button", { name: "Mark complete" })).toBeVisible();
    expect(problems()).toEqual([]);
  });
});

test.describe("previous and next (L-6)", () => {
  test("TC-C-46/47/48 neighbours across levels; last lesson goes back to the curriculum", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: "Lesson", exact: true });
    await page.goto(L1);
    await expect(nav.getByRole("link", { name: /^Previous: / })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: /^Next: .*Permissions and sandboxing/ })).toHaveAttribute(
      "href",
      "/lessons/l1-permissions",
    );
    await page.goto("/lessons/l1-permissions");
    await expect(nav.getByRole("link", { name: /^Next: / })).toHaveAttribute("href", "/lessons/l2-context-files");
    await expect(nav.getByRole("link", { name: /^Previous: / })).toHaveAttribute("href", "/lessons/l1-first-session");
    await page.goto("/lessons/l2-context-files");
    await expect(nav.getByRole("link", { name: /^Previous: / })).toHaveAttribute("href", "/lessons/l1-permissions");
    await page.goto("/lessons/l2-memory");
    await expect(nav.getByRole("link", { name: /^Next: / })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Back to curriculum" })).toHaveAttribute("href", "/curriculum");
    await expect(page.locator('a[href="/lessons/l2-retired"]')).toHaveCount(0);
  });
});

test.describe("safe markdown (L-7)", () => {
  test("TC-C-50 raw HTML renders as text and nothing executes", async ({ page }) => {
    const dialogs: string[] = [];
    const errors: string[] = [];
    page.on("dialog", (d) => dialogs.push(d.message()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/lessons/l2-memory");
    await page.waitForTimeout(1000);
    expect(await page.evaluate(() => (window as unknown as { __xss?: unknown }).__xss)).toBeUndefined();
    expect(await page.locator("main script").count()).toBe(0);
    expect(await page.locator('img[src="x"]').count()).toBe(0);
    await expect(page.getByText("<script>window.__xss=1</script>")).toBeVisible();
    expect(dialogs).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("TC-C-52 external links are new-tab and safe, internal links are not", async ({ page, context }) => {
    await page.goto(L1);
    const external = page.getByRole("link", { name: /the docs/ });
    await expect(external).toHaveAttribute("target", "_blank");
    const rel = (await external.getAttribute("rel")) ?? "";
    expect(rel).toContain("noopener");
    expect(rel).toContain("noreferrer");
    const internal = page.locator('#concept ~ p a[href="/lessons/l1-permissions"], a[href="/lessons/l1-permissions"]').first();
    await expect(internal).not.toHaveAttribute("target", /.+/);
    await expect(internal).not.toHaveAttribute("rel", /.+/);
    const popup = context.waitForEvent("page");
    await external.click();
    const opened = await popup;
    expect(page.url()).toContain(L1);
    expect(await opened.evaluate(() => window.opener)).toBeNull();
    await opened.close();
  });
});

test.describe("bookmark (L-8)", () => {
  test("TC-C-53 the header toggle persists and toggles back", async ({ page }) => {
    await seedProgress(page, doc());
    await page.goto("/lessons/l2-context-files");
    await waitLessonHydrated(page);
    const toggle = page.locator("header").getByRole("button", { name: "Bookmark" });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    const stored = await readProgress(page);
    expect(Object.keys(stored!.bookmarks.lessons)).toEqual(["l2-context-files"]);
    await page.reload();
    await expect(page.locator("header").getByRole("button", { name: "Bookmark" })).toHaveAttribute("aria-pressed", "true");
    await page.locator("header").getByRole("button", { name: "Bookmark" }).click();
    expect((await readProgress(page))!.bookmarks.lessons).toEqual({});
  });
});

test.describe("lesson states (§9)", () => {
  test("TC-C-67 unknown, archived, wrong-case and hostile slugs return 404", async ({ page }) => {
    for (const slug of ["does-not-exist", "l2-retired", "L1-FIRST-SESSION", "%3Cscript%3E"]) {
      const res = await page.goto(`/lessons/${slug}`);
      expect(res?.status(), slug).toBe(404);
      await expect(page.getByRole("heading", { level: 1, name: "Lesson not found" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Go to curriculum" })).toHaveAttribute("href", "/curriculum");
      await expect(page.locator("body")).not.toContainText("does-not-exist");
      await expect(page.locator("body")).not.toContainText("Retired");
    }
  });

  test("TC-C-68 lesson skeleton shows on slow client navigation", async ({ page, context, baseURL }) => {
    await page.goto("/curriculum");
    await setCookie(context, baseURL!, "fm_test_delay", "lesson:1500");
    await page.getByRole("link", { name: "Your first agent session" }).click();
    await expect(page.getByTestId("lesson-skeleton")).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("heading", { level: 1, name: "Your first agent session" })).toBeVisible({ timeout: 10_000 });
  });

  test("TC-C-69 lesson error boundary with retry", async ({ page, context, baseURL }) => {
    await setCookie(context, baseURL!, "fm_test_fail", "lesson");
    await page.goto(L1);
    await expect(page.getByRole("alert").filter({ hasText: "couldn't load" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/Injected test failure/);
    await context.clearCookies({ name: "fm_test_fail" });
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Your first agent session" })).toBeVisible();
  });
});

test.describe("responsive (D-3)", () => {
  for (const width of [360, 768, 1024, 1440]) {
    test(`TC-C-72 no horizontal page scroll at ${width}px; code scrolls inside itself`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/curriculum", L1, "/exercises"]) {
        await page.goto(path);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), path).toBe(true);
      }
      await page.goto(L1);
      const pre = page.locator("figure").nth(2).locator("pre");
      if (width === 360) await expect.poll(() => pre.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
      const info = await pre.evaluate((el) => ({
        overflow: getComputedStyle(el).overflowX,
        wider: el.scrollWidth > el.clientWidth,
        tabindex: el.getAttribute("tabindex"),
      }));
      expect(["auto", "scroll"]).toContain(info.overflow);
      expect(info.tabindex).toBe("0");
    });
  }

  test("TC-C-73 tabs stay tabs at 360px and are touch-sized", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(`${baseURL}${L1}`);
    await expect(page.getByRole("tablist", { name: "Tool" }).getByRole("tab")).toHaveCount(2);
    await expect(page.locator('[role="tab"][aria-expanded]')).toHaveCount(0);
    for (const t of await page.getByRole("tablist", { name: "Tool" }).getByRole("tab").all()) {
      const box = await t.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole("tab", { name: "Codex CLI" }).first().tap();
    await expect(page.getByRole("tab", { name: "Codex CLI" }).first()).toHaveAttribute("aria-selected", "true");
    await ctx.close();
  });
});
