import { defineConfig, devices } from "@playwright/test";

// Default port is 3000. If something else already listens there (other local projects),
// run with PLAYWRIGHT_PORT=3100 npm run e2e. We never reuse an existing server, so tests
// can't silently run against the wrong app.
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3000);

export default defineConfig({
  // E2E specs live in tests/e2e/<ws>/ (ws = m0, a-f, m2, content). Shared helpers: tests/support/.
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
