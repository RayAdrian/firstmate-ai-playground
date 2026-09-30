import "server-only";
import { cookies } from "next/headers";

// Test-only hooks (AMB-F15), active only under FM_TEST_MODE=1. The server clock itself is `getNow` in @/lib/time/now.
const TEST_MODE = process.env.FM_TEST_MODE === "1";

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
