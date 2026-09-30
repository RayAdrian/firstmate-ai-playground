import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

export const KEY = "fm-playground:v1";

export type Doc = {
  version: number;
  lessons: Record<string, { completedAt: string }>;
  checklists: Record<string, Record<string, boolean>>;
  bookmarks: { lessons: Record<string, string>; news: Record<string, string> };
  prefs: { tool: string };
  lastViewed: { slug: string; at: string } | null;
};

export function doc(partial: Partial<Doc> = {}): Doc {
  return {
    version: 1,
    lessons: {},
    checklists: {},
    bookmarks: { lessons: {}, news: {} },
    prefs: { tool: "claude" },
    lastViewed: null,
    ...partial,
  };
}

export const oneComplete = doc({
  lessons: { "l1-first-session": { completedAt: "2026-09-29T01:00:00.000Z" } },
});

/** Seed localStorage before any app script runs, once per tab (window.name marks it done). */
export async function seedProgress(page: Page, value: Doc | string): Promise<void> {
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  await page.addInitScript(
    ([key, text]) => {
      if (window.name === "__fm_seeded") return;
      window.name = "__fm_seeded";
      window.localStorage.setItem(key, text);
    },
    [KEY, raw],
  );
}

export async function readRaw(page: Page): Promise<string | null> {
  return page.evaluate((key) => window.localStorage.getItem(key), KEY);
}

export async function readProgress(page: Page): Promise<Doc | null> {
  const raw = await readRaw(page);
  return raw === null ? null : (JSON.parse(raw) as Doc);
}

/** localStorage access throws SecurityError (private mode / blocked site data). */
export async function blockStorage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    });
  });
}

const HYDRATION = /hydrat|did not match|server rendered HTML didn't match|Minified React error #(418|423|425)/i;

export function collectConsole(page: Page): { errors: string[]; hydration: string[] } {
  const out = { errors: [] as string[], hydration: [] as string[] };
  page.on("console", (msg) => {
    const text = msg.text();
    if (HYDRATION.test(text)) out.hydration.push(text);
    if (msg.type() === "error") out.errors.push(text);
  });
  page.on("pageerror", (err) => out.errors.push(`pageerror: ${err.message}`));
  return out;
}

// --- DB rows for /bookmarks (isolated ids; created and removed by the spec) ---

function env(): { url: string; key: string } {
  const text = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  const get = (name: string) => text.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim() ?? "";
  return { url: get("SUPABASE_URL"), key: get("SUPABASE_SERVICE_ROLE_KEY") };
}

export const D = {
  lessonA: "d-test-lesson-alpha",
  lessonB: "d-test-lesson-beta",
  lessonArchived: "d-test-lesson-retired",
  newsA: "d0000000-0000-4000-8000-00000000000a",
  newsB: "d0000000-0000-4000-8000-00000000000b",
  newsGone: "d0000000-0000-4000-8000-0000000000ff",
  titleA: "D-TEST Alpha lesson",
  titleB: "D-TEST Beta lesson",
  newsTitleA: "D-TEST news alpha",
  newsTitleB: "D-TEST news beta",
};

type Created = { levelId: string | null };

export async function createDbRows(): Promise<Created> {
  const { url, key } = env();
  const db = createClient(url, key, { auth: { persistSession: false } });
  const existing = await db.from("levels").select("id").order("number").limit(1);
  let levelId = existing.data?.[0]?.id as string | undefined;
  let createdLevel: string | null = null;
  if (!levelId) {
    const made = await db
      .from("levels")
      .insert({ number: 5, slug: "d-test-level", title: "D test", summary: "" })
      .select("id")
      .single();
    if (made.error) throw made.error;
    levelId = made.data.id as string;
    createdLevel = levelId;
  }
  const lesson = (slug: string, title: string, archived: boolean) => ({
    level_id: levelId,
    slug,
    title,
    // Sort last: these rows share level 1 with the fixtures, and a parallel spec (home "Continue", curriculum order)
    // must not see them as the first lesson while they exist.
    sort: 9000,
    est_minutes: 12,
    differences: ["d"],
    claude_md: "x",
    codex_md: "x",
    archived_at: archived ? "2026-09-01T00:00:00Z" : null,
  });
  const lessons = await db.from("lessons").upsert(
    [
      lesson(D.lessonA, D.titleA, false),
      lesson(D.lessonB, D.titleB, false),
      lesson(D.lessonArchived, "D-TEST retired", true),
    ],
    { onConflict: "slug" },
  );
  if (lessons.error) throw lessons.error;
  const source = await db.from("news_sources").select("id").limit(1).single();
  if (source.error) throw source.error;
  const news = await db.from("news_items").upsert(
    [
      {
        id: D.newsA,
        source_id: source.data.id,
        canonical_url: "https://example.com/d-test/a",
        url: "https://example.com/d-test/a",
        title: D.newsTitleA,
        published_at: "2026-09-30T02:10:00Z",
      },
      {
        id: D.newsB,
        source_id: source.data.id,
        canonical_url: "https://example.com/d-test/b",
        url: "https://example.com/d-test/b",
        title: D.newsTitleB,
        published_at: "2026-09-30T03:10:00Z",
      },
    ],
    { onConflict: "id" },
  );
  if (news.error) throw news.error;
  return { levelId: createdLevel };
}

export async function deleteDbRows(created: Created): Promise<void> {
  const { url, key } = env();
  const db = createClient(url, key, { auth: { persistSession: false } });
  await db.from("news_items").delete().in("id", [D.newsA, D.newsB]);
  await db.from("lessons").delete().in("slug", [D.lessonA, D.lessonB, D.lessonArchived]);
  if (created.levelId) await db.from("levels").delete().eq("id", created.levelId);
}
