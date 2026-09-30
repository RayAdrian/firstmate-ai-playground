import { act, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurriculumLevel } from "@/components/lesson/server/queries";
import * as store from "@/lib/progress/store";

const getCurriculum = vi.fn<() => Promise<{ levels: CurriculumLevel[]; today: string }>>();
vi.mock("@/components/lesson/server/queries", () => ({ getCurriculum: () => getCurriculum() }));
vi.mock("@/components/lesson/server/test-hooks", () => ({ applyRouteHooks: async () => {} }));
vi.mock("@/components/news", () => ({ DigestTopItems: () => <p>digest column</p> }));

import { ContinueCard } from "@/components/home/continue-card";
import { HomeContent } from "@/components/home/home-content";

const lesson = (slug: string, title: string, sort: number, level: number) => ({
  id: slug,
  level_id: `lv${level}`,
  slug,
  sort,
  title,
  objective: "obj",
  est_minutes: 15,
  tool_versions: {},
  last_verified_on: null,
  number: `${level}.${sort}`,
});

const level = (n: number, title: string, lessons: ReturnType<typeof lesson>[]): CurriculumLevel =>
  ({ id: `lv${n}`, number: n, slug: `l${n}`, title, summary: "s", lessons }) as unknown as CurriculumLevel;

const LEVELS = [
  level(1, "Foundations", [lesson("l1-a", "First lesson", 1, 1), lesson("l1-b", "Second lesson", 2, 1)]),
  level(2, "Context engineering", [lesson("l2-a", "Context files", 1, 2), lesson("l2-b", "Memory", 2, 2)]),
];

beforeEach(() => {
  window.localStorage.clear();
  store.__resetProgressStoreForTests();
  getCurriculum.mockReset();
});

describe("HomeContent (DESIGN 6.1)", () => {
  it("renders the C-4.2 default Continue link, two level links and the curriculum link", async () => {
    getCurriculum.mockResolvedValue({ levels: LEVELS, today: "2026-09-30" });
    render(await HomeContent());
    const links = screen.getAllByRole("link", { name: /^Continue: .+/ });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName("Continue: First lesson");
    expect(links[0]).toHaveAttribute("href", "/lessons/l1-a");
    expect(screen.getByRole("heading", { level: 2, name: "First lesson" })).toBeInTheDocument();
    const levelLinks = screen.getAllByRole("link", { name: /^Level \d/ });
    expect(levelLinks.map((l) => l.getAttribute("href"))).toEqual(["/curriculum#level-1", "/curriculum#level-2"]);
    expect(levelLinks[1]).toHaveAccessibleName("Level 2 Context engineering");
    expect(screen.getByRole("link", { name: "View full curriculum" })).toHaveAttribute("href", "/curriculum");
    expect(screen.getByText("4 hands-on lessons. Pick up where you left off.")).toBeInTheDocument();
  });

  it("server markup has no progress bars and no counts (P-5: no false 0)", async () => {
    getCurriculum.mockResolvedValue({ levels: LEVELS, today: "2026-09-30" });
    const html = renderToString(await HomeContent());
    expect(html).not.toContain('role="progressbar"');
    expect(html).not.toContain("0 / 2");
    expect(html).toContain('data-testid="progress-placeholder"');
  });

  it("replaces Continue and the levels with the seed EmptyState when nothing is seeded (S9-02)", async () => {
    getCurriculum.mockResolvedValue({ levels: [], today: "2026-09-30" });
    render(await HomeContent());
    expect(screen.getByRole("region", { name: "No lessons seeded yet. Run npm run seed." })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Continue: / })).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
    // the news column still renders
    expect(screen.getByText("digest column")).toBeInTheDocument();
  });

  it("skips levels that have no active lessons", async () => {
    getCurriculum.mockResolvedValue({ levels: [level(1, "Empty", []), LEVELS[1]], today: "2026-09-30" });
    render(await HomeContent());
    expect(screen.getByRole("link", { name: "Continue: Context files" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /^Level \d/ })).toHaveLength(1);
  });
});

describe("ContinueCard (C-4)", () => {
  const lessons = LEVELS.flatMap((lv) =>
    lv.lessons.map((l) => ({
      slug: l.slug,
      title: l.title,
      level: lv.number,
      levelTitle: lv.title,
      minutes: l.est_minutes,
    })),
  );
  const seed = (lastViewed: { slug: string; at: string } | null) => {
    window.localStorage.setItem(
      "fm-playground:v1",
      JSON.stringify({
        version: 1,
        lessons: {},
        checklists: {},
        bookmarks: { lessons: {}, news: {} },
        prefs: { tool: "claude" },
        lastViewed,
      }),
    );
    store.__resetProgressStoreForTests();
  };

  it("swaps in place to the last viewed lesson after hydration", async () => {
    seed({ slug: "l2-a", at: "2026-09-29T01:00:00.000Z" });
    render(<ContinueCard lessons={lessons} defaultSlug="l1-a" />);
    await act(async () => {});
    const link = screen.getByRole("link", { name: /^Continue: / });
    expect(link).toHaveAccessibleName("Continue: Context files");
    expect(link).toHaveAttribute("href", "/lessons/l2-a");
    expect(screen.getByText("L2 · Context engineering · 15 min")).toBeInTheDocument();
  });

  it("falls back silently to the default for an archived or deleted last-viewed slug", async () => {
    seed({ slug: "l2-retired", at: "2026-09-29T01:00:00.000Z" });
    render(<ContinueCard lessons={lessons} defaultSlug="l1-a" />);
    await act(async () => {});
    expect(screen.getByRole("link", { name: /^Continue: / })).toHaveAccessibleName("Continue: First lesson");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("server markup is always the default, never the stored lesson", () => {
    seed({ slug: "l2-a", at: "2026-09-29T01:00:00.000Z" });
    const html = renderToString(<ContinueCard lessons={lessons} defaultSlug="l1-a" />);
    expect(html).toContain('href="/lessons/l1-a"');
    expect(html).not.toContain("l2-a");
  });

  it("keeps the whole title in the accessible name while the visible text may truncate", () => {
    render(<ContinueCard lessons={[{ ...lessons[0], title: "A".repeat(200) }]} defaultSlug="l1-a" />);
    const link = screen.getByRole("link", { name: /^Continue: / });
    expect(link).toHaveAccessibleName(`Continue: ${"A".repeat(200)}`);
    expect(within(link).getByText(/^Continue: /)).toHaveClass("truncate");
  });
});
