import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { collectConsole, setServerNow } from "../../support";
import { PROGRESS_STORAGE_KEY } from "../../../src/lib/contracts/progress";
import { REPO_URL } from "../../../src/lib/contracts";
import {
  MARK,
  NOW,
  PREFIX,
  buildFixtures,
  clearFixtures,
  pickLessons,
  seedFixtures,
  type FixtureLesson,
} from "./support";

// W2 e2e: PRD §16 WF-30..WF-40 and WF-39a. The workflow rows are this spec's own fixtures (slug prefix `w2fx-`,
// title mark "W2FX"), inserted with the service role and removed afterwards; every index URL carries `q=w2fx`
// so other workflow rows (W1's fixtures, real content) never change a count. One serial block = one worker.
test.describe.configure({ mode: "serial" });

let related: FixtureLesson;
let unrelated: FixtureLesson;

test.beforeAll(async () => {
  ({ related, unrelated } = await pickLessons());
  await seedFixtures(buildFixtures(related));
});

test.afterAll(async () => {
  await clearFixtures();
});

test.beforeEach(async ({ context, baseURL }) => {
  await setServerNow(context, baseURL!, NOW);
});

const Q = "q=w2fx";
const INDEX = `/workflows?${Q}`;
const PAGE = (slug: string, query = "") => `/workflows/${PREFIX}${slug}${query}`;
const WIDTHS = [360, 768, 1440] as const;

async function cardTitles(page: Page): Promise<string[]> {
  return page.getByRole("list").filter({ has: page.getByRole("heading", { level: 3 }) }).first().getByRole("heading", { level: 3 }).allTextContents();
}

/** Polls: after a client-side navigation the URL changes before the new list has rendered. */
async function expectTitles(page: Page, expected: string[]) {
  await expect.poll(() => cardTitles(page)).toEqual(expected);
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function axeBlocking(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const blocking = violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(blocking).toEqual([]);
}

test.describe("WF-30 index", () => {
  test("heading, title, search, Share link, count and ordering", async ({ page }) => {
    await page.goto(INDEX);
    await expect(page).toHaveTitle("Workflows · First Mate AI Playground");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "Workflows" })).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Search workflows" })).toHaveValue("w2fx");
    const share = page.getByRole("link", { name: /^Share/ });
    await expect(share).toHaveAttribute("href", `${REPO_URL}/blob/main/CONTRIBUTING.md#share-a-workflow`);
    await expect(share).toHaveAttribute("target", "_blank");
    await expect(share).toHaveAttribute("rel", "noopener noreferrer");
    // 8 listed (the 181-day and the removed one are not), newest verified first.
    await expect(page.getByText("8 workflows", { exact: true })).toBeVisible();
    await expectTitles(page, [
      `${MARK} Plan before code`,
      `${MARK} Hook guard`,
      `${MARK} Prompt only review`,
      `${MARK} Extra related`,
      `${MARK} Script body`,
      `${MARK} Aged 60 days`,
      `${MARK} Aged 61 days`,
      `${MARK} Aged 180 days`,
    ]);
  });

  test("a card shows tool badges, setup kinds or Prompt only, stack chips, verified date and author", async ({ page }) => {
    await page.goto(INDEX);
    const both = page.getByRole("listitem").filter({ hasText: `${MARK} Plan before code` });
    await expect(both.getByRole("link", { name: `${MARK} Plan before code` })).toHaveAttribute("href", `/workflows/${PREFIX}both`);
    await expect(both).toContainText("Claude Code");
    await expect(both).toContainText("Codex CLI");
    await expect(both).toContainText("Context file");
    await expect(both).toContainText("Config");
    await expect(both).toContainText("Next.js");
    await expect(both).toContainText("TypeScript");
    await expect(both).toContainText("Verified 25 Sep 2026");
    await expect(both).toContainText("by Ada Lovelace");
    const promptOnly = page.getByRole("listitem").filter({ hasText: `${MARK} Prompt only review` });
    await expect(promptOnly).toContainText("Prompt only");
    await expect(promptOnly).toContainText("Codex CLI");
    await expect(promptOnly).not.toContainText("Claude Code");
    // The problem is clamped to 2 lines visually, and the full text is still in the DOM.
    const problem = promptOnly.locator("p.line-clamp-2");
    await expect(problem).toHaveText("Reviews skip the risky parts of a diff because the reviewer prompt is too vague.");
  });

  test("the whole card is one link to the page", async ({ page }) => {
    await page.goto(INDEX);
    await page.getByRole("listitem").filter({ hasText: `${MARK} Hook guard` }).click({ position: { x: 20, y: 80 } });
    await expect(page).toHaveURL(new RegExp(`/workflows/${PREFIX}claude$`));
    await expect(page.getByRole("heading", { level: 1, name: `${MARK} Hook guard` })).toBeVisible();
  });
});

test.describe("WF-31 filters", () => {
  test("tool=codex&use=review shows exactly the matches, and removing the use chip restores the tool result", async ({ page }) => {
    await page.goto(`/workflows?${Q}&tool=codex&use=review`);
    await expect(page.getByText("2 workflows", { exact: true })).toBeVisible();
    await expectTitles(page, [`${MARK} Plan before code`, `${MARK} Prompt only review`]);
    await page.getByRole("link", { name: "Remove filter: Review" }).click();
    await expect(page).toHaveURL(new RegExp(`/workflows\\?tool=codex&${Q}$`));
    await expectTitles(page, [
      `${MARK} Plan before code`,
      `${MARK} Prompt only review`,
      `${MARK} Extra related`,
    ]);
  });

  test("repeated values OR, different params AND, level filters by the related lesson's level", async ({ page }) => {
    await page.goto(`/workflows?${Q}&use=testing&use=automation`);
    await expectTitles(page, [`${MARK} Hook guard`, `${MARK} Extra related`]);
    await page.goto(`/workflows?${Q}&stack=react&stack=node&tool=claude`);
    await expectTitles(page, [`${MARK} Hook guard`, `${MARK} Extra related`]);
    await page.goto(`/workflows?${Q}&level=${related.level}`);
    await expect(page.getByText("4 workflows", { exact: true })).toBeVisible();
    await page.goto(`/workflows?${Q}&lesson=${related.slug}`);
    await expect(page.getByText("4 workflows", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: `Remove filter: Lesson ${related.slug}` })).toBeVisible();
  });

  test("unknown values are ignored, not errors", async ({ page }) => {
    await page.goto(`/workflows?${Q}&tool=gemini&use=nonsense&level=9&stack=%3Cb%3E&lesson=Not%20A%20Slug`);
    await expect(page.getByText("8 workflows", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Remove filter: / })).toHaveCount(1); // only the search chip
  });

  test("q matches title or problem case-insensitively, and % and _ are literal characters", async ({ page }) => {
    await page.goto("/workflows?q=PROTECTED%20FILES");
    await expectTitles(page, [`${MARK} Hook guard`]);
    await page.goto("/workflows?q=%25");
    await expect(page.getByRole("region", { name: "No workflows match these filters" })).toBeVisible();
    await page.goto("/workflows?q=w2fx_aged");
    await expect(page.getByRole("region", { name: "No workflows match these filters" })).toBeVisible();
  });

  test("no match: the empty state has the only Clear filters link, which clears everything", async ({ page }) => {
    await page.goto(`/workflows?${Q}&tool=claude&stack=any`);
    const empty = page.getByRole("region", { name: "No workflows match these filters" });
    await expect(empty).toBeVisible();
    await expect(page.getByRole("link", { name: "Clear filters" })).toHaveCount(1);
    await empty.getByRole("link", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(/\/workflows$/);
  });

  test("the filter form submits as a GET without script and leaves empty fields out of the URL", async ({ page }) => {
    await page.goto(INDEX);
    const form = page.getByRole("form", { name: "Filters" });
    await form.getByLabel("Tool", { exact: true }).selectOption("codex");
    await form.getByRole("checkbox", { name: "Review", exact: true }).check();
    await form.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(new RegExp(`/workflows\\?${Q}&tool=codex&use=review$`));
    await expect(page.getByRole("heading", { level: 2, name: "Results" })).toBeFocused();
    await expect(form.getByLabel("Tool", { exact: true })).toHaveValue("codex");
    await expect(form.getByRole("checkbox", { name: "Review", exact: true })).toBeChecked();
  });

  test("the search box submits with Enter and with the Search button", async ({ page }) => {
    await page.goto("/workflows");
    const box = page.getByRole("searchbox", { name: "Search workflows" });
    await box.fill("w2fx hook");
    await box.press("Enter");
    await expect(page).toHaveURL(/q=w2fx\+hook/);
    await expectTitles(page, [`${MARK} Hook guard`]);
    await box.fill("w2fx script");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/q=w2fx\+script/);
  });

  test("below lg the filters sit behind a Filters (N) disclosure; at lg the column is open", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`/workflows?${Q}&tool=codex&use=review`);
    const toggle = page.getByRole("button", { name: "Filters (2)" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("button", { name: "Apply filters" })).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("button", { name: "Apply filters" })).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByRole("button", { name: /^Filters/ })).toBeHidden();
    await expect(page.getByRole("button", { name: "Apply filters" })).toBeVisible();
  });
});

test.describe("WF-32, WF-40 freshness", () => {
  test("ages 60/61/180 are listed with the right badge; 181 is hidden behind Show archived (1)", async ({ page }) => {
    await page.goto(INDEX);
    const card = (days: number) => page.getByRole("listitem").filter({ hasText: `${MARK} Aged ${days} days` });
    await expect(card(60)).not.toContainText("May be outdated");
    await expect(card(60)).toContainText("Verified");
    await expect(card(61)).toContainText("May be outdated");
    await expect(card(180)).toContainText("May be outdated");
    await expect(card(181)).toHaveCount(0);
    const showArchived = page.getByRole("link", { name: "Show archived (1)" });
    await showArchived.click();
    await expect(page).toHaveURL(new RegExp(`/workflows\\?${Q}&archived=1$`));
    await expect(card(181)).toContainText("Archived");
    await expect(page.getByText("9 workflows", { exact: true })).toBeVisible();
  });

  test("the boundaries move with the server clock (setServerNow)", async ({ page, context, baseURL }) => {
    // A day later, the 60-day workflow is 61 days old (outdated) and the 180-day one is 181 (archived).
    await setServerNow(context, baseURL!, "2026-10-01T13:00:00+08:00");
    await page.goto(INDEX);
    const card = (days: number) => page.getByRole("listitem").filter({ hasText: `${MARK} Aged ${days} days` });
    await expect(card(60)).toContainText("May be outdated");
    await expect(card(180)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Show archived (2)" })).toBeVisible();
  });
});

test.describe("WF-33..WF-37 workflow page", () => {
  test("header, document title and the five sections in order", async ({ page }) => {
    await page.goto(PAGE("both"));
    await expect(page).toHaveTitle(`${MARK} Plan before code · Workflow · First Mate AI Playground`);
    const crumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumb.getByRole("link", { name: "Workflows" })).toHaveAttribute("href", "/workflows");
    await expect(crumb).toContainText(`${MARK} Plan before code`);
    await expect(page.getByText("Workflow", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: `${MARK} Plan before code` })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(["Result", "Setup", "Prompt", "Steps", "Why it works"]);
    const result = page.getByRole("region", { name: "Result" });
    await expect(result.getByRole("heading", { level: 3 })).toHaveText(["Before", "After"]);
    await expect(page.getByRole("region", { name: "Steps" }).getByRole("listitem")).toHaveCount(3);
    await expect(page.getByRole("region", { name: "Why it works" })).toContainText("assumptions visible");
  });

  test("WF-34 Reviewed and Verified are separate elements", async ({ page }) => {
    await page.goto(PAGE("both"));
    const reviewed = page.getByText("Reviewed by stewards");
    await expect(reviewed).toBeVisible();
    const reviewedWrap = reviewed.locator("xpath=..");
    await expect(reviewedWrap).toContainText("26 Sep 2026");
    expect((await reviewedWrap.innerText()).toLowerCase()).not.toContain("verified");
    await expect(page.getByText("Author-verified on Claude Code v2.1.0, Codex CLI v0.40.0 · 25 Sep 2026")).toBeVisible();
  });

  test("Setup blocks are labelled with their path and copy works", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(PAGE("both"));
    const setup = page.getByRole("region", { name: "Setup" });
    await expect(setup.getByRole("figure").filter({ hasText: "AGENTS.md" })).toBeVisible();
    await setup.getByRole("button", { name: "Copy code: AGENTS.md" }).click();
    await expect(page.locator("#fm-live")).toHaveText("Copied");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("Plan first.");
  });

  test("WF-36 both tools: tabs, tool-tagged blocks only in their tab, ?tool= and the saved preference", async ({ page }) => {
    await page.goto(PAGE("both"));
    const setupTabs = page.getByRole("tablist", { name: "Setup tool" });
    await expect(setupTabs.getByRole("tab")).toHaveText(["Claude Code", "Codex CLI"]);
    await expect(page.getByRole("tablist", { name: "Prompt tool" })).toBeVisible();
    const setup = page.getByRole("region", { name: "Setup" });
    await expect(setup.getByRole("figure").filter({ hasText: ".claude/settings.json" })).toBeVisible();
    await expect(setup.getByRole("figure").filter({ hasText: "AGENTS.md" })).toBeVisible();
    await expect(setup.getByRole("figure").filter({ hasText: ".codex/config.toml" })).toHaveCount(0);
    await setupTabs.getByRole("tab", { name: "Codex CLI" }).click();
    await expect(page).toHaveURL(/tool=codex/);
    await expect(setup.getByRole("figure").filter({ hasText: ".codex/config.toml" })).toBeVisible();
    await expect(setup.getByRole("figure").filter({ hasText: ".claude/settings.json" })).toHaveCount(0);
    await expect(setup.getByRole("figure").filter({ hasText: "AGENTS.md" })).toBeVisible();
    // The Prompt tabs follow the same selection, and show the Codex-specific prompt.
    await expect(page.getByRole("tablist", { name: "Prompt tool" }).getByRole("tab", { name: "Codex CLI" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("region", { name: "Prompt" })).toContainText("CODEX ONLY: plan, then stop.");
    // The choice is saved as prefs.tool, so a plain visit opens on Codex CLI.
    const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "{}"), PROGRESS_STORAGE_KEY);
    expect(saved.prefs.tool).toBe("codex");
    await page.goto(PAGE("both"));
    await expect(page.getByRole("tablist", { name: "Setup tool" }).getByRole("tab", { name: "Codex CLI" })).toHaveAttribute("aria-selected", "true");
    // An explicit ?tool=claude wins over the saved preference.
    await page.goto(PAGE("both", "?tool=claude"));
    await expect(page.getByRole("tablist", { name: "Setup tool" }).getByRole("tab", { name: "Claude Code" })).toHaveAttribute("aria-selected", "true");
  });

  test("WF-36 one tool: no tabs and no tablist; a prompt-only workflow says so", async ({ page }) => {
    await page.goto(PAGE("claude"));
    await expect(page.getByRole("tablist")).toHaveCount(0);
    await expect(page.getByRole("tab")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Setup" }).getByRole("figure")).toHaveCount(2);
    await expect(page.getByText("Author-verified on Claude Code v2.1.0 · ")).toBeVisible();
    await page.goto(PAGE("codex"));
    await expect(page.getByRole("tablist")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Setup" })).toContainText("No setup files");
    await expect(page.getByText(/^Author-verified on Codex CLI v0\.40\.0/)).toBeVisible();
  });

  test("WF-35 the At a glance rail is sticky at 1440, with the report link and the section list", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PAGE("both"));
    const rail = page.getByRole("complementary", { name: "At a glance" });
    await expect(rail).toBeVisible();
    await expect(rail).toContainText("Claude Code");
    await expect(rail).toContainText("Context file");
    await expect(rail).toContainText("TypeScript");
    await expect(rail.getByRole("link", { name: `Builds on Lesson ${related.number}: ${related.title}` })).toHaveAttribute("href", `/lessons/${related.slug}`);
    const report = rail.getByRole("link", { name: /^Report outdated/ });
    await expect(report).toHaveAttribute("target", "_blank");
    await expect(report).toHaveAttribute("rel", "noopener noreferrer");
    await expect(report).toHaveAttribute(
      "href",
      `${REPO_URL}/issues/new?template=workflow-outdated.yml&labels=workflow-outdated&title=Outdated%3A+${PREFIX}both&workflow=${PREFIX}both`,
    );
    const toc = rail.getByRole("navigation", { name: "On this page" });
    await expect(toc.getByRole("link")).toHaveText(["Result", "Setup", "Prompt", "Steps", "Why it works"]);
    await toc.getByRole("link", { name: "Steps" }).click();
    await expect(page).toHaveURL(/#steps$/);
    // Sticky: after scrolling, the rail is still in the viewport.
    await page.evaluate(() => window.scrollBy(0, 600));
    await expect(rail).toBeInViewport();
  });

  test("WF-35 below lg the same facts render as a block without On this page", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto(PAGE("both"));
    await expect(page.getByRole("complementary", { name: "At a glance" })).toHaveCount(0);
    const block = page.getByRole("region", { name: "At a glance" });
    await expect(block).toBeVisible();
    await expect(block.getByRole("link", { name: /^Report outdated/ })).toBeVisible();
    await expect(block.getByRole("navigation", { name: "On this page" })).toHaveCount(0);
    const metaBottom = await page.getByText(/^Author-verified on/).evaluate((el) => el.getBoundingClientRect().bottom);
    const blockTop = await block.evaluate((el) => el.getBoundingClientRect().top);
    const resultTop = await page.getByRole("heading", { level: 2, name: "Result" }).evaluate((el) => el.getBoundingClientRect().top);
    expect(blockTop).toBeGreaterThan(metaBottom);
    expect(blockTop).toBeLessThan(resultTop);
  });

  test("WF-33 raw HTML in the body is escaped text, never an element", async ({ page }) => {
    const problems = collectConsole(page);
    await page.goto(PAGE("script"));
    const why = page.getByRole("region", { name: "Why it works" });
    await expect(why).toContainText("<script>window.__w2xss = 1</script>");
    expect(await why.locator("script").count()).toBe(0);
    expect(await page.evaluate(() => (window as unknown as { __w2xss?: number }).__w2xss)).toBeUndefined();
    expect(problems()).toEqual([]);
  });

  test("WF-33 unknown and removed slugs return a real 404 with a link to /workflows", async ({ page }) => {
    for (const slug of ["definitely-not-a-workflow", `${PREFIX}removed`]) {
      const res = await page.goto(`/workflows/${slug}`);
      expect(res?.status()).toBe(404);
      await expect(page.getByRole("heading", { level: 1, name: "Workflow not found" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Go to workflows" })).toHaveAttribute("href", "/workflows");
    }
    // The removed one is not listed either.
    await page.goto(INDEX);
    await expect(page.getByRole("link", { name: `${MARK} Removed one` })).toHaveCount(0);
  });

  test("WF-38 an archived workflow stays readable behind a Notice; a 61-day one shows May be outdated", async ({ page }) => {
    await page.goto(PAGE("aged-181"));
    await expect(page.getByText("Archived:")).toBeVisible();
    await expect(page.getByText(/not verified since \d+ \w+ \d{4}\. Kept for reference; the setup may no longer work\./)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: `${MARK} Aged 181 days` })).toBeVisible();
    await page.goto(PAGE("aged-61"));
    await expect(page.getByText("May be outdated").first()).toBeVisible();
    await expect(page.getByText("Archived:")).toHaveCount(0);
  });
});

test.describe("WF-39 nav", () => {
  test("Workflows sits between Exercises and News, active on /workflows and /workflows/*, six links fit at 768", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto(INDEX);
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link")).toHaveText(["Curriculum", "Exercises", "Workflows", "News", "Bookmarks", "Progress"]);
    await expect(nav.getByRole("link", { name: "Workflows" })).toHaveAttribute("aria-current", "page");
    // Every label stays on one line (a wrapped text node reports more than one client rect).
    for (const link of await nav.getByRole("link").all()) {
      const rects = await link.evaluate((el) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const text = walker.nextNode();
        if (!text) return 0;
        const range = document.createRange();
        range.selectNodeContents(text);
        return range.getClientRects().length;
      });
      expect(rects).toBe(1);
    }
    await noHorizontalScroll(page);
    await page.goto(PAGE("both"));
    await expect(nav.getByRole("link", { name: "Workflows" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "News" })).not.toHaveAttribute("aria-current", "page");
  });

  test("the mobile menu lists Workflows too", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(INDEX);
    await page.getByRole("button", { name: "Menu" }).click();
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link")).toHaveText(["Curriculum", "Exercises", "Workflows", "News", "Bookmarks", "Progress"]);
    await expect(nav.getByRole("link", { name: "Workflows" })).toHaveAttribute("aria-current", "page");
  });

  test("no horizontal scroll at 360, 768, 1024 and 1440 on the index and a workflow page", async ({ page }) => {
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const url of [INDEX, PAGE("both"), PAGE("script")]) {
        await page.goto(url);
        await noHorizontalScroll(page);
      }
    }
  });
});

test.describe("WF-39a lesson row", () => {
  test("lists up to 3 newest, links See all N, and comes after previous/next", async ({ page }) => {
    await page.goto(`/lessons/${related.slug}`);
    const row = page.getByRole("region", { name: "Workflows that use this" });
    await expect(page.getByRole("heading", { level: 2, name: "Workflows that use this" })).toBeVisible();
    await expect(row.getByRole("listitem")).toHaveCount(3);
    await expect(row.getByRole("link", { name: new RegExp(`${MARK} Plan before code`) })).toHaveAttribute("href", `/workflows/${PREFIX}both`);
    await expect(row).toContainText("The agent starts editing before it understands the change you asked for.");
    const seeAll = row.getByRole("link", { name: /^See all \d+/ });
    await expect(seeAll).toHaveAttribute("href", `/workflows?lesson=${related.slug}`);
    expect(Number((await seeAll.textContent())!.match(/\d+/)![0])).toBeGreaterThanOrEqual(4);
    const after = await page.evaluate(() => {
      const prevNext = document.querySelector('nav[aria-label="Lesson"]');
      const rowEl = document.querySelector("#lesson-workflows");
      return Boolean(prevNext && rowEl && prevNext.compareDocumentPosition(rowEl) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(after).toBe(true);
    // The Watch block (when a lesson has one) stays above the row; nothing above it changed order.
    const exercise = page.getByRole("region", { name: /^Exercise/ });
    if ((await exercise.count()) > 0) {
      const order = await page.evaluate(() => {
        const ex = document.querySelector("section[aria-labelledby='exercise exercise-title']");
        const rowEl = document.querySelector("#lesson-workflows");
        return Boolean(ex && rowEl && ex.compareDocumentPosition(rowEl) & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      expect(order).toBe(true);
    }
  });

  test("See all opens the lesson-filtered index", async ({ page }) => {
    await page.goto(`/lessons/${related.slug}`);
    await page.getByRole("link", { name: /^See all \d+/ }).click();
    await expect(page).toHaveURL(new RegExp(`/workflows\\?lesson=${related.slug}$`));
    await expect(page.getByRole("link", { name: `Remove filter: Lesson ${related.slug}` })).toBeVisible();
  });

  test("a lesson with no workflows renders no row and no empty heading", async ({ page }) => {
    await page.goto(`/lessons/${unrelated.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Workflows that use this" })).toHaveCount(0);
  });
});

test.describe("D-2 accessibility", () => {
  for (const width of WIDTHS) {
    test(`axe: index and workflow pages at ${width}px (light)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: "light" });
      for (const [label, url] of [
        ["index", INDEX],
        ["index filtered", `/workflows?${Q}&tool=codex&use=review`],
        ["empty", `/workflows?${Q}&tool=claude&stack=any`],
        ["page both", PAGE("both")],
        ["page claude", PAGE("claude")],
        ["page archived", PAGE("aged-181")],
        ["404", "/workflows/definitely-not-a-workflow"],
      ] as const) {
        await page.goto(url);
        await axeBlocking(page, `${label} @${width}`);
      }
    });
  }

  for (const width of [360, 1440] as const) {
    test(`axe: index and workflow pages at ${width}px (dark)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: "dark" });
      for (const [label, url] of [
        ["index", INDEX],
        ["page both", PAGE("both")],
        ["page archived", PAGE("aged-181")],
      ] as const) {
        await page.goto(url);
        await axeBlocking(page, `${label} dark @${width}`);
      }
    });
  }

  test("the lesson page with the workflows row has no serious violations", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/lessons/${related.slug}`);
    await axeBlocking(page, "lesson row");
  });
});
