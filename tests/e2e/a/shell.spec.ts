import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const serious = (results: Awaited<ReturnType<AxeBuilder["analyze"]>>) =>
  results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");

async function activeId(page: Page) {
  return page.evaluate(() => document.activeElement?.id ?? document.activeElement?.tagName ?? "");
}

test.describe("shell landmarks and skip link (D-2, DESIGN §5.1, §11.1)", () => {
  test("one banner, main[id=main][tabindex=-1], one contentinfo, one live region", async ({ page }) => {
    await page.goto("/curriculum");
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.getByRole("contentinfo")).toHaveCount(1);
    const main = page.getByRole("main");
    await expect(main).toHaveAttribute("id", "main");
    await expect(main).toHaveAttribute("tabindex", "-1");
    const live = page.locator("#fm-live");
    await expect(live).toHaveAttribute("role", "status");
    await expect(live).toHaveAttribute("aria-live", "polite");
    await expect(live).toHaveText("");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("skip link is the first tab stop, shows on focus, and moves focus to main", async ({ page }) => {
    await page.goto("/curriculum");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    const box = await skip.boundingBox();
    expect(box?.width).toBeGreaterThan(40);
    expect(box?.y).toBeGreaterThanOrEqual(0);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
    expect(await activeId(page)).toBe("main");
  });

  test("home link is named 'First Mate AI Playground'", async ({ page }) => {
    await page.goto("/curriculum");
    const home = page.getByRole("link", { name: "First Mate AI Playground" });
    await expect(home).toHaveAttribute("href", "/");
    await expect(home.locator("img")).toHaveAttribute("alt", "First Mate");
  });
});

test.describe("desktop nav (>= 1024px)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("six links, current page has aria-current, no menu button, one Main navigation", async ({ page }) => {
    await page.goto("/curriculum");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav).toHaveCount(1);
    for (const name of ["Curriculum", "Exercises", "Workflows", "News", "Bookmarks", "Progress"]) {
      await expect(nav.getByRole("link", { name })).toBeVisible();
    }
    await expect(nav.getByRole("link", { name: "Curriculum" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "News" })).not.toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();
  });

  test("/news/archive keeps News current; / activates nothing", async ({ page }) => {
    await page.goto("/news/archive");
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "News" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await page.goto("/");
    await expect(page.locator("header [aria-current='page']")).toHaveCount(0);
  });

  test("at 1024px all six links fit in one row with no page scroll, even in a wide font", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/curriculum");
    // Stress: a font wider than the macOS one, so a layout that only fits there fails here too.
    await page.addStyleTag({ content: 'header nav { font-family: "DejaVu Sans", Verdana, sans-serif !important; }' });
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link")).toHaveText(["Curriculum", "Exercises", "Workflows", "News", "Bookmarks", "Progress"]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
      true,
    );
  });

  test("at 768px the nav is collapsed into the Menu button, in a wide font too, with no page scroll", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto("/curriculum");
    await page.addStyleTag({ content: 'header, header * { font-family: "DejaVu Sans", Verdana, sans-serif !important; }' });
    await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
      true,
    );
  });
});

test.describe("mobile menu (< 1024px) (TC-A-28, TC-A-29)", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("Menu button discloses the nav; first link gets focus; Esc closes and refocuses the button", async ({ page }) => {
    await page.goto("/curriculum");
    const button = page.getByRole("button", { name: "Menu" });
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(button).toHaveAttribute("aria-controls", "mobile-nav");
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0); // closed panel is hidden

    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav).toHaveCount(1);
    await expect(nav.getByRole("link")).toHaveText(["Curriculum", "Exercises", "Workflows", "News", "Bookmarks", "Progress"]);
    await expect(nav.getByRole("link", { name: "Curriculum" })).toBeFocused();
    await expect(nav.getByRole("link", { name: "Curriculum" })).toHaveAttribute("aria-current", "page");

    await page.keyboard.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(button).toBeFocused();
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
  });

  test("choosing a link navigates and closes the menu", async ({ page }) => {
    await page.goto("/curriculum");
    const button = page.getByRole("button", { name: "Menu" });
    await button.click();
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "News" }).click();
    await expect(page).toHaveURL(/\/news$/);
    await expect(button).toHaveAttribute("aria-expanded", "false");
  });

  test("outside click closes it; growing to desktop closes it", async ({ page }) => {
    await page.goto("/curriculum");
    const button = page.getByRole("button", { name: "Menu" });
    await button.click();
    await page.getByRole("heading", { level: 1 }).click();
    await expect(button).toHaveAttribute("aria-expanded", "false");

    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await page.setViewportSize({ width: 1100, height: 740 });
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Curriculum" })).toBeVisible();
    await expect(button).toBeHidden();
  });

  test("brand fits in 360px: logo, label, and a 44px menu button on one row", async ({ page }) => {
    await page.goto("/curriculum");
    const header = await page.getByRole("banner").boundingBox();
    expect(header?.height).toBeLessThanOrEqual(61);
    const button = await page.getByRole("button", { name: "Menu" }).boundingBox();
    expect(button?.width).toBeGreaterThanOrEqual(44);
    expect(button?.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
      true,
    );
  });
});

test.describe("below 375px the label is visually hidden but the link keeps its name", () => {
  test.use({ viewport: { width: 360, height: 740 } });
  test("360 shows the logo only, 375 and wider show the label", async ({ page }) => {
    await page.goto("/curriculum");
    await expect(page.getByRole("link", { name: "First Mate AI Playground" })).toBeVisible();
    const label = page.getByText("AI Playground", { exact: true });
    expect((await label.boundingBox())?.width ?? 0).toBeLessThanOrEqual(1);
    await page.setViewportSize({ width: 375, height: 740 });
    expect((await label.boundingBox())?.width ?? 0).toBeGreaterThan(50);
    await page.setViewportSize({ width: 768, height: 740 });
    // The nav is collapsed into the menu up to lg, so the label has room and stays visible at 768.
    expect((await label.boundingBox())?.width ?? 0).toBeGreaterThan(50);
    const logo = await page.locator("header img").boundingBox();
    expect(Math.abs((logo?.width ?? 0) / (logo?.height ?? 1) - 825 / 169)).toBeLessThan(0.05); // never squashed
    await page.setViewportSize({ width: 1024, height: 740 });
    expect((await label.boundingBox())?.width ?? 0).toBeGreaterThan(50);
  });
});

test.describe("no horizontal page scroll (D-3.1)", () => {
  for (const width of [360, 768, 1024, 1440]) {
    for (const route of ["/", "/curriculum", "/this-route-does-not-exist"]) {
      test(`${route} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  }
});

test.describe("focus ring (D-2.2)", () => {
  test("2px accent ring with 2px offset on links and buttons", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/curriculum");
    await page.keyboard.press("Tab"); // skip link
    await page.keyboard.press("Tab"); // home link
    const style = await page.evaluate(() => {
      const cs = getComputedStyle(document.activeElement as Element);
      return { width: cs.outlineWidth, style: cs.outlineStyle, offset: cs.outlineOffset, color: cs.outlineColor };
    });
    expect(style).toEqual({ width: "2px", style: "solid", offset: "2px", color: "rgb(66, 75, 209)" });
  });

  test("dark scheme uses the lightened focus colour", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/curriculum");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const color = await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineColor);
    expect(color).toBe("rgb(159, 165, 255)");
  });
});

test.describe("dark mode follows the system preference (D-5)", () => {
  test("light and dark canvas, text and logo", async ({ page }) => {
    await page.goto("/curriculum");
    const read = () =>
      page.evaluate(() => ({
        bg: getComputedStyle(document.body).backgroundColor,
        fg: getComputedStyle(document.body).color,
        scheme: getComputedStyle(document.documentElement).colorScheme,
        logo: (document.querySelector("header img") as HTMLImageElement).currentSrc,
      }));
    await page.emulateMedia({ colorScheme: "light" });
    const light = await read();
    expect(light.bg).toBe("rgb(255, 255, 255)");
    expect(light.fg).toBe("rgb(40, 41, 67)");
    expect(light.logo).toMatch(/firstmate-logo\.svg$/);

    await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(async () => (await read()).logo).toMatch(/firstmate-logo-dark\.svg$/);
    const dark = await read();
    expect(dark.bg).toBe("rgb(18, 19, 31)");
    expect(dark.fg).toBe("rgb(237, 237, 243)");
    expect(dark.scheme).toBe("dark");
    expect(dark.logo).toMatch(/firstmate-logo-dark\.svg$/);
  });

  test("there is no theme toggle", async ({ page }) => {
    await page.goto("/curriculum");
    await expect(page.getByRole("button", { name: /theme|dark|light/i })).toHaveCount(0);
  });
});

test.describe("reduced motion (D-2)", () => {
  test("transition and animation durations collapse", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/curriculum");
    const durations = await page.evaluate(() => {
      const link = document.querySelector("header nav a") as HTMLElement;
      return parseFloat(getComputedStyle(link).transitionDuration) * 1000;
    });
    expect(durations).toBeLessThanOrEqual(1);
  });
});

test.describe("fonts (D-1.1, D-4.2)", () => {
  test("Satoshi is self-hosted, loaded, and no third-party font host is contacted", async ({ page }) => {
    const external: string[] = [];
    const fontFiles: string[] = [];
    page.on("request", (req) => {
      const url = new URL(req.url());
      if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") external.push(req.url());
      if (/\.woff2?(\?|$)/.test(url.pathname)) fontFiles.push(url.pathname);
    });
    await page.goto("/curriculum");
    await page.evaluate(() => document.fonts.ready);
    expect(external).toEqual([]);
    expect(fontFiles.length).toBeGreaterThan(0);

    const families = await page.evaluate(() => ({
      body: getComputedStyle(document.body).fontFamily,
      h1: getComputedStyle(document.querySelector("h1") as Element).fontFamily,
      loaded: [...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.family}:${f.weight}`),
    }));
    expect(families.body.toLowerCase()).toContain("satoshi");
    expect(families.h1.toLowerCase()).toContain("satoshi");
    expect(families.loaded.some((f) => /satoshi/i.test(f))).toBe(true);
  });

  test("the base weight is preloaded and the fallback is metric-adjusted (no layout shift on swap)", async ({ page }) => {
    const response = await page.goto("/curriculum");
    const html = (await response?.text()) ?? "";
    // `next dev` streams the preload as a flight hint; `next start` emits <link rel="preload" as="font">.
    expect(html).toMatch(/rel="preload"[^>]*as="font"|:HL\[[^\]]*\.woff2[^\]]*font\/woff2/);
    const adjusted = await page.evaluate(() =>
      [...document.styleSheets].some((sheet) =>
        [...sheet.cssRules].some((r) => r.cssText.includes("size-adjust") || r.cssText.includes("ascent-override")),
      ),
    );
    expect(adjusted).toBe(true);
  });
});

test.describe("404 (DESIGN §6.9)", () => {
  test("unknown routes return 404 inside the shell with the branded view", async ({ page }) => {
    const response = await page.goto("/definitely-not-a-page");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to curriculum" })).toHaveAttribute("href", "/curriculum");
    await expect(page.getByRole("link", { name: "Home", exact: true })).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("link", { name: "Skip to content" })).toHaveCount(1);
    await expect(page).toHaveTitle(/not found/i);
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`axe: 404 and shell are clean (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      for (const route of ["/definitely-not-a-page", "/curriculum"]) {
        await page.goto(route);
        const results = await new AxeBuilder({ page }).analyze();
        expect(serious(results), JSON.stringify(serious(results), null, 2)).toEqual([]);
      }
    });
  }

  test("axe with the mobile menu open at 360px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/curriculum");
    await page.getByRole("button", { name: "Menu" }).click();
    const results = await new AxeBuilder({ page }).analyze();
    expect(serious(results), JSON.stringify(serious(results), null, 2)).toEqual([]);
  });
});

test.describe("hit targets (TC-A-30)", () => {
  test("nav links are at least 24px tall on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/curriculum");
    const links = page.getByRole("navigation", { name: "Main" }).getByRole("link");
    for (let i = 0; i < (await links.count()); i++) {
      const box = await links.nth(i).boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(24);
      expect(box?.width).toBeGreaterThanOrEqual(24);
    }
  });

  test.describe("touch", () => {
    test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });
    test("menu button and menu links are at least 44px", async ({ page }) => {
      await page.goto("/curriculum");
      const button = page.getByRole("button", { name: "Menu" });
      const b = await button.boundingBox();
      expect(b?.width).toBeGreaterThanOrEqual(44);
      expect(b?.height).toBeGreaterThanOrEqual(44);
      await button.tap();
      const links = page.getByRole("navigation", { name: "Main" }).getByRole("link");
      for (let i = 0; i < (await links.count()); i++) {
        expect((await links.nth(i).boundingBox())?.height).toBeGreaterThanOrEqual(44);
      }
    });
  });
});

test.describe("client bundles stay free of shiki (review N1)", () => {
  test("no shiki code is shipped to the browser on shell, 404 and error-boundary routes", async ({ page }) => {
    const offenders: string[] = [];
    page.on("response", async (res) => {
      const url = res.url();
      if (!/\.js(\?|$)/.test(new URL(url).pathname)) return;
      const body = await res.text().catch(() => "");
      if (/shiki/i.test(url) || /createHighlighter|ShikiError|@shikijs/.test(body)) offenders.push(url);
    });
    for (const route of ["/", "/curriculum", "/definitely-not-a-page"]) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
    }
    expect(offenders).toEqual([]);
  });
});

test.describe("brand link hit area (C-6)", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });
  test("home link is at least 44px tall on coarse pointers", async ({ page }) => {
    await page.goto("/curriculum");
    const box = await page.getByRole("link", { name: "First Mate AI Playground" }).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });
});
