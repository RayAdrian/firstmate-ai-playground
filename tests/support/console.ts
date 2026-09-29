import type { Page } from "@playwright/test";

/**
 * Collect `console.error`, uncaught page errors and hydration warnings.
 * Call before `page.goto`; assert `expect(problems()).toEqual([])` at the end of the test.
 */
export function collectConsole(page: Page): () => string[] {
  const problems: string[] = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error" || /hydrat/i.test(text)) {
      problems.push(`console.${msg.type()}: ${text}`);
    }
  });
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
  return () => [...problems];
}
