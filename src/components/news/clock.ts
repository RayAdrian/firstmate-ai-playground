import "server-only";
import { cookies } from "next/headers";

// Test-only seams (AMB-03, AMB-F15). Active under `next dev` (what Playwright starts) or when
// FM_TEST_MODE=1 is set on a production server; a plain `next start` ignores these cookies entirely.
const TEST_MODE = process.env.FM_TEST_MODE === "1" || process.env.NODE_ENV !== "production";

/** "Now" for the news pages. In test mode the `fm_test_now` cookie (ISO with offset) overrides the clock. */
export async function getNow(): Promise<Date> {
  if (!TEST_MODE) return new Date();
  const raw = (await cookies()).get("fm_test_now")?.value;
  if (raw) {
    const d = new Date(decodeURIComponent(raw));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

const thrown = new Set<string>();

/**
 * Test hooks: `fm_test_delay_ms` holds the render (loading skeleton check), and
 * `fm_test_throw=<route>` throws once per distinct cookie value (error boundary check).
 */
export async function applyTestHooks(route: "news" | "news-archive"): Promise<void> {
  if (!TEST_MODE) return;
  const jar = await cookies();
  const delay = Number(jar.get("fm_test_delay_ms")?.value ?? 0);
  if (Number.isFinite(delay) && delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(delay, 5000)));
  }
  const armed = jar.get("fm_test_throw")?.value;
  if (armed && armed.split(":")[0] === route && !thrown.has(armed)) {
    thrown.add(armed);
    throw new Error("Injected test failure");
  }
}
