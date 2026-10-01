import "server-only";
import { cookies } from "next/headers";

// Test hooks (AMB-C12): cookies honoured ONLY when FM_TEST_MODE=1 (set by the e2e webServer).
// The clock hook (fm_test_now) lives in src/lib/time/now.ts.
//   fm_test_fail=<route>         make the route's query throw (curriculum | lesson | exercises)
//   fm_test_delay=<route>:<ms>   delay the route's query
function enabled(): boolean {
  return process.env.FM_TEST_MODE === "1";
}

async function hook(name: string): Promise<string | null> {
  if (!enabled()) return null;
  try {
    return (await cookies()).get(name)?.value ?? null;
  } catch {
    return null;
  }
}

/** Apply the delay and failure hooks for a route. A no-op in production. */
export async function applyRouteHooks(
  route: "curriculum" | "lesson" | "exercises" | "home",
): Promise<void> {
  // The home route may also be addressed by its path: fm_test_delay=/:1500
  const names: string[] = route === "home" ? ["home", "/"] : [route];
  const delay = await hook("fm_test_delay");
  if (delay) {
    const [r, ms] = decodeURIComponent(delay).split(":");
    const n = Number(ms);
    if (names.includes(r) && Number.isFinite(n) && n > 0) {
      await new Promise((res) => setTimeout(res, Math.min(n, 10_000)));
    }
  }
  const fail = await hook("fm_test_fail");
  if (fail !== null && names.includes(fail)) throw new Error("Injected test failure");
}
