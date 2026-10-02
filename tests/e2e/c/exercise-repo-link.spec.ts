import { expect, test } from "@playwright/test";
import { NOW, waitLessonHydrated } from "./support";
import { setServerNow } from "../../support";

const REPO = "https://github.com/RayAdrian/firstmate-ai-playground";

test.beforeEach(async ({ context, baseURL }) => {
  await setServerNow(context, baseURL!, NOW);
});

test("exercises page links the repo, shows the clone command and per-exercise links", async ({ page }) => {
  await page.goto("/exercises");
  const intro = page.getByRole("link", { name: /Exercises live in the repo: clone it to start/ });
  await expect(intro).toHaveAttribute("href", `${REPO}/tree/main/exercises`);
  await expect(intro).toHaveAttribute("rel", /noopener/);
  await expect(page.getByText(`git clone ${REPO}.git`)).toBeVisible();
  await expect(page.getByText("The repo is private. Ask the owner for access.")).toBeVisible();

  const links = page.getByRole("link", { name: /^View on GitHub/ }).filter({ visible: true });
  expect(await links.count()).toBeGreaterThan(0);
  const href = await links.first().getAttribute("href");
  expect(href).toMatch(new RegExp(`^${REPO}/tree/main/exercises/[^/]+$`));
  await expect(links.first()).toHaveAttribute("rel", /noopener/);
  const box = await links.first().boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
});

test("lesson exercise panel links the exercise folder", async ({ page }) => {
  await page.goto("/lessons/l1-first-session");
  await waitLessonHydrated(page);
  const link = page.getByRole("region", { name: /^Exercise/ }).getByRole("link", { name: /^View on GitHub/ });
  await expect(link).toHaveAttribute("href", `${REPO}/tree/main/exercises/ex-fx-auto`);
  await expect(link).toHaveAttribute("rel", /noopener/);
  await expect(link).toHaveAttribute("target", "_blank");
});
