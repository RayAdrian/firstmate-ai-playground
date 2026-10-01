import { expect, test } from "@playwright/test";

// PRD 18.8 DP-3a: the deployment is public and has no sign-in, so every response says noindex and robots.txt
// disallows everything. Needs a production build: `E2E_PROD=1 npm run e2e`.
const NOINDEX = "noindex, nofollow";

test.describe("noindex (DP-3a)", () => {
  for (const route of ["/", "/workflows", "/lessons/l1-first-session", "/api/community", "/fonts/Satoshi-Regular.woff2", "/this-route-does-not-exist"]) {
    test(`${route} sends X-Robots-Tag @prod`, async ({ request }) => {
      const res = await request.get(route);
      expect(res.headers()["x-robots-tag"]).toBe(NOINDEX);
    });
  }

  test("a POST to the community route is noindex too @prod", async ({ request }) => {
    const res = await request.post("/api/community", { data: {} });
    expect(res.headers()["x-robots-tag"]).toBe(NOINDEX);
  });

  test("/robots.txt disallows everything @prod", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    expect((await res.text()).trim().split(/\r?\n/)).toEqual(["User-agent: *", "Disallow: /"]);
    expect(res.headers()["x-robots-tag"]).toBe(NOINDEX);
  });
});
