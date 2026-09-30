import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Digest, NewsCardItem } from "@/components/news/queries";
import * as store from "@/lib/progress/store";

const getDigest = vi.fn<(now: Date, opts?: { limit?: number }) => Promise<Digest>>();
vi.mock("@/components/news/queries", () => ({ getDigest: (...args: Parameters<typeof getDigest>) => getDigest(...args) }));
vi.mock("@/lib/time/now", () => ({ getNow: async () => new Date("2026-09-30T13:00:00+08:00") }));

import { DigestTopItems } from "@/components/news";

const card = (n: number): NewsCardItem => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  title: `Item ${n}`,
  url: `https://example.com/${n}`,
  sourceName: "Src",
  publishedAt: "2026-09-30T06:00:00+08:00",
  score: 100 - n,
  tags: ["tooling"],
  why: "why",
  status: "scored",
});

const digest = (over: Partial<Extract<Digest, { kind: "digest" }>> = {}): Digest => ({
  kind: "digest",
  digestDate: "2026-09-30",
  updatedAt: "2026-09-30T08:03:00+08:00",
  stale: false,
  ranked: [card(1), card(2), card(3)],
  scoredCount: 3,
  unscored: [],
  ...over,
});

beforeEach(() => {
  window.localStorage.clear();
  store.__resetProgressStoreForTests();
  getDigest.mockReset();
});
afterEach(() => cleanup());

describe("DigestTopItems (N-6.1)", () => {
  it("asks for the top 3 and renders a compact list with See all", async () => {
    getDigest.mockResolvedValue(digest());
    render(await DigestTopItems());
    expect(getDigest).toHaveBeenCalledWith(expect.any(Date), { limit: 3 });
    const list = screen.getByRole("list", { name: "Today's digest" });
    expect(within(list).getAllByRole("article")).toHaveLength(3);
    // compact: no why-it-matters, no tags
    expect(screen.queryByText("Why it matters")).toBeNull();
    expect(screen.getByRole("link", { name: "See all" })).toHaveAttribute("href", "/news");
  });

  it("is named 'Latest digest' and explains itself when stale", async () => {
    getDigest.mockResolvedValue(digest({ stale: true, digestDate: "2026-09-29" }));
    render(await DigestTopItems());
    expect(screen.getByRole("list", { name: "Latest digest" })).toBeInTheDocument();
    // M2 (DESIGN 6.1): "Latest · <day>" with a "Stale" badge; the column never says "today".
    expect(screen.getByRole("heading", { level: 2, name: "Latest · Tue 29 Sep" })).toBeInTheDocument();
    expect(screen.getByText("Stale")).toBeInTheDocument();
    expect(screen.queryByText(/today/i)).toBeNull();
  });

  it("has an empty state when nothing has ever run", async () => {
    getDigest.mockResolvedValue({ kind: "none" });
    render(await DigestTopItems());
    expect(screen.getByRole("region", { name: "No news yet. Run npm run news:run." })).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("says so when nothing clears the bar", async () => {
    getDigest.mockResolvedValue(digest({ ranked: [], scoredCount: 4 }));
    render(await DigestTopItems());
    expect(screen.getByText("Nothing above the relevance bar today")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all" })).toBeInTheDocument();
  });
});
