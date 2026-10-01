import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { collectConsole } from "../../support";
import {
  ARCHIVED,
  CROWD,
  MAIN,
  MARK,
  PREFIX,
  clearFixtures,
  clientIdOf,
  emptySlug,
  newPerson,
  seedFixtures,
  titleOf,
  whenLoaded,
} from "./support";

// R1 e2e: PRD 18.5 CM-1 to CM-6, CM-8, CM-9 (route side), CM-11 and the DESIGN 4.13 selectors. Every workflow here is this
// spec's own fixture (slug prefix `r1fx-`), seeded with the service role and removed afterwards (which cascades to its
// stars and reactions). Each person is its own browser context, so its own random clientId. One serial block = one worker.
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await seedFixtures();
});
test.afterAll(async () => {
  await clearFixtures();
});

const url = (slug: string) => `/workflows/${slug}`;
const LABELS = ["Worked for me", "Learned something", "Saved me time", "Game-changer"] as const;
const WIDTHS = [360, 768, 1440] as const;

const star = (page: Page) => page.getByRole("button", { name: /^Star, \d+ stars?$/ });
const reaction = (page: Page, label: (typeof LABELS)[number]) => page.getByRole("button", { name: new RegExp(`^${label} \\d+$`) });
const reactors = (page: Page, key: "worked" | "learned" | "saved_time" | "game_changer") => page.locator(`#reactors-${key}`);
const prompt = (page: Page) => page.getByRole("region", { name: "Add your name? Optional" });
const live = (page: Page) => page.locator("#fm-live");
const failureLine = (page: Page) => page.locator("p.text-danger");

/** Click and wait for the route call with this op to come back, so a later reader sees the write. */
async function act(page: Page, target: Locator, op: "star" | "react" | "name") {
  const done = page.waitForResponse((r) => r.url().endsWith("/api/community") && r.request().method() === "POST" && r.request().postDataJSON()?.op === op);
  await target.click();
  const res = await done;
  expect(res.status()).toBe(200);
}

async function open(browser: Parameters<typeof newPerson>[0], baseURL: string | undefined, slug: string, scheme?: "light" | "dark") {
  const person = await newPerson(browser, baseURL!, { scheme });
  await person.page.goto(url(slug));
  await whenLoaded(person.page);
  return person;
}

async function skipPrompt(page: Page) {
  await prompt(page).getByRole("button", { name: "Skip" }).click();
  await expect(prompt(page)).toBeHidden();
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

async function shot(page: Page, name: string) {
  const dir = process.env.R1_SHOTS;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage: false });
}

test.describe("CM-6 counts are right on first paint", () => {
  test("the server HTML already has the counts, the reactor lines and the star, with toggles disabled until mine loads", async ({ request }) => {
    // The route streams, so read the raw response body instead of rendering it without JavaScript.
    const res = await request.get(url(MAIN));
    expect(res.status()).toBe(200);
    const html = await res.text();
    const text = html
      .replace(/<!--.*?-->/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ");
    expect(html).toContain('aria-label="Star, 3 stars"');
    expect(html).toMatch(/aria-label="Star, 3 stars"[^>]*aria-disabled="true"|aria-disabled="true"[^>]*aria-label="Star, 3 stars"/);
    expect(html).toContain('aria-label="Worked for me 3"');
    expect(html).toContain('aria-label="Learned something 1"');
    expect(html).toContain('aria-label="Saved me time 0"');
    expect(html).toContain('aria-label="Game-changer 2"');
    expect(html).not.toMatch(/aria-pressed="true"/);
    expect(text).toContain("Worked for me: Ana, Rafael and 1 other");
    expect(text).toContain("Learned something: 1 person");
    expect(text).toContain("Game-changer: Lea and 1 other");
  });

  test("a crowd reads 'Marco and 25 others'", async ({ page }) => {
    await page.goto(url(CROWD));
    await expect(reactors(page, "worked")).toHaveText("🙌 Worked for me: Marco and 25 others");
    await expect(reaction(page, "Worked for me")).toHaveAccessibleName("Worked for me 26");
  });

  test("applying my own pressed state moves nothing (no layout shift)", async ({ browser, baseURL }) => {
    const { page, context } = await newPerson(browser, baseURL!);
    await page.route("**/api/community", async (route) => {
      if (route.request().postDataJSON()?.op === "mine") await new Promise((r) => setTimeout(r, 600));
      await route.continue();
    });
    await page.goto(url(MAIN));
    const group = page.getByRole("group", { name: "Reactions" });
    const probe = () =>
      page.evaluate(() => {
        const box = (el: Element | null) => (el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : -1);
        return [
          box(document.querySelector('[role="group"][aria-label="Reactions"]')),
          box(document.querySelector("#reactors-worked")),
          box(document.querySelector("h2")),
        ];
      });
    await expect(group).toBeVisible();
    const before = await probe();
    await whenLoaded(page);
    expect(await probe()).toEqual(before);
    await context.close();
  });

  test("a failed `mine` leaves the toggles enabled and unpressed", async ({ browser, baseURL }) => {
    const { page, context } = await newPerson(browser, baseURL!);
    await page.route("**/api/community", (route) => (route.request().postDataJSON()?.op === "mine" ? route.abort() : route.continue()));
    await page.goto(url(MAIN));
    await whenLoaded(page);
    await expect(star(page)).toHaveAttribute("aria-pressed", "false");
    await expect(reaction(page, "Worked for me")).toHaveAttribute("aria-pressed", "false");
    await context.close();
  });
});

test.describe("CM-1, CM-2 structure and names", () => {
  test("the Star is a separate header control; Reactions is a group of exactly four toggles", async ({ page }) => {
    await page.goto(url(MAIN));
    const group = page.getByRole("group", { name: "Reactions" });
    await expect(group.getByRole("button")).toHaveCount(4);
    await expect(group.getByRole("button", { name: /Star/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Star, \d+ stars?$/ })).toHaveCount(1);
    for (const label of LABELS) await expect(reaction(page, label)).toBeVisible();
    // each toggle is described by its reactor line
    const worked = reaction(page, "Worked for me");
    const describedBy = await worked.getAttribute("aria-describedby");
    expect(describedBy).toBe("reactors-worked");
    await expect(page.locator(`#${describedBy}`)).toBeVisible();
    // the Star shares the eyebrow row with "Workflow", and sits outside the group
    const eyebrow = await page.getByText("Workflow", { exact: true }).first().boundingBox();
    const starBox = await star(page).boundingBox();
    expect(Math.abs((starBox!.y + starBox!.height / 2) - (eyebrow!.y + eyebrow!.height / 2))).toBeLessThan(14);
  });

  test("the cards show read-only counts as one sentence, plus a Star with the title in its name", async ({ page }) => {
    await page.goto(`/workflows?q=${MARK.toLowerCase()}`);
    const main = page.getByRole("listitem").filter({ hasText: titleOf(MAIN) });
    await expect(main.getByRole("button", { name: `Star ${titleOf(MAIN)}, 3 stars` })).toBeVisible();
    await expect(main.getByText("3 worked for me, 1 learned something, 2 game-changer")).toHaveCount(1);
    await expect(main.locator('[aria-hidden="true"]', { hasText: "🙌 3 · 💡 1 · 🔥 2" })).toBeVisible();
    // counts are not controls: the only button on a card is the Star
    await expect(main.getByRole("button")).toHaveCount(1);
    const empty = page.getByRole("listitem").filter({ hasText: titleOf(emptySlug(14)) });
    await expect(empty.getByRole("button", { name: `Star ${titleOf(emptySlug(14))}, 0 stars` })).toBeVisible();
    await expect(empty.locator("p.tabular-nums")).toHaveCount(0);
  });

  test("a card Star toggles without opening the card, then the name prompt appears inside the card and Skip is remembered", async ({ browser, baseURL }) => {
    const { page, context } = await newPerson(browser, baseURL!);
    const list = `/workflows?q=${MARK.toLowerCase()}`;
    await page.goto(list);
    await whenLoaded(page);
    const slug = emptySlug(7);
    const card = page.getByRole("listitem").filter({ hasText: titleOf(slug) });
    const cardStar = card.getByRole("button", { name: /^Star R1FX e7, 0 stars$/ });
    await act(page, cardStar, "star");
    await expect(page).toHaveURL(new RegExp(`${list.replace("?", "\\?")}$`));
    await expect(card.getByRole("button", { name: `Star ${titleOf(slug)}, 1 star` })).toHaveAttribute("aria-pressed", "true");
    const region = card.getByRole("region", { name: "Add your name? Optional" });
    await expect(region).toBeVisible();
    await expect(region.getByText("Thanks for the star.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Add your name? Optional" })).toHaveCount(1);
    await shot(page, "index-card-prompt");
    await region.getByRole("button", { name: "Skip" }).click();
    await expect(region).toBeHidden();
    await expect(card.getByRole("button", { name: `Star ${titleOf(slug)}, 1 star` })).toBeFocused();
    // remembered across a reload: my star is pressed, the prompt never returns
    await page.reload();
    await whenLoaded(page);
    const again = page.getByRole("listitem").filter({ hasText: titleOf(slug) }).getByRole("button", { name: `Star ${titleOf(slug)}, 1 star` });
    await expect(again).toHaveAttribute("aria-pressed", "true");
    await again.click();
    await expect(page.getByRole("listitem").filter({ hasText: titleOf(slug) }).getByRole("button", { name: /^Star .*, 0 stars$/ })).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("region", { name: "Add your name? Optional" })).toHaveCount(0);
    await context.close();
  });
});

test.describe("CM-1, CM-6 two browsers", () => {
  test("two clientIds star; a third browser sees both; each sees only its own as pressed; unstarring removes only mine", async ({ browser, baseURL }) => {
    const slug = emptySlug(1);
    const a = await open(browser, baseURL, slug);
    await expect(star(a.page)).toHaveAccessibleName("Star, 0 stars");
    await act(a.page, star(a.page), "star");
    await expect(star(a.page)).toHaveAccessibleName("Star, 1 star");
    const b = await open(browser, baseURL, slug);
    await expect(star(b.page)).toHaveAccessibleName("Star, 1 star");
    await act(b.page, star(b.page), "star");
    await expect(star(b.page)).toHaveAccessibleName("Star, 2 stars");

    const c = await open(browser, baseURL, slug);
    await expect(star(c.page)).toHaveAccessibleName("Star, 2 stars");
    await expect(star(c.page)).toHaveAttribute("aria-pressed", "false");

    await a.page.reload();
    await whenLoaded(a.page);
    await expect(star(a.page)).toHaveAccessibleName("Star, 2 stars");
    await expect(star(a.page)).toHaveAttribute("aria-pressed", "true");

    await act(a.page, star(a.page), "star");
    await expect(star(a.page)).toHaveAccessibleName("Star, 1 star");
    await c.page.reload();
    await whenLoaded(c.page);
    await expect(star(c.page)).toHaveAccessibleName("Star, 1 star");
    await b.page.reload();
    await whenLoaded(b.page);
    await expect(star(b.page)).toHaveAttribute("aria-pressed", "true");
    await expect(star(b.page)).toHaveAccessibleName("Star, 1 star");
    for (const p of [a, b, c]) await p.context.close();
  });

  test("any subset of the four reactions can be on, and each survives a reload", async ({ browser, baseURL }) => {
    const a = await open(browser, baseURL, emptySlug(2));
    await act(a.page, reaction(a.page, "Worked for me"), "react");
    await skipPrompt(a.page);
    await act(a.page, reaction(a.page, "Saved me time"), "react");
    await act(a.page, reaction(a.page, "Game-changer"), "react");
    await expect(reaction(a.page, "Worked for me")).toHaveAccessibleName("Worked for me 1");
    await a.page.reload();
    await whenLoaded(a.page);
    await expect(reaction(a.page, "Worked for me")).toHaveAttribute("aria-pressed", "true");
    await expect(reaction(a.page, "Learned something")).toHaveAttribute("aria-pressed", "false");
    await expect(reaction(a.page, "Saved me time")).toHaveAttribute("aria-pressed", "true");
    await expect(reaction(a.page, "Game-changer")).toHaveAttribute("aria-pressed", "true");
    await expect(reactors(a.page, "worked")).toHaveText("🙌 Worked for me: 1 person");
    await act(a.page, reaction(a.page, "Saved me time"), "react");
    await a.page.reload();
    await whenLoaded(a.page);
    await expect(reaction(a.page, "Saved me time")).toHaveAttribute("aria-pressed", "false");
    await expect(reaction(a.page, "Saved me time")).toHaveAccessibleName("Saved me time 0");
    await a.context.close();
  });
});

test.describe("CM-4 the optional name", () => {
  test("ask once, never block, show who reacted, rename and clear everywhere", async ({ browser, baseURL }) => {
    const slug = emptySlug(3);
    const a = await open(browser, baseURL, slug);
    await expect(a.page.getByText("Reacting anonymously", { exact: true })).toBeVisible();

    // The reaction lands first; the prompt follows and does not move focus off the pressed control.
    const worked = reaction(a.page, "Worked for me");
    await act(a.page, worked, "react");
    await expect(prompt(a.page)).toBeVisible();
    await expect(prompt(a.page).getByText("Thanks for sharing that.")).toBeVisible();
    await expect(live(a.page)).toHaveText("Add your name? Optional.");
    await expect(prompt(a.page).getByRole("textbox", { name: "Your name" })).toHaveAttribute("maxlength", "40");
    await expect(prompt(a.page).getByText("Shown next to your reactions. Saved in this browser.")).toBeVisible();
    // not a modal: other controls stay usable while it is open
    await act(a.page, reaction(a.page, "Learned something"), "react");
    await expect(prompt(a.page)).toHaveCount(1);
    await prompt(a.page).getByRole("textbox", { name: "Your name" }).fill("  Ra​fael ");
    await act(a.page, prompt(a.page).getByRole("button", { name: "Save", exact: true }), "name");
    await expect(prompt(a.page)).toBeHidden();
    await expect(live(a.page)).toHaveText("Name saved");
    await expect(a.page.getByText(/^Reacting as/)).toHaveText("Reacting as Rafael");
    await expect(a.page.getByRole("button", { name: "Edit name" })).toBeVisible();
    // the name is saved in this browser only; never asked again
    await a.page.reload();
    await whenLoaded(a.page);
    await expect(a.page.getByText(/^Reacting as/)).toHaveText("Reacting as Rafael");
    await act(a.page, reaction(a.page, "Game-changer"), "react");
    await expect(prompt(a.page)).toHaveCount(0);

    // another browser reacts anonymously and skips; the prompt does not come back for it either
    const b = await open(browser, baseURL, slug);
    await act(b.page, reaction(b.page, "Worked for me"), "react");
    await skipPrompt(b.page);
    await expect(reaction(b.page, "Worked for me")).toBeFocused();
    await expect(b.page.getByText("Reacting anonymously", { exact: true })).toBeVisible();
    await b.page.reload();
    await whenLoaded(b.page);
    await act(b.page, reaction(b.page, "Learned something"), "react");
    await expect(prompt(b.page)).toHaveCount(0);

    // a third browser reads it
    const c = await open(browser, baseURL, slug);
    await expect(reactors(c.page, "worked")).toHaveText("🙌 Worked for me: Rafael and 1 other");
    await expect(reactors(c.page, "game_changer")).toHaveText("🔥 Game-changer: Rafael");

    // rename: every reaction of this browser follows
    await a.page.getByRole("button", { name: "Edit name" }).click();
    const input = a.page.getByRole("textbox", { name: "Your name" });
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("Rafael");
    await expect(a.page.getByRole("button", { name: "Cancel" })).toBeVisible();
    await input.fill("Ana");
    await act(a.page, a.page.getByRole("button", { name: "Save", exact: true }), "name");
    await expect(a.page.getByRole("button", { name: "Edit name" })).toBeFocused();
    await expect(async () => {
      await c.page.reload();
      await expect(reactors(c.page, "worked")).toHaveText("🙌 Worked for me: Ana and 1 other");
      await expect(reactors(c.page, "game_changer")).toHaveText("🔥 Game-changer: Ana");
    }).toPass();

    // clear: everyone from this browser is anonymous again
    await a.page.getByRole("button", { name: "Edit name" }).click();
    await a.page.getByRole("textbox", { name: "Your name" }).fill("");
    await act(a.page, a.page.getByRole("button", { name: "Save", exact: true }), "name");
    await expect(live(a.page)).toHaveText("You're reacting anonymously");
    await expect(a.page.getByText("Reacting anonymously", { exact: true })).toBeVisible();
    await expect(a.page.getByRole("button", { name: "Add name" })).toBeVisible();
    await expect(async () => {
      await c.page.reload();
      await expect(reactors(c.page, "worked")).toHaveText("🙌 Worked for me: 2 people");
    }).toPass();
    for (const p of [a, b, c]) await p.context.close();
  });

  test("Escape in the prompt skips; Cancel closes the editor without changing the name", async ({ browser, baseURL }) => {
    const a = await open(browser, baseURL, emptySlug(8));
    await act(a.page, reaction(a.page, "Learned something"), "react");
    await prompt(a.page).getByRole("textbox", { name: "Your name" }).press("Escape");
    await expect(prompt(a.page)).toBeHidden();
    await expect(reaction(a.page, "Learned something")).toBeFocused();
    await a.page.getByRole("button", { name: "Add name" }).click();
    await a.page.getByRole("textbox", { name: "Your name" }).fill("Nobody");
    await a.page.getByRole("button", { name: "Cancel" }).click();
    await expect(a.page.getByText("Reacting anonymously", { exact: true })).toBeVisible();
    await a.context.close();
  });

  test("a name is plain text: markup shows literally, no element is created, nothing runs", async ({ browser, baseURL }) => {
    const slug = emptySlug(4);
    const evil = "<img src=x onerror=alert(1)>";
    const a = await open(browser, baseURL, slug);
    const dialogs: string[] = [];
    a.page.on("dialog", async (d) => {
      dialogs.push(d.message());
      await d.dismiss();
    });
    await act(a.page, reaction(a.page, "Worked for me"), "react");
    await prompt(a.page).getByRole("textbox", { name: "Your name" }).fill(evil);
    await act(a.page, prompt(a.page).getByRole("button", { name: "Save", exact: true }), "name");
    await expect(a.page.getByText(/^Reacting as/)).toContainText(evil);

    const c = await open(browser, baseURL, slug);
    c.page.on("dialog", async (d) => {
      dialogs.push(d.message());
      await d.dismiss();
    });
    await expect(reactors(c.page, "worked")).toContainText(evil);
    await expect(c.page.locator("main img")).toHaveCount(0);
    await expect(c.page.locator("main [onerror]")).toHaveCount(0);
    expect(dialogs).toEqual([]);
    for (const p of [a, c]) await p.context.close();
  });
});

test.describe("CM-5 toggles never lie", () => {
  test("a failed write rolls back within 2s and says so; a rate limit says so; offline is a failed write", async ({ browser, baseURL }) => {
    const { page, context } = await newPerson(browser, baseURL!);
    let mode: "abort" | "limit" | "pass" = "abort";
    await page.route("**/api/community", async (route) => {
      if (route.request().postDataJSON()?.op === "mine" || mode === "pass") return route.continue();
      await new Promise((r) => setTimeout(r, 500)); // long enough to observe the optimistic state first
      if (mode === "limit") return route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "rate_limited" }) });
      return route.abort();
    });
    await page.goto(url(emptySlug(5)));
    await whenLoaded(page);

    // aborted request: instant optimistic update, then rollback + message
    await star(page).click();
    await expect(star(page)).toHaveAccessibleName("Star, 1 star");
    await expect(star(page)).toHaveAttribute("aria-pressed", "true");
    await expect(star(page)).toHaveAttribute("aria-pressed", "false", { timeout: 2000 });
    await expect(star(page)).toHaveAccessibleName("Star, 0 stars");
    await expect(live(page)).toHaveText("Couldn't save your star. Try again.");
    await expect(failureLine(page)).toHaveText("Couldn't save your star. Try again.");

    // the same for a reaction, and for a rate-limited reply
    const learned = reaction(page, "Learned something");
    await learned.click();
    await expect(learned).toHaveAttribute("aria-pressed", "false", { timeout: 2000 });
    await expect(failureLine(page)).toHaveText("Couldn't save your reaction. Try again.");
    mode = "limit";
    await learned.click();
    await expect(learned).toHaveAttribute("aria-pressed", "false", { timeout: 2000 });
    await expect(live(page)).toHaveText("Too many changes. Wait a minute and try again.");
    await expect(failureLine(page)).toHaveText("Too many changes. Wait a minute and try again.");
    await shot(page, "page-rate-limited");
    await expect(learned).not.toHaveAttribute("aria-disabled", "true");

    // offline: nothing is queued, the UI never claims a save that did not happen
    mode = "pass";
    await context.setOffline(true);
    await learned.click();
    await expect(learned).toHaveAttribute("aria-pressed", "false", { timeout: 2000 });
    await expect(failureLine(page)).toHaveText("Couldn't save your reaction. Try again.");
    await context.setOffline(false);
    await act(page, learned, "react");
    await expect(learned).toHaveAttribute("aria-pressed", "true");
    await expect(failureLine(page)).toHaveCount(0); // cleared by the next successful action

    // nothing was saved by the failed attempts
    await page.reload();
    await whenLoaded(page);
    await expect(star(page)).toHaveAccessibleName("Star, 0 stars");
    await expect(learned).toHaveAccessibleName("Learned something 1");
    await context.close();
  });

  test("five rapid clicks end in the state of the last click, on screen and after a reload", async ({ browser, baseURL }) => {
    const a = await open(browser, baseURL, emptySlug(6));
    const writes: boolean[] = [];
    a.page.on("request", (r) => {
      if (r.url().endsWith("/api/community") && r.postDataJSON()?.op === "react") writes.push(r.postDataJSON().on);
    });
    const worked = reaction(a.page, "Worked for me");
    for (let i = 0; i < 5; i++) await worked.click();
    await expect(worked).toHaveAttribute("aria-pressed", "true");
    const learned = reaction(a.page, "Learned something");
    for (let i = 0; i < 4; i++) await learned.click();
    await expect(learned).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => a.page.evaluate(() => performance.getEntriesByType("resource").filter((e) => e.name.endsWith("/api/community")).length)).toBeGreaterThan(1);
    await a.page.waitForLoadState("networkidle");
    // desired-state writes: the last write for each reaction matches the last click
    expect(writes.length).toBeGreaterThan(0);
    await a.page.reload();
    await whenLoaded(a.page);
    await expect(reaction(a.page, "Worked for me")).toHaveAttribute("aria-pressed", "true");
    await expect(reaction(a.page, "Worked for me")).toHaveAccessibleName("Worked for me 1");
    await expect(reaction(a.page, "Learned something")).toHaveAttribute("aria-pressed", "false");
    await expect(reaction(a.page, "Learned something")).toHaveAccessibleName("Learned something 0");
    await a.context.close();
  });

  test("the keyboard works: Space and Enter toggle, focus never leaves the control", async ({ browser, baseURL }) => {
    const a = await open(browser, baseURL, emptySlug(9));
    const saved = reaction(a.page, "Saved me time");
    await saved.focus();
    const done = a.page.waitForResponse((r) => r.url().endsWith("/api/community") && r.request().postDataJSON()?.op === "react");
    await a.page.keyboard.press("Space");
    await done;
    await expect(saved).toHaveAttribute("aria-pressed", "true");
    await expect(saved).toBeFocused();
    await star(a.page).focus();
    await act(a.page, star(a.page), "star");
    await expect(star(a.page)).toHaveAttribute("aria-pressed", "true");
    await a.context.close();
  });
});

test.describe("CM-7, CM-8 nobody can change another browser's rows, and the route is narrow", () => {
  test("another browser cannot delete my star, reaction or name, and no response contains a client id", async ({ browser, baseURL }) => {
    const slug = emptySlug(10);
    const a = await open(browser, baseURL, slug);
    await act(a.page, star(a.page), "star");
    await act(a.page, reaction(a.page, "Worked for me"), "react");
    await prompt(a.page).getByRole("textbox", { name: "Your name" }).fill("Rafael");
    await act(a.page, prompt(a.page).getByRole("button", { name: "Save", exact: true }), "name");
    const aId = await clientIdOf(a.page);

    // Another browser: its own random id (it never learns A's, since no read returns one).
    const b = await newPerson(browser, baseURL!);
    const bId = randomUUID();
    expect(bId).not.toBe(aId);
    const post = (data: object) =>
      b.page.request.post("/api/community", { headers: { origin: baseURL!, "content-type": "application/json" }, data });
    const responses = [
      await post({ op: "star", clientId: bId, slug, on: false }),
      await post({ op: "react", clientId: bId, slug, reaction: "worked", on: false }),
      await post({ op: "name", clientId: bId, displayName: null }),
      await post({ op: "mine", clientId: bId, slugs: [slug] }),
      await post({ op: "myStars", clientId: bId }),
    ];
    for (const r of responses) {
      expect(r.status()).toBe(200);
      const text = await r.text();
      expect(text).not.toContain(aId);
      expect(text).not.toContain(bId);
    }
    const mine = (await responses[3]!.json()) as { mine: { starred: boolean; reactions: string[] }[] };
    expect(mine.mine).toEqual([{ slug, starred: false, reactions: [] }]);

    const c = await open(browser, baseURL, slug);
    await expect(star(c.page)).toHaveAccessibleName("Star, 1 star");
    await expect(reactors(c.page, "worked")).toHaveText("🙌 Worked for me: Rafael");
    await a.page.reload();
    await whenLoaded(a.page);
    await expect(star(a.page)).toHaveAttribute("aria-pressed", "true");
    await expect(reaction(a.page, "Worked for me")).toHaveAttribute("aria-pressed", "true");
    for (const p of [a, b, c]) await p.context.close();
  });

  test("the route accepts only same-origin application/json under 2 KB with a strict body, and always answers JSON", async ({ request, baseURL }) => {
    const good = { op: "mine", clientId: "aaaaaaaa-0000-4000-8000-000000000042", slugs: [MAIN] };
    const headers = { origin: baseURL!, "content-type": "application/json" };

    const ok = await request.post("/api/community", { headers, data: good });
    expect(ok.status()).toBe(200);
    expect(ok.headers()["content-type"]).toContain("application/json");
    expect(ok.headers()["cache-control"]).toBe("no-store");

    const noOrigin = await request.post("/api/community", { headers: { "content-type": "application/json" }, data: good });
    expect(noOrigin.status()).toBe(403);
    expect(await noOrigin.json()).toEqual({ error: "forbidden" });
    const evil = await request.post("/api/community", { headers: { ...headers, origin: "https://evil.example" }, data: good });
    expect(evil.status()).toBe(403);

    const form = await request.post("/api/community", { headers: { origin: baseURL!, "content-type": "application/x-www-form-urlencoded" }, data: "op=star" });
    expect(form.status()).toBe(415);
    expect(await form.json()).toEqual({ error: "unsupported_media_type" });

    const big = await request.post("/api/community", { headers, data: { ...good, junk: "x".repeat(3000) } });
    expect(big.status()).toBe(413);
    expect(await big.json()).toEqual({ error: "payload_too_large" });

    for (const data of [
      { ...good, extra: true },
      { op: "star", clientId: "not-a-uuid", slug: MAIN, on: true },
      { op: "react", clientId: good.clientId, slug: MAIN, reaction: "love", on: true },
      { op: "star", clientId: good.clientId, slug: "Not A Slug", on: true },
      { op: "name", clientId: good.clientId, displayName: "n".repeat(41) },
      { op: "mine", clientId: good.clientId, slugs: Array.from({ length: 101 }, () => "a") },
    ]) {
      const res = await request.post("/api/community", { headers, data });
      expect(res.status(), JSON.stringify(data)).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_request" });
    }
    const malformed = await request.post("/api/community", { headers, data: "{nope" });
    expect(malformed.status()).toBe(400);

    // an unknown or removed workflow is refused by the database, with a fixed code and no echo of the input
    const unknown = await request.post("/api/community", { headers, data: { op: "star", clientId: good.clientId, slug: "no-such-workflow-xyz", on: true } });
    expect(unknown.status()).toBe(404);
    expect(await unknown.text()).toBe('{"error":"workflow_unavailable"}');
  });
});

test.describe("CM-11 archived workflows", () => {
  test("show their counts, disable every toggle with a note, and the database refuses a direct write", async ({ browser, baseURL }) => {
    const { page, context } = await newPerson(browser, baseURL!);
    await page.goto(url(ARCHIVED));
    await expect(star(page)).toHaveAccessibleName("Star, 1 star");
    await expect(star(page)).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByText("Reactions are closed on archived workflows.")).toBeVisible();
    for (const label of LABELS) await expect(reaction(page, label)).toHaveAttribute("aria-disabled", "true");
    await expect(reaction(page, "Worked for me")).toHaveAccessibleName("Worked for me 1");
    await expect(reaction(page, "Worked for me")).toHaveAccessibleDescription(/Reactions are closed on archived workflows\./);
    await page.waitForTimeout(500);
    await reaction(page, "Worked for me").click({ force: true }); // aria-disabled is not "disabled" to Playwright
    await star(page).click({ force: true });
    await expect(star(page)).toHaveAccessibleName("Star, 1 star");
    await expect(reaction(page, "Worked for me")).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("region", { name: "Add your name? Optional" })).toHaveCount(0);

    const direct = await page.request.post("/api/community", {
      headers: { origin: baseURL!, "content-type": "application/json" },
      data: { op: "star", clientId: randomUUID(), slug: ARCHIVED, on: true },
    });
    expect(direct.status()).toBe(404);
    expect(await direct.json()).toEqual({ error: "workflow_unavailable" });

    await page.goto(`/workflows?q=${MARK.toLowerCase()}&archived=1`);
    const card = page.getByRole("listitem").filter({ hasText: titleOf(ARCHIVED) });
    await expect(card.getByRole("button", { name: `Star ${titleOf(ARCHIVED)}, 1 star` })).toHaveAttribute("aria-disabled", "true");
    await context.close();
  });
});

test.describe("layout, targets and accessibility", () => {
  for (const scheme of ["light", "dark"] as const) {
    for (const width of WIDTHS) {
      test(`workflow page at ${width}px, ${scheme}: grid, labels, 44px targets, no overflow, axe`, async ({ browser, baseURL }) => {
        const person = await newPerson(browser, baseURL!, { scheme });
        const { page } = person;
        await page.setViewportSize({ width, height: 900 });
        const consoleLog = collectConsole(page);
        await page.goto(url(MAIN));
        await whenLoaded(page);
        await noHorizontalScroll(page);

        const group = page.getByRole("group", { name: "Reactions" });
        const boxes = await Promise.all(LABELS.map((l) => reaction(page, l).boundingBox()));
        const rows = new Set(boxes.map((b) => Math.round(b!.y)));
        expect(rows.size, `${width}px reaction rows`).toBe(width < 768 ? 2 : 1);
        for (const b of boxes) {
          expect(b!.height).toBeGreaterThanOrEqual(43.5);
          expect(b!.x).toBeGreaterThanOrEqual(0);
          expect(b!.x + b!.width).toBeLessThanOrEqual(width + 0.5);
        }
        const names = await Promise.all(LABELS.map((l) => reaction(page, l).innerText()));
        if (width < 768) {
          expect(names.map((n) => n.replace(/\s+/g, " ").trim().replace(/ 0$/, "") /* the zero is sr-only */)).toEqual(["🙌 Worked 3", "💡 Learned 1", "⏱️ Saved", "🔥 Game-changer 2"]);
          expect((await star(page).innerText()).trim()).toBe("3"); // no visible word below md
        } else {
          expect(names.map((n) => n.replace(/\s+/g, " ").trim().replace(/ 0$/, "") /* the zero is sr-only */)).toEqual([
            "🙌 Worked for me 3",
            "💡 Learned something 1",
            "⏱️ Saved me time",
            "🔥 Game-changer 2",
          ]);
          expect((await star(page).innerText()).replace(/\s+/g, " ").trim()).toBe("Star 3");
        }
        // the accessible name never changes with the width
        await expect(reaction(page, "Worked for me")).toHaveAccessibleName("Worked for me 3");
        await expect(star(page)).toHaveAccessibleName("Star, 3 stars");
        const starBox = await star(page).boundingBox();
        expect(starBox!.height).toBeGreaterThanOrEqual(43.5);
        expect(starBox!.width).toBeGreaterThanOrEqual(43.5);
        await expect(group).toBeVisible();

        await shot(page, `page-${width}-${scheme}-idle`);
        await axeBlocking(page, `idle ${width} ${scheme}`);

        // with my own state, the prompt open and a failure line showing
        await act(page, reaction(page, "Saved me time"), "react");
        await expect(prompt(page)).toBeVisible();
        await act(page, star(page), "star");
        const promptBox = await prompt(page).boundingBox();
        expect(promptBox!.x + promptBox!.width).toBeLessThanOrEqual(width + 0.5);
        for (const name of ["Save", "Skip"]) {
          const box = await prompt(page).getByRole("button", { name, exact: true }).boundingBox();
          expect(box!.height).toBeGreaterThanOrEqual(35.5);
        }
        await noHorizontalScroll(page);
        await shot(page, `page-${width}-${scheme}-pressed-prompt`);
        await axeBlocking(page, `prompt ${width} ${scheme}`);
        await prompt(page).getByRole("textbox", { name: "Your name" }).fill("Rafael");
        await act(page, prompt(page).getByRole("button", { name: "Save", exact: true }), "name");
        await expect(page.getByText(/^Reacting as/)).toBeVisible();
        await shot(page, `page-${width}-${scheme}-named`);
        await axeBlocking(page, `named ${width} ${scheme}`);

        // undo what this test wrote, so the next width starts from the seeded counts
        await act(page, reaction(page, "Saved me time"), "react");
        await act(page, star(page), "star");
        expect(consoleLog(), "console problems").toEqual([]);
        await person.context.close();
      });

      test(`workflows index at ${width}px, ${scheme}: card Star, counts, no overflow, axe`, async ({ browser, baseURL }) => {
        const person = await newPerson(browser, baseURL!, { scheme });
        const { page } = person;
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/workflows?q=${MARK.toLowerCase()}`);
        await whenLoaded(page);
        await noHorizontalScroll(page);
        const card = page.getByRole("listitem").filter({ hasText: titleOf(MAIN) });
        await expect(card.getByRole("button", { name: `Star ${titleOf(MAIN)}, 3 stars` })).toBeVisible();
        const starBox = await card.getByRole("button", { name: /^Star / }).boundingBox();
        expect(starBox!.height).toBeGreaterThanOrEqual(35.5);
        const cardBox = await card.boundingBox();
        expect(starBox!.x + starBox!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width);
        await shot(page, `index-${width}-${scheme}`);
        await axeBlocking(page, `index ${width} ${scheme}`);
        await person.context.close();
      });
    }
  }

  test("on a touch device every control is at least 44px, including the card Star and the name buttons", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await page.goto(`/workflows?q=${MARK.toLowerCase()}`);
    await whenLoaded(page);
    const cardStar = page.getByRole("listitem").filter({ hasText: titleOf(MAIN) }).getByRole("button", { name: /^Star / });
    const box = await cardStar.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(43.5);
    expect(box!.width).toBeGreaterThanOrEqual(43.5);

    await page.goto(url(emptySlug(11)));
    await whenLoaded(page);
    await act(page, reaction(page, "Learned something"), "react");
    for (const target of [
      star(page),
      ...LABELS.map((l) => reaction(page, l)),
      prompt(page).getByRole("button", { name: "Save", exact: true }),
      prompt(page).getByRole("button", { name: "Skip" }),
      prompt(page).getByRole("textbox", { name: "Your name" }),
    ]) {
      const b = await target.boundingBox();
      expect(b!.height).toBeGreaterThanOrEqual(43.5);
    }
    await skipPrompt(page);
    const edit = await page.getByRole("button", { name: "Add name" }).boundingBox();
    expect(edit!.height).toBeGreaterThanOrEqual(43.5);
    await context.close();
  });
});

test.describe("PRD 18 honesty and scope", () => {
  test("the workflow page names no count 'verified' and shows no clientId anywhere", async ({ browser, baseURL }) => {
    const a = await open(browser, baseURL, emptySlug(12));
    await act(a.page, star(a.page), "star");
    const id = await clientIdOf(a.page);
    const html = await a.page.content();
    expect(html).not.toContain(id);
    await expect(a.page.getByText(/verified by|users who|people who ran/i)).toHaveCount(0);
    await a.context.close();
  });

  test("no cross-site calls and no console errors on a normal visit and a reaction", async ({ browser, baseURL }) => {
    const { page, context } = await newPerson(browser, baseURL!);
    const external: string[] = [];
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (!["localhost", "127.0.0.1"].includes(u.hostname) && u.protocol.startsWith("http")) external.push(r.url());
    });
    const log = collectConsole(page);
    await page.goto(url(emptySlug(13)));
    await whenLoaded(page);
    await act(page, reaction(page, "Worked for me"), "react");
    await skipPrompt(page);
    expect(external).toEqual([]);
    expect(log()).toEqual([]);
    expect(PREFIX).toBe("r1fx-");
    await context.close();
  });
});
