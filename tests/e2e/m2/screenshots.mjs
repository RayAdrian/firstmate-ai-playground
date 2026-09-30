#!/usr/bin/env node
// Screenshots for the PR template table (DESIGN 9.2): light at 360/768/1440 for the changed pages, dark at 360 and 1440.
//   node tests/e2e/m2/screenshots.mjs http://localhost:3466 <outDir>
// Needs a server started with FM_TEST_MODE=1 (fixed clock) and the fx-base fixtures (`npm run db:reset:test`).
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3466";
const outDir = process.argv[3] ?? "screenshots";
mkdirSync(outDir, { recursive: true });

const progress = {
  version: 1,
  lessons: { "l1-first-session": { completedAt: "2026-09-29T01:00:00.000Z" } },
  checklists: { "ex-fx-auto": { c1: true } },
  bookmarks: { lessons: { "l2-context-files": "2026-09-29T03:00:00.000Z" }, news: {} },
  prefs: { tool: "claude" },
  lastViewed: { slug: "l2-context-files", at: "2026-09-29T05:00:00.000Z" },
};

const PAGES = [
  ["home", "/"],
  ["curriculum", "/curriculum"],
  ["lesson", "/lessons/l1-first-session"],
  ["news", "/news"],
  ["bookmarks", "/bookmarks"],
  ["progress", "/progress"],
];
const SHOTS = [
  ...[360, 768, 1440].map((w) => ({ w, scheme: "light" })),
  ...[360, 1440].map((w) => ({ w, scheme: "dark" })),
];

const browser = await chromium.launch();
for (const { w, scheme } of SHOTS) {
  const context = await browser.newContext({ viewport: { width: w, height: 900 }, colorScheme: scheme });
  await context.addCookies([{ name: "fm_test_now", value: "2026-09-30T13:00:00+08:00", url: base }]);
  await context.addInitScript((doc) => localStorage.setItem("fm-playground:v1", JSON.stringify(doc)), progress);
  const page = await context.newPage();
  for (const [name, route] of PAGES) {
    await page.goto(base + route);
    await page.getByRole("heading", { level: 1 }).first().waitFor();
    await page.waitForFunction(
      () =>
        !document.querySelector('[data-testid="progress-placeholder"]') && !document.querySelector('[data-testid$="-skeleton"]'),
    );
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, `${name}-${scheme}-${w}.png`), fullPage: true });
  }
  await context.close();
}
await browser.close();
console.log(`wrote ${PAGES.length * SHOTS.length} screenshots to ${outDir}`);
