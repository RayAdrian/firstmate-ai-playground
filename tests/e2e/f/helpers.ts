import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { expect, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { NEWS_ITEMS, newsAliasToCanonicalUrl } from "../../fixtures/news";

export const NOW_DEFAULT = "2026-09-30T13:00:00+08:00";

/** Server clock override. Honoured under `next dev`, or by a production server started with FM_TEST_MODE=1. */
export async function setNow(context: BrowserContext, baseURL: string, iso: string = NOW_DEFAULT): Promise<void> {
  await context.addCookies([{ name: "fm_test_now", value: iso, url: baseURL }]);
}

export async function setCookie(context: BrowserContext, baseURL: string, name: string, value: string): Promise<void> {
  await context.addCookies([{ name, value, url: baseURL }]);
}

function env(): { url: string; key: string } {
  const text = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  const get = (name: string) => text.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim() ?? "";
  return { url: get("SUPABASE_URL"), key: get("SUPABASE_SERVICE_ROLE_KEY") };
}

function service() {
  const { url, key } = env();
  return createClient(url, key, { auth: { persistSession: false } });
}

export type Fixture = (typeof NEWS_ITEMS)[number];

export function fixture(alias: string): Fixture {
  const item = NEWS_ITEMS.find((i) => i.alias === alias);
  if (!item) throw new Error(`no fixture ${alias}`);
  return item;
}

/** DB id (uuid) of a fixture item, looked up by canonical URL. */
export async function itemId(alias: string): Promise<string> {
  const { data, error } = await service()
    .from("news_items")
    .select("id")
    .eq("canonical_url", newsAliasToCanonicalUrl(alias))
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Patch fixture rows and return a function that restores the original values. */
export async function patchItems(patches: Record<string, Record<string, unknown>>): Promise<() => Promise<void>> {
  const db = service();
  const undo: Array<() => Promise<void>> = [];
  for (const [alias, fields] of Object.entries(patches)) {
    const url = newsAliasToCanonicalUrl(alias);
    const { data, error } = await db.from("news_items").select("*").eq("canonical_url", url).single();
    if (error) throw error;
    const original: Record<string, unknown> = {};
    for (const k of Object.keys(fields)) original[k] = (data as Record<string, unknown>)[k];
    const res = await db.from("news_items").update(fields).eq("canonical_url", url);
    if (res.error) throw res.error;
    undo.push(async () => {
      const r = await db.from("news_items").update(original).eq("canonical_url", url);
      if (r.error) throw r.error;
    });
  }
  return async () => {
    for (const u of undo) await u();
  };
}

/** Reload the shared DB with a fixture variant. Only call from FM_F_INTEGRATION specs, under the db lock. */
export function resetDb(variant = "fx-base"): void {
  execSync(`npm run db:reset:test -- --variant=${variant}`, { stdio: "ignore", env: process.env });
}

/** Titles of the news cards inside a locator, in DOM order (read through aria-labelledby, so no sr-only suffix). */
export async function cardTitles(scope: Locator): Promise<string[]> {
  await scope.waitFor();
  return scope.getByRole("article").evaluateAll((els) =>
    els.map((el) => document.getElementById(el.getAttribute("aria-labelledby") ?? "")?.textContent ?? ""),
  );
}

/**
 * Navigate and wait for real content. Streamed React output sits in hidden markup before it is swapped in,
 * which `toContainText` (textContent) can see, so wait for the visible h1 (skeletons have none).
 */
export async function go(page: Page, url: string) {
  const res = await page.goto(url);
  if (res?.ok()) await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  return res;
}
