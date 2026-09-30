import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { PROGRESS_STORAGE_KEY } from "@/lib/contracts";
import { emptyState, markComplete } from "@/lib/progress";
import * as store from "@/lib/progress/store";
import {
  CurriculumList,
  type CurriculumListLesson,
  type CurriculumListLevel,
} from "@/components/lesson/curriculum-list";

function lesson(level: number, sort: number): CurriculumListLesson {
  return {
    slug: `l${level}-s${sort}`,
    sort,
    title: `Lesson ${level}.${sort}`,
    objective: `Objective ${level}.${sort}`,
    est_minutes: 10 + sort,
    tool_versions: { claude_code: "2.1.0", codex_cli: "0.40.0" },
    last_verified_on: "2026-09-20",
  };
}

function level(n: number, sorts: number[]): CurriculumListLevel {
  return { number: n, title: `Title ${n}`, summary: `Summary ${n}`, lessons: sorts.map((s) => lesson(n, s)) };
}

function seed(slugs: string[]) {
  let state = emptyState();
  for (const s of slugs) state = markComplete(state, s, "2026-09-29T01:00:00.000Z");
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(state));
}

beforeEach(() => {
  window.localStorage.clear();
  store.__resetProgressStoreForTests();
});

const shuffledLevels = () => [level(3, [3, 1, 4, 2]), level(1, [1, 2]), level(5, [1]), level(2, [1]), level(4, [1, 2, 3])];

describe("C-1 curriculum list", () => {
  it("TC-C-02 renders levels 1-5 in numeric order and lessons by sort", () => {
    render(<CurriculumList levels={shuffledLevels()} today="2026-09-30" />);
    const regions = screen.getAllByRole("region", { name: /^Level \d/ });
    expect(regions.map((r) => r.querySelector("h2")?.textContent)).toEqual([
      "Title 1",
      "Title 2",
      "Title 3",
      "Title 4",
      "Title 5",
    ]);
    const l3 = screen.getByRole("region", { name: /^Level 3/ });
    expect(within(l3).getAllByRole("link").map((a) => a.textContent)).toEqual([
      "Lesson 3.1",
      "Lesson 3.2",
      "Lesson 3.3",
      "Lesson 3.4",
    ]);
  });

  it("keeps the lesson number outside the link so the link name is the title", () => {
    render(<CurriculumList levels={[level(1, [1])]} today="2026-09-30" />);
    expect(screen.getByRole("link", { name: "Lesson 1.1" })).toHaveAttribute("href", "/lessons/l1-s1");
    expect(screen.getByText("1.1")).toBeInTheDocument();
  });

  it("shows the verified line and 'May be outdated' only past 60 days", () => {
    const old = { ...level(1, [1]) };
    old.lessons = [{ ...old.lessons[0], last_verified_on: "2026-07-31" }];
    const { rerender } = render(<CurriculumList levels={[old]} today="2026-09-30" />);
    expect(screen.getByText("May be outdated")).toBeInTheDocument();
    expect(screen.getByText(/Verified 31 Jul 2026 · Claude Code v2\.1\.0 \/ Codex v0\.40\.0/)).toBeInTheDocument();
    rerender(<CurriculumList levels={[old]} today="2026-09-29" />);
    expect(screen.queryByText("May be outdated")).not.toBeInTheDocument();
  });

  it("has no locked lessons and never renders 'Not started'", () => {
    render(<CurriculumList levels={shuffledLevels()} today="2026-09-30" />);
    expect(screen.queryByText(/locked/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/not started/i)).not.toBeInTheDocument();
    for (const a of screen.getAllByRole("link")) expect(a).not.toHaveAttribute("aria-disabled");
  });
});

describe("C-2 level progress", () => {
  it("TC-C-09 shows 2 / 4 with aria-valuenow 50", () => {
    seed(["l3-s1", "l3-s2"]);
    render(<CurriculumList levels={shuffledLevels()} today="2026-09-30" />);
    const l3 = screen.getByRole("region", { name: /^Level 3/ });
    expect(within(l3).getByText("2 / 4")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: "Level 3" });
    expect(bar).toHaveAttribute("aria-valuenow", "50");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("TC-C-11 handles 0 / 4 and 4 / 4", () => {
    const { unmount } = render(<CurriculumList levels={shuffledLevels()} today="2026-09-30" />);
    expect(screen.getByRole("progressbar", { name: "Level 3" })).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("0 / 4")).toBeInTheDocument();
    unmount();
    store.__resetProgressStoreForTests();
    seed(["l3-s1", "l3-s2", "l3-s3", "l3-s4"]);
    render(<CurriculumList levels={shuffledLevels()} today="2026-09-30" />);
    expect(screen.getByRole("progressbar", { name: "Level 3" })).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("4 / 4")).toBeInTheDocument();
  });

  it("TC-C-12 rounds 1 / 3 to 33", () => {
    seed(["l4-s1"]);
    render(<CurriculumList levels={shuffledLevels()} today="2026-09-30" />);
    expect(screen.getByRole("progressbar", { name: "Level 4" })).toHaveAttribute("aria-valuenow", "33");
  });

  it("TC-C-13 a level with no lessons shows 0 / 0 without NaN", () => {
    render(<CurriculumList levels={[level(1, [1]), level(5, [])]} today="2026-09-30" />);
    const l5 = screen.getByRole("region", { name: /^Level 5/ });
    expect(within(l5).getByText("0 / 0")).toBeInTheDocument();
    expect(l5.textContent).not.toMatch(/NaN/);
  });

  it("TC-C-14 completions of unknown slugs do not inflate counts", () => {
    seed(["l1-s1", "deleted-lesson-slug", "l2-retired"]);
    render(<CurriculumList levels={[level(1, [1, 2]), level(2, [1])]} today="2026-09-30" />);
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByText("0 / 1")).toBeInTheDocument();
  });

  it("marks a completed lesson row with text, not colour alone", () => {
    seed(["l1-s1"]);
    render(<CurriculumList levels={[level(1, [1, 2])]} today="2026-09-30" />);
    expect(screen.getAllByText("Completed").length).toBeGreaterThanOrEqual(1);
  });
});
