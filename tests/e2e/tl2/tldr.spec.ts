import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousA11y } from "../../support";

// TL2 (PRD §19: TL-5..TL-9, TL-14..TL-16). Fixture lessons (tests/fixtures/content/content-valid):
//   l2-memory                         the only lesson with a tldr (per-tool, one point with literal markup)
//   l1-first-session, l1-permissions  no tldr
// The video comes from tests/e2e/tl2/fixtures, chosen by the fm_test_media cookie (FM_TEST_MODE only):
//   tl2        a FRESH tldr video (hash matches) plus a section 15 item (TL-16)
//   tl2-stale  a tldr video whose source_hash does not match the lesson (TL-8)
//   (none)     no video at all (reads public/, which has no l2-memory video)
// The browser's /media/lessons/** requests are fulfilled from tests/e2e/tl2/fixtures/media.
const FIXTURES = path.resolve(__dirname, "./fixtures/media");
const FIRST = "/lessons/l2-memory";
const FIRST_SESSION = "/lessons/l1-first-session";
const PERMISSIONS = "/lessons/l1-permissions";

const TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webp": "image/webp",
  ".vtt": "text/vtt",
  ".txt": "text/plain",
};

test.beforeEach(async ({ context, page, baseURL }) => {
  await context.addCookies([{ name: "fm_test_media", value: "tl2", url: baseURL! }]);
  await page.route("**/media/lessons/**", async (route) => {
    const url = new URL(route.request().url());
    const file = path.join(FIXTURES, url.pathname.replace(/^\/media\//, ""));
    try {
      const body = await readFile(file);
      const contentType = TYPES[path.extname(file)] ?? "application/octet-stream";
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

const card = (page: Page) => page.getByTestId("tldr-card");

async function canPlayH264(page: Page): Promise<boolean> {
  return page.evaluate(() => document.createElement("video").canPlayType('video/mp4; codecs="avc1.42E01E"') !== "");
}

test.describe("text card (TL-5, TL-6)", () => {
  test("TL-5 the card sits after the header and before Concept, replacing the hr, with 3 points in order", async ({ page }) => {
    await page.goto(FIRST);
    await expect(card(page)).toBeVisible();
    await expect(card(page).getByRole("heading", { level: 2, name: "TL;DR" })).toHaveAttribute("id", "tldr");
    const points = card(page).locator("ul#tldr-points > li");
    await expect(points).toHaveCount(3);
    await expect(points.nth(0)).toContainText("Memory files are plain text");
    await expect(points.nth(2)).toContainText("Commit before you start");
    await expect(points.nth(2).locator("code")).toHaveText("git");
    await expect(card(page).getByRole("heading", { level: 3, name: "Try this" })).toBeVisible();

    const order = await page.evaluate(() => {
      const q = (s: string) => document.querySelector(s);
      const els = [
        q("h1"),
        q("section[aria-labelledby=tldr]"),
        q("section[aria-labelledby=concept]"),
        q('[role="tablist"][aria-label="Tool"]'),
        q("section[aria-labelledby=differences]"),
        q('nav[aria-label="Lesson"]'),
      ];
      if (els.some((e) => !e)) return null;
      return els.slice(1).map((el, i) => Boolean(els[i]!.compareDocumentPosition(el!) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    expect(order).toEqual([true, true, true, true, true]);
    await expect(page.locator("article > hr")).toHaveCount(0);
  });

  test("TL-5 the right rail lists TL;DR first (1440)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(FIRST);
    const links = page.getByRole("navigation", { name: "On this lesson" }).getByRole("link");
    await expect(links.first()).toHaveText("TL;DR");
    await expect(links.first()).toHaveAttribute("href", "#tldr");
    await expect(links.nth(1)).toHaveText("Concept");
  });

  test("TL-5 points are plain text plus code spans: markup and links stay literal", async ({ page }) => {
    await page.goto(FIRST);
    const first = card(page).locator("ul#tldr-points > li").first();
    await expect(first).toContainText("<b>x</b> and [a](b) stay literal.");
    await expect(first.locator("b, a")).toHaveCount(0);
    await expect(card(page).locator("ul#tldr-points > li").nth(1).locator("code").first()).toHaveText("CLAUDE.md");
  });

  test("TL-6 per-tool Try this is two blocks, Claude Code then Codex CLI, each copying its own text", async ({ page, context, baseURL }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL! });
    await page.goto(FIRST);
    const figs = card(page).getByRole("figure");
    await expect(figs).toHaveCount(2);
    await expect(figs.nth(0)).toContainText("Claude Code");
    await expect(figs.nth(1)).toContainText("Codex CLI");
    await expect(card(page).getByText("Claude Code: type it into the agent. Codex CLI: run it in your terminal.")).toBeVisible();
    await card(page).getByRole("button", { name: "Copy code: Claude Code" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "Use a subagent to run the tests and report only the failures.",
    );
    await card(page).getByRole("button", { name: "Copy code: Codex CLI" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('codex exec "Run the tests and report only the failures."');
  });

  test("TL-6 switching the tool tab, or ?tool=codex, changes nothing inside the card", async ({ page }) => {
    await page.goto(FIRST);
    const before = await card(page).innerHTML();
    await page.getByRole("tablist", { name: "Tool" }).getByRole("tab", { name: "Codex CLI" }).click();
    expect(await card(page).innerHTML()).toBe(before);
    await page.goto(`${FIRST}?tool=codex`);
    expect(await card(page).innerHTML()).toBe(before);
  });
});

test.describe("curriculum (TL-7)", () => {
  test("the first point replaces the objective for a lesson with a tldr, and the objective stays otherwise", async ({ page }) => {
    await page.goto("/curriculum");
    const row = (title: string) => page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 3, name: title }) });
    const withTldr = row("Memory");
    await expect(withTldr).toContainText("Memory files are plain text: <b>x</b> and [a](b) stay literal.");
    await expect(withTldr).not.toContainText("Keep knowledge between sessions.");
    await expect(withTldr).not.toContainText("TL;DR");
    await expect(row("Your first agent session")).toContainText("Run an interactive session in both tools.");
    await expect(row("Permissions and sandboxing")).toContainText("Control what the agent may run.");
  });

  for (const width of [360, 768, 1440]) {
    test(`no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/curriculum");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await page.goto(FIRST);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });
  }
});

test.describe("missing, stale or absent (TL-8)", () => {
  test("no tldr: no card, no empty h2, no rail entry, the hr stays", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const url of [PERMISSIONS, FIRST_SESSION]) {
      await page.goto(url);
      await expect(card(page)).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 2, name: "TL;DR" })).toHaveCount(0);
      await expect(page.getByRole("navigation", { name: "On this lesson" }).getByRole("link", { name: "TL;DR" })).toHaveCount(0);
      await expect(page.locator("article > hr")).toHaveCount(1);
    }
  });

  test("a tldr without a video renders text only: no row, no player, no error text", async ({ page, context }) => {
    await context.clearCookies({ name: "fm_test_media" });
    await page.goto(FIRST);
    await expect(card(page)).toBeVisible();
    await expect(card(page).locator("summary, video, details")).toHaveCount(0);
    await expect(card(page)).not.toContainText(/error|missing|unavailable/i);
  });

  test("a stale video (hash differs from the lesson's tldr) renders text only", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "fm_test_media", value: "tl2-stale", url: baseURL! }]);
    await page.goto(FIRST);
    await expect(card(page)).toBeVisible();
    await expect(card(page).locator("#tldr-video-toggle, video")).toHaveCount(0);
    await expect(card(page).locator("ul#tldr-points > li")).toHaveCount(3);
  });
});

test.describe("accessibility (TL-9)", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`axe: no serious violations with the video open, ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(FIRST);
      await page.locator("#tldr-video-toggle").click();
      await card(page).locator("#tldr-transcript-toggle").click();
      await expectNoSeriousA11y(page);
    });
  }

  test("keyboard: the toggle opens with Enter, then Tab reaches the video and Read instead in DOM order", async ({ page }) => {
    await page.goto(FIRST);
    // Let hydration finish first: under load, a key press during hydration can be lost.
    await page.waitForLoadState("networkidle");
    await page.locator("#tldr-video-toggle").focus();
    await page.keyboard.press("Enter");
    await expect(card(page).locator("details").first()).toHaveAttribute("open", "");
    await page.keyboard.press("Tab");
    await expect(card(page).locator("video")).toBeFocused();
    const order = await page.evaluate(() => {
      const c = document.querySelector("[data-testid=tldr-card]")!;
      const ids = ["#tldr-video-toggle", "video", "a[href='#tldr-points']", "#tldr-transcript-toggle", "button"];
      const els = ids.map((s) => c.querySelector(s)!);
      return els.slice(1).map((el, i) => Boolean(els[i]!.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    expect(order).toEqual([true, true, true, true]);
  });
});

test.describe("video (TL-14, TL-15, TL-16)", () => {
  for (const motion of ["reduce", "no-preference"] as const) {
    test(`TL-14 closed on load, quiet after opening, captions on at play (${motion})`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: motion });
      await page.goto(FIRST);
      const row = card(page).locator("details").first();
      await expect(row).not.toHaveAttribute("open", "");
      await expect(card(page).locator("#tldr-video-toggle")).toContainText("TL;DR video");
      await expect(card(page).locator("#tldr-video-toggle")).toContainText("0:31 · No sound");
      await expect(card(page).locator("#tldr-video-toggle")).not.toContainText(/watch/i);
      const thumb = card(page).locator("#tldr-video-toggle img");
      await expect(thumb).toBeVisible();
      expect(await thumb.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);

      await card(page).locator("#tldr-video-toggle").click();
      const video = card(page).locator("video");
      await expect(video).toBeVisible();
      for (const a of ["autoplay", "loop", "muted"]) await expect(video).not.toHaveAttribute(a, /.*/);
      await expect(video).toHaveAttribute("preload", "none");
      await expect(video).toHaveAttribute("poster", /tldr\.webp$/);
      await expect(video).toHaveAttribute("aria-label", "TL;DR video: Memory");
      await page.waitForTimeout(3000);
      const state = await video.evaluate((v: HTMLVideoElement) => ({ paused: v.paused, t: v.currentTime }));
      expect(state).toEqual({ paused: true, t: 0 });

      if (await canPlayH264(page)) {
        await video.evaluate((v: HTMLVideoElement) => {
          v.muted = true;
          return v.play();
        });
        await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.textTracks[0]?.mode)).toBe("showing");
      }
    });
  }

  // With JavaScript off, Next's streamed Suspense boundary (the lesson loading.tsx) never swaps in, for every lesson and
  // independent of the card, so a scripting-disabled browser cannot be driven here. The card's no-JS promise is that the
  // row, player and transcript are native details/video elements in the server HTML, with no script needed to open them.
  test("TL-14 the server HTML has native details, a quiet player and the transcript, so it works without JS", async ({ page }) => {
    const res = await page.request.get(FIRST, { headers: { cookie: "fm_test_media=tl2" } });
    const html = await res.text();
    const cardHtml = html.slice(html.indexOf('data-testid="tldr-card"'), html.indexOf('aria-labelledby="concept"'));
    expect(cardHtml).toContain('<details class="group/video');
    expect(cardHtml).toContain('<summary id="tldr-video-toggle"');
    expect(cardHtml).toMatch(/<video [^>]*preload="none"/);
    expect(cardHtml).toMatch(/<track kind="captions" srcLang="en"[^>]* default/i);
    expect(cardHtml).toContain('<summary id="tldr-transcript-toggle"');
    expect(cardHtml).toContain("Title card: fixture");
    expect(cardHtml).toContain('href="#tldr-points"');
    expect(cardHtml).not.toMatch(/autoplay|<details[^>]* open/i);
  });

  test("TL-15 Read instead sits under the player above Transcript and focuses the points list", async ({ page }) => {
    await page.goto(FIRST);
    await card(page).locator("#tldr-video-toggle").click();
    const read = card(page).getByRole("link", { name: "Read instead" });
    await expect(read).toBeVisible();
    const [vb, rb, tb] = await Promise.all([
      card(page).locator("video").boundingBox(),
      read.boundingBox(),
      card(page).locator("#tldr-transcript-toggle").boundingBox(),
    ]);
    expect(vb!.y + vb!.height).toBeLessThanOrEqual(rb!.y);
    expect(rb!.y + rb!.height).toBeLessThanOrEqual(tb!.y + 1);
    await read.click();
    await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe("tldr-points");
  });

  test("TL-15 the transcript is plain text", async ({ page }) => {
    await page.goto(FIRST);
    await card(page).locator("#tldr-video-toggle").click();
    await card(page).locator("#tldr-transcript-toggle").click();
    await expect(card(page).getByRole("region", { name: "Transcript for TL;DR video" })).toContainText("Point 1 of 3: fixture point one.");
  });

  test("TL-16 a lesson with a section 15 item and a tldr renders one Watch item and one TL;DR player", async ({ page }) => {
    await page.goto(FIRST);
    await expect(page.getByTestId("media-block")).toHaveCount(1);
    await expect(page.getByRole("region", { name: "Watch: Alpha fixture", exact: true })).toBeVisible();
    await expect(page.locator("video")).toHaveCount(2);
    await expect(card(page).locator("video")).toHaveCount(1);
    await expect(page.getByTestId("media-block").getByText("TL;DR")).toHaveCount(0);
    await expect(page.getByTestId("media-block").locator("video")).toHaveCount(1);
  });
});
