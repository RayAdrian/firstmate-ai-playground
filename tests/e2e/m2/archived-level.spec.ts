// Mutating spec (own project in playwright.config.ts): inserts an archived level with an active lesson under it.
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

function service() {
  const text = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  const get = (n: string) => text.match(new RegExp(`^${n}=(.*)$`, "m"))?.[1]?.trim() ?? "";
  return createClient(get("SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
}

const LEVEL_SLUG = "m2-archived-level";
const LESSON_SLUG = "m2-under-archived-level";

test.describe("lesson under an archived level", () => {
  let levelId = "";

  test.beforeAll(async () => {
    const db = service();
    const level = await db
      .from("levels")
      .insert({ number: 5, slug: LEVEL_SLUG, title: "M2 archived", summary: "", archived_at: "2026-09-01T00:00:00Z" })
      .select("id")
      .single();
    if (level.error) throw level.error;
    levelId = level.data.id as string;
    const lesson = await db.from("lessons").insert({
      level_id: levelId,
      slug: LESSON_SLUG,
      title: "M2 orphaned lesson",
      est_minutes: 5,
      differences: ["d"],
      claude_md: "x",
      codex_md: "x",
      archived_at: null,
    });
    if (lesson.error) throw lesson.error;
  });

  test.afterAll(async () => {
    const db = service();
    await db.from("lessons").delete().eq("slug", LESSON_SLUG);
    if (levelId) await db.from("levels").delete().eq("id", levelId);
  });

  test("TC-M2-11 AC: S9-05 answers with a real 404 status, not a 200 soft-404", async ({ page, request }) => {
    expect((await request.get(`/lessons/${LESSON_SLUG}`)).status()).toBe(404);
    const res = await page.goto(`/lessons/${LESSON_SLUG}`);
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Lesson not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to curriculum" })).toBeVisible();
  });

  test("the lesson is absent from the curriculum too", async ({ page }) => {
    await page.goto("/curriculum");
    await expect(page.locator(`a[href="/lessons/${LESSON_SLUG}"]`)).toHaveCount(0);
  });
});
