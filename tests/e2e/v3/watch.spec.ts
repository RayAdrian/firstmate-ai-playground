import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousA11y } from "../../support";

// V3 (PRD §15 MD-1/MD-2). Media comes from tests/fixtures/media, never public/:
//  - the server reads the fixture manifests when the fm_test_media=fixtures cookie is set (FM_TEST_MODE only),
//  - the browser's /media/lessons/** requests are fulfilled from the same folder via page.route.
const FIXTURES = path.resolve(__dirname, "../../fixtures/media");
const WITH_MEDIA = "/lessons/l1-first-session";
const WITHOUT_MEDIA = "/lessons/l1-permissions";

const TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webp": "image/webp",
  ".vtt": "text/vtt",
  ".txt": "text/plain",
};

test.beforeEach(async ({ context, page, baseURL }) => {
  await context.addCookies([{ name: "fm_test_media", value: "fixtures", url: baseURL! }]);
  await page.route("**/media/lessons/**", async (route) => {
    const url = new URL(route.request().url());
    const file = path.join(FIXTURES, url.pathname.replace(/^\/media\//, ""));
    try {
      const body = await readFile(file);
      const contentType = TYPES[path.extname(file)] ?? "application/octet-stream";
      // Media elements issue Range requests; answer them the way a static file server does.
      const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers()["range"] ?? "");
      if (range) {
        const start = Number(range[1]);
        const end = range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
        await route.fulfill({
          status: 206,
          body: body.subarray(start, end + 1),
          headers: {
            "content-type": contentType,
            "content-range": `bytes ${start}-${end}/${body.length}`,
            "accept-ranges": "bytes",
          },
        });
        return;
      }
      await route.fulfill({ status: 200, body, headers: { "content-type": contentType, "accept-ranges": "bytes" } });
    } catch {
      await route.fulfill({ status: 404 });
    }
  });
});

const blocks = (page: Page) => page.getByTestId("media-block");
const alpha = (page: Page) => page.getByRole("region", { name: "Watch: Alpha fixture", exact: true });

async function canPlayH264(page: Page): Promise<boolean> {
  return page.evaluate(() => document.createElement("video").canPlayType('video/mp4; codecs="avc1.42E01E"') !== "");
}

test.describe("presence (MD-1)", () => {
  test("TC-V3-01 a lesson with media shows Watch blocks inside Concept, after the prose and before 'In your tool', in id order", async ({ page }) => {
    await page.goto(WITH_MEDIA);
    await expect(blocks(page)).toHaveCount(2);
    await expect(page.getByRole("heading", { level: 3, name: "Watch: Alpha fixture", exact: true })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 3, name: "Watch: Beta fixture", exact: true })).toHaveCount(1);
    await expect(page.getByRole("region", { name: "Watch: Alpha fixture", exact: true })).toHaveCount(1);
    await expect(page.locator("h3[id^=watch-]")).toHaveCount(2);
    const order = await page.evaluate(() => {
      const concept = document.querySelector("#concept")!.closest("section")!;
      const blocks = [...document.querySelectorAll('[data-testid="media-block"]')];
      const tools = document.querySelector("#tools")!;
      const prose = concept.querySelector("p, pre, ul")!;
      const follows = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      return {
        inside: blocks.every((b) => concept.contains(b)),
        afterProse: blocks.every((b) => follows(prose, b)),
        beforeTools: blocks.every((b) => follows(b, tools)),
        ordered: follows(blocks[0]!, blocks[1]!),
        h2s: [...document.querySelectorAll("h2")].map((h) => h.id).filter(Boolean),
      };
    });
    expect(order).toMatchObject({ inside: true, afterProse: true, beforeTools: true, ordered: true });
    expect(order.h2s).toEqual(expect.arrayContaining(["concept", "tools"]));
  });

  test("TC-V3-02 a lesson with no media renders no block and no empty heading", async ({ page }) => {
    await page.goto(WITHOUT_MEDIA);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(blocks(page)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /^Watch/ })).toHaveCount(0);
    await expect(page.locator("video")).toHaveCount(0);
  });

  test("TC-V3-03 the player is native with controls, poster, size and a default English captions track", async ({ page }) => {
    await page.goto(WITH_MEDIA);
    const video = alpha(page).locator("video");
    await expect(video).toHaveAttribute("controls", "");
    await expect(video).toHaveAttribute("playsinline", "");
    await expect(video).toHaveAttribute("preload", "none");
    await expect(video).toHaveAttribute("aria-labelledby", "watch-fx-alpha");
    await expect(video).toHaveAttribute("poster", "/media/lessons/l1-first-session/fx-alpha.webp");
    await expect(video).toHaveAttribute("width", "640");
    await expect(video).toHaveAttribute("height", "360");
    const track = video.locator("track");
    await expect(track).toHaveCount(1);
    await expect(track).toHaveAttribute("kind", "captions");
    await expect(track).toHaveAttribute("srclang", "en");
    await expect(track).toHaveAttribute("default", "");
    // Captions are on by default: the browser shows the default track.
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.textTracks[0]?.mode))
      .toBe("showing");
  });
});

test.describe("design conformance (DESIGN §6.3.2)", () => {
  test("TC-V3-12 one wrapper, eyebrow heading, meta line, framed video", async ({ page }) => {
    await page.goto(WITH_MEDIA);
    const wrapper = blocks(page).first().locator("xpath=..");
    await expect(wrapper).toHaveClass(/mt-8/);
    await expect(wrapper).toHaveClass(/space-y-10/);
    await expect(blocks(page).first()).not.toHaveCSS("background-color", "rgb(249, 249, 249)");
    const h3 = alpha(page).getByRole("heading", { level: 3, name: "Watch: Alpha fixture", exact: true });
    await expect(h3).toHaveAttribute("aria-label", "Watch: Alpha fixture");
    await expect(h3.locator("span").first()).toHaveAttribute("aria-hidden", "true");
    await expect(h3.locator("span").first()).toHaveText("Watch");
    await expect(alpha(page).locator("p").first()).toHaveText(
      "Terminal recording · 0:03 · No sound · Claude Code 2.1.0 · Recorded 1 Oct 2026",
    );
    await expect(alpha(page).locator("time")).toHaveAttribute("datetime", "PT3S");
    await expect(page.getByRole("region", { name: "Watch: Beta fixture" }).locator("p").first()).toHaveText(
      "Animation · 0:03 · No sound",
    );
    const video = alpha(page).locator("video");
    await expect(video).toHaveClass(/rounded-xl/);
    await expect(video).toHaveClass(/border/);
    await expect(video).toHaveCSS("background-color", "rgb(15, 23, 41)");
  });

  test("TC-V3-13 captions are at least 15px below md and keep the default size at md and up", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    await page.goto(WITH_MEDIA);
    const cue = () => alpha(page).locator("video").evaluate((v) => getComputedStyle(v, "::cue").fontSize);
    expect(parseFloat(await cue())).toBeGreaterThanOrEqual(15);
    await page.setViewportSize({ width: 1440, height: 900 });
    expect(parseFloat(await cue())).not.toBe(15);
  });
});

test.describe("transcript (MD-2)", () => {
  test("TC-V3-04 the transcript is a closed 'Transcript' disclosure with plain text", async ({ page }) => {
    await page.goto(WITH_MEDIA);
    const details = alpha(page).locator("details");
    const summary = details.locator("summary");
    await expect(summary).toHaveText("Transcript for Alpha fixture");
    expect((await summary.evaluate((el) => el.childNodes[1]?.textContent ?? "")).trim()).toBe("Transcript");
    expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(details).not.toHaveAttribute("open", "");
    await expect(details.getByText("A solid blue rectangle")).toBeHidden();
    await summary.click();
    await expect(details).toHaveAttribute("open", "");
    const panel = alpha(page).getByRole("region", { name: "Transcript for Alpha fixture" });
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("A solid blue rectangle is shown for three seconds.");
    // "<b>not markup</b>" in the file is shown as literal text, never parsed.
    await expect(panel).toContainText("<b>not markup</b>");
    await expect(panel.locator("b")).toHaveCount(0);
  });
});

test.describe("quiet playback (MD-2)", () => {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test(`TC-V3-05 no autoplay and no network fetch of the video (${reducedMotion})`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion });
      const mp4: string[] = [];
      page.on("request", (r) => {
        if (r.url().endsWith(".mp4")) mp4.push(r.url());
      });
      await page.goto(WITH_MEDIA);
      await expect(blocks(page)).toHaveCount(2);
      await page.waitForTimeout(1500);
      const state = await page.evaluate(() =>
        [...document.querySelectorAll("video")].map((v) => ({
          autoplayAttr: v.hasAttribute("autoplay"),
          paused: v.paused,
          currentTime: v.currentTime,
          preload: v.preload,
        })),
      );
      expect(state).toEqual([
        { autoplayAttr: false, paused: true, currentTime: 0, preload: "none" },
        { autoplayAttr: false, paused: true, currentTime: 0, preload: "none" },
      ]);
      expect(mp4).toEqual([]);
    });
  }

  test("TC-V3-06 a user-initiated play advances currentTime", async ({ page }) => {
    await page.goto(WITH_MEDIA);
    test.skip(!(await canPlayH264(page)), "this Chromium build has no H.264 decoder; play is verified in a codec-capable browser");
    const video = alpha(page).locator("video");
    await video.evaluate((v: HTMLVideoElement) => {
      v.muted = true;
    });
    // Headless Chromium has no clickable control bar, so the user gesture is a real Space keypress on the focused player.
    await video.focus();
    await page.keyboard.press("Space");
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 10_000 }).toBeGreaterThan(0.2);
  });
});

test.describe("layout and keyboard (MD-2)", () => {
  test("TC-V3-07 CLS stays under 0.05 on a media lesson", async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
          if (!e.hadRecentInput) w.__cls += e.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto(WITH_MEDIA);
    await expect(blocks(page)).toHaveCount(2);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    expect(cls).toBeLessThan(0.05);
  });

  for (const width of [360, 768, 1440]) {
    test(`TC-V3-08 no horizontal scroll and the box matches the manifest ratio at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(WITH_MEDIA);
      await expect(blocks(page)).toHaveCount(2);
      const box = await alpha(page).locator("video").boundingBox();
      const m = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(m.scroll).toBeLessThanOrEqual(m.client);
      expect(box).not.toBeNull();
      expect(box!.width / box!.height).toBeCloseTo(640 / 360, 1);
    });
  }

  test("TC-V3-09 the player and the transcript summary are keyboard operable with a visible focus ring", async ({ page }) => {
    await page.goto(WITH_MEDIA);
    const video = alpha(page).locator("video");
    const summary = alpha(page).locator("summary");

    // Tab steps through the native control bar first, so tab until the summary is reached.
    await video.focus();
    for (let i = 0; i < 12 && !(await summary.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press("Tab");
    }
    await expect(summary).toBeFocused();
    const ring = await summary.evaluate((el) => {
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
    });
    expect(ring.style).not.toBe("none");
    expect(ring.width).toBeGreaterThanOrEqual(2);

    await page.keyboard.press("Enter");
    await expect(alpha(page).locator("details")).toHaveAttribute("open", "");
    await page.keyboard.press("Space");
    await expect(alpha(page).locator("details")).not.toHaveAttribute("open", "");

    // The video itself is in the tab order (it is the first focusable stop of its block).
    await video.focus();
    await expect(video).toBeFocused();
    expect(await video.evaluate((v: HTMLVideoElement) => v.tabIndex)).toBeGreaterThanOrEqual(0);
  });

  test("TC-V3-10 Space toggles playback from the keyboard", async ({ page }) => {
    await page.goto(WITH_MEDIA);
    test.skip(!(await canPlayH264(page)), "this Chromium build has no H.264 decoder");
    const video = alpha(page).locator("video");
    await video.evaluate((v: HTMLVideoElement) => {
      v.muted = true;
    });
    await video.focus();
    await page.keyboard.press("Space");
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.paused), { timeout: 10_000 }).toBe(false);
    await page.keyboard.press("Space");
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`TC-V3-11 axe reports no serious or critical violations (${colorScheme}, transcript open)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(WITH_MEDIA);
      await expect(blocks(page)).toHaveCount(2);
      await expectNoSeriousA11y(page);
      await alpha(page).locator("summary").click();
      await expectNoSeriousA11y(page);
    });
  }
});
