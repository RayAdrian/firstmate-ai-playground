import { notFound } from "next/navigation";
import { getNow } from "@/lib/time/now";

// E2E-only probe (404 unless FM_TEST_ROUTES=1, set by Playwright's webServer). Renders the
// server clock so a @prod test can prove getNow() is not frozen at build time.
export default async function TestNowPage() {
  if (process.env.FM_TEST_ROUTES !== "1") notFound();
  return <p data-testid="now">{(await getNow()).toISOString()}</p>;
}
