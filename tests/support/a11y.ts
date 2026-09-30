import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** Assert zero serious/critical axe violations on the current page (PRD D-2.1). */
export async function expectNoSeriousA11y(
  page: Page,
  options: { include?: string; exclude?: string[] } = {},
): Promise<void> {
  let builder = new AxeBuilder({ page });
  if (options.include) builder = builder.include(options.include);
  for (const sel of options.exclude ?? []) builder = builder.exclude(sel);
  const { violations } = await builder.analyze();
  const blocking = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}
