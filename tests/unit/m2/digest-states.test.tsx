import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Digest } from "@/components/news/queries";
import * as store from "@/lib/progress/store";

const getDigest = vi.fn<(now: Date, opts?: { limit?: number }) => Promise<Digest>>();
vi.mock("@/components/news/queries", () => ({ getDigest: (...args: Parameters<typeof getDigest>) => getDigest(...args) }));
vi.mock("@/lib/time/now", () => ({ getNow: async () => new Date("2026-09-30T13:00:00+08:00") }));

import { DigestTopItems } from "@/components/news";

const emptyDigest = (over: Partial<Extract<Digest, { kind: "digest" }>> = {}): Digest => ({
  kind: "digest",
  digestDate: "2026-09-30",
  updatedAt: "2026-09-30T08:03:00+08:00",
  stale: false,
  ranked: [],
  scoredCount: 4,
  unscored: [],
  ...over,
});

beforeEach(() => {
  window.localStorage.clear();
  store.__resetProgressStoreForTests();
  getDigest.mockReset();
});

describe("home news column states (N-6.1, TC-M2-07/08/09)", () => {
  it("no runs ever: compact EmptyState with the PRD string, See all still present", async () => {
    getDigest.mockResolvedValue({ kind: "none" });
    render(await DigestTopItems());
    expect(screen.getByRole("region", { name: "No news yet. Run npm run news:run." })).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByRole("link", { name: "See all" })).toHaveAttribute("href", "/news");
  });

  it("nothing above the bar: copy plus an archive link to the same target as /news", async () => {
    getDigest.mockResolvedValue(emptyDigest());
    render(await DigestTopItems());
    expect(screen.getByText("Nothing above the relevance bar today")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See today's items in the archive" })).toHaveAttribute(
      "href",
      "/news/archive?from=2026-09-30&to=2026-09-30&min=0",
    );
    expect(screen.getByRole("link", { name: "See all" })).toHaveAttribute("href", "/news");
  });

  it("stale and empty never says 'today' in the column", async () => {
    getDigest.mockResolvedValue(emptyDigest({ stale: true, digestDate: "2026-09-29" }));
    render(await DigestTopItems());
    expect(screen.getByRole("heading", { level: 2, name: "Latest · Tue 29 Sep" })).toBeInTheDocument();
    expect(screen.queryByText(/today/i)).toBeNull();
  });

  it("fresh digest heading is 'Today · <day>' with no Stale badge", async () => {
    getDigest.mockResolvedValue(emptyDigest());
    render(await DigestTopItems());
    expect(screen.getByRole("heading", { level: 2, name: "Today · Wed 30 Sep" })).toBeInTheDocument();
    expect(screen.queryByText("Stale")).toBeNull();
  });
});
