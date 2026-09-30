import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

// Temporarily edits l2-memory's claude_md and differences (no other C spec reads those) and restores them.
test.describe.configure({ mode: "serial" });

function serviceClient() {
  const text = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  const get = (name: string) => text.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim() ?? "";
  return createClient(get("SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
}

const TOKEN = "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS_AND_SOME_MORE_UNBREAKABLE_CHARACTERS_TO_FORCE_OVERFLOW=1";

test("very long inline code never scrolls the page at 360px", async ({ page }) => {
  const db = serviceClient();
  const before = await db.from("lessons").select("claude_md, differences").eq("slug", "l2-memory").single();
  expect(before.error).toBeNull();
  try {
    const patched = await db
      .from("lessons")
      .update({
        claude_md: `Set \`${TOKEN}\` before starting, then see \`${TOKEN}${TOKEN}\`.\n\n- item with \`${TOKEN}\`\n\n| Name | Value |\n| --- | --- |\n| \`${TOKEN}\` | \`${TOKEN}\` |`,
        differences: [`Claude Code needs \`${TOKEN}\` while Codex needs nothing.`],
      })
      .eq("slug", "l2-memory");
    expect(patched.error).toBeNull();

    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/lessons/l2-memory");
    await expect(page.getByRole("heading", { level: 1, name: "Memory" })).toBeVisible();
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(fits).toBe(true);
    // The table scrolls inside its own labelled, focusable region.
    const region = page.getByRole("region", { name: "Table: Name" });
    await expect(region).toHaveAttribute("tabindex", "0");
  } finally {
    await db
      .from("lessons")
      .update({ claude_md: before.data?.claude_md, differences: before.data?.differences })
      .eq("slug", "l2-memory");
  }
});
