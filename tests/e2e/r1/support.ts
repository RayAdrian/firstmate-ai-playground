import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Browser, Page } from "@playwright/test";
import { PROGRESS_STORAGE_KEY } from "../../../src/lib/contracts/progress";
import { setServerNow } from "../../support";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });

/** The fixed test clock (same as the other workstreams): 30 Sep 2026, Manila. */
export const NOW = "2026-09-30T13:00:00+08:00";
export const TODAY = "2026-09-30";

/** Every fixture slug starts with this and every title carries MARK, so seeding and cleanup touch only these rows. */
export const PREFIX = "r1fx-";
export const MARK = "R1FX";

/** Fixture workflows. `main` and `crowd` carry seeded community rows; the numbered ones start empty, one per test. */
export const MAIN = `${PREFIX}main`;
export const CROWD = `${PREFIX}crowd`;
export const ARCHIVED = `${PREFIX}archived`;
export const titleOf = (slug: string) => `${MARK} ${slug.slice(PREFIX.length)}`;
const EMPTY_COUNT = 14;
export const emptySlug = (n: number) => `${PREFIX}e${n}`;

const uuid = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;
/** Client ids that only the seeded rows use. Real browsers get their own random ids. */
export const SEEDED = { s1: uuid("5eed0001", 1), s2: uuid("5eed0001", 2), s3: uuid("5eed0001", 3) };

export function serviceClient() {
  return createClient(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function agoDate(days: number): string {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function workflowRow(slug: string, verifiedDaysAgo: number) {
  return {
    slug,
    title: titleOf(slug),
    problem: "The agent starts editing before it understands the change you asked for.",
    tools: ["claude-code"],
    setup: [],
    setup_kinds: [],
    prompt: { shared: "```text\nPlan the change first, then wait for approval.\n```" },
    result_before: "The agent edits files straight away and you review a large diff.",
    result_after: "The agent writes a plan first and waits for your approval.",
    steps: ["Add the setup files.", "Run the prompt.", "Review the plan before it edits."],
    why_md: "A written plan makes the agent's assumptions visible before any file changes.",
    use_cases: ["planning"],
    stacks: ["nextjs"],
    related_lesson_slug: null,
    level: null,
    tool_versions: { claude_code: "2.1.0" },
    verified_on: agoDate(verifiedDaysAgo),
    author_name: "Ada Lovelace",
    reviewed_on: agoDate(1),
    content_hash: `r1fx-${slug}`,
    removed_at: null,
  };
}

export async function clearFixtures(): Promise<void> {
  // Cascades to the workflow's stars and reactions (PRD 18.7 / WF-43).
  const { error } = await serviceClient().from("workflows").delete().like("slug", `${PREFIX}%`);
  if (error) throw new Error(`could not clear r1 fixtures: ${error.message}`);
}

/**
 * Insert the fixture workflows and their seeded community rows with the service role (the app itself has no such path).
 * `main`: 3 stars; worked 3 (Ana newest, Rafael, one anonymous), learned 1 anonymous, game-changer 2 (Lea, one anonymous).
 * `crowd`: worked 26 (Marco, then 25 anonymous), the "and N others" case.
 */
export async function seedFixtures(): Promise<void> {
  const db = serviceClient();
  await clearFixtures();
  const slugs = [MAIN, CROWD, ...Array.from({ length: EMPTY_COUNT }, (_, i) => emptySlug(i + 1))];
  const rows = [...slugs.map((s) => workflowRow(s, 5)), workflowRow(ARCHIVED, 181)];
  const ins = await db.from("workflows").insert(rows).select("id, slug");
  if (ins.error || !ins.data) throw new Error(`could not seed r1 workflows: ${ins.error?.message}`);
  const id = new Map<string, string>(ins.data.map((r: { id: string; slug: string }) => [r.slug, r.id]));
  const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();

  const stars = [SEEDED.s1, SEEDED.s2, SEEDED.s3].map((client_id, i) => ({
    workflow_id: id.get(MAIN),
    client_id,
    created_at: at(10 - i),
  }));
  const archivedStars = [{ workflow_id: id.get(ARCHIVED), client_id: SEEDED.s1, created_at: at(5) }];
  const s = await db.from("workflow_stars").insert([...stars, ...archivedStars]);
  if (s.error) throw new Error(`could not seed stars: ${s.error.message}`);

  const reaction = (slug: string, client_id: string, key: string, name: string | null, minutesAgo: number) => ({
    workflow_id: id.get(slug),
    client_id,
    reaction: key,
    display_name: name,
    created_at: at(minutesAgo),
  });
  const crowd = Array.from({ length: 25 }, (_, i) => reaction(CROWD, uuid("c0ffee00", i + 1), "worked", null, 30 + i));
  const r = await db.from("workflow_reactions").insert([
    reaction(MAIN, SEEDED.s1, "worked", "Rafael", 3),
    reaction(MAIN, SEEDED.s2, "worked", "Ana", 2),
    reaction(MAIN, SEEDED.s3, "worked", null, 1),
    reaction(MAIN, SEEDED.s1, "learned", null, 3),
    reaction(MAIN, SEEDED.s2, "game_changer", "Lea", 2),
    reaction(MAIN, SEEDED.s3, "game_changer", null, 1),
    reaction(ARCHIVED, SEEDED.s1, "worked", "Rafael", 4),
    reaction(CROWD, uuid("c0ffee00", 99), "worked", "Marco", 1),
    ...crowd,
  ]);
  if (r.error) throw new Error(`could not seed reactions: ${r.error.message}`);
}

/** A fresh browser identity: its own context, so its own localStorage and its own random clientId. */
export async function newPerson(browser: Browser, baseURL: string, options: { scheme?: "light" | "dark" } = {}) {
  const context = await browser.newContext({ baseURL, colorScheme: options.scheme ?? "light" });
  await setServerNow(context, baseURL, NOW);
  const page = await context.newPage();
  return { context, page };
}

/** The clientId this browser holds (read from its stored progress doc). Used only to drive the route directly in tests. */
export async function clientIdOf(page: Page): Promise<string> {
  const id = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as { community?: { clientId?: string } }).community?.clientId ?? null : null;
  }, PROGRESS_STORAGE_KEY);
  if (!id) throw new Error("no clientId in storage yet");
  return id;
}

/** Wait until the page's community controls have loaded this browser's own state (toggles no longer aria-disabled). */
export async function whenLoaded(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll<HTMLElement>('[data-community]'));
    return buttons.length > 0 && buttons.every((b) => !b.hasAttribute("aria-disabled"));
  });
}
