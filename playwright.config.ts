import { defineConfig, devices } from "@playwright/test";

// Default port is 3000. If something else already listens there (other local projects),
// run with PLAYWRIGHT_PORT=3100 npm run e2e. We never reuse an existing server, so tests
// can't silently run against the wrong app.
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3000);

const on = (name: string) => process.env[name] === "1";

// Server mode. Default is `next dev` (fast). E2E_PROD=1 runs `next build && next start`
// and ONLY the tests tagged @prod (those that need production behaviour: error digests,
// no stack traces, "seed without rebuild", performance).
const PROD = on("E2E_PROD");

// Tags go in the test title, for example test("... @live", ...). Excluded by default:
//   @live     needs a logged-in real `claude`        opt in: E2E_LIVE=1
//   @network  needs the real internet                opt in: E2E_LIVE=1
//   @nightly  timing/perf, not merge-gating          opt in: E2E_NIGHTLY=1
//   @manual   human-performed, never automated
//   @prod     needs a production server              runs only under E2E_PROD=1
const excluded = [
  !on("E2E_LIVE") && "@live",
  !on("E2E_LIVE") && "@network",
  !on("E2E_NIGHTLY") && "@nightly",
  "@manual",
  !PROD && "@prod",
].filter((t): t is string => Boolean(t));

export default defineConfig({
  // E2E specs live in tests/e2e/<ws>/ (ws = m0, a-f, m2, content). Shared helpers: tests/support/.
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  grep: PROD ? /@prod/ : undefined,
  grepInvert: excluded.length ? new RegExp(excluded.join("|")) : undefined,
  fullyParallel: true,
  // Capped: the specs share one dev server and one Supabase stack, and 12 workers produced flakes (TC-C-08, TC-F-52, TC-B-34).
  workers: process.env.CI ? 2 : 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: PROD
      ? `npm run build && npm run start -- --port ${PORT}`
      : `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    // FM_TEST_MODE enables the server-side test clock (src/lib/time/now.ts). Only ever set here.
    // The prod build leaves it unset (so @prod tests see production behaviour) unless
    // E2E_FM_TEST_MODE=1 is given explicitly.
    env: {
      FM_E2E_PROBES: "1",
      ...(!PROD || on("E2E_FM_TEST_MODE") ? { FM_TEST_MODE: "1" } : {}),
    },
    reuseExistingServer: false,
    timeout: PROD ? 300_000 : 120_000,
  },
});
