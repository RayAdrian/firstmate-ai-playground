import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LessonTldr } from "@/lib/contracts";
import { CurriculumList, type CurriculumListLevel } from "@/components/lesson/curriculum-list";
import { LessonRail } from "@/components/lesson/lesson-sections";
import type { LessonMediaItem } from "@/components/lesson/server/media";
import { TldrCard } from "@/components/lesson/tldr-card";

vi.mock("@/components/lesson/curriculum-progress", () => ({
  LessonState: () => null,
  LevelProgress: () => null,
  RailCount: () => null,
}));

const all: LessonTldr = {
  points: ["Use `git` first: <b>x</b> and [a](b) stay literal.", "Second point is plain text.", "Third point is plain text."],
  try_this: { all: { kind: "command", text: "claude --version && codex --version" } },
};
const perTool: LessonTldr = {
  points: all.points,
  try_this: {
    claude: { kind: "prompt", text: "Use a subagent to run the tests." },
    codex: { kind: "command", text: "codex exec 'run the tests'" },
  },
};

const video: LessonMediaItem = {
  manifest: {
    id: "tldr",
    lesson_slug: "l9-demo",
    kind: "tldr",
    title: "TL;DR: Demo",
    duration_s: 30.6,
    width: 1280,
    height: 720,
    tool_versions: { claude_code: "2.1.0" },
    made_on: "2026-10-01",
    model_calls: false,
    source_hash: "h",
    template_version: 1,
  },
  videoUrl: "/media/lessons/l9-demo/tldr.mp4",
  posterUrl: "/media/lessons/l9-demo/tldr.webp",
  captionsUrl: "/media/lessons/l9-demo/tldr.vtt",
  transcript: "Title card: Demo\nPoint 1 of 3: x",
};

describe("TldrCard text (TL-5, TL-6)", () => {
  it("renders the region, h2, exactly 3 points in order, and no video row without a video", () => {
    const { container } = render(<TldrCard title="Demo" tldr={all} video={null} />);
    const card = screen.getByTestId("tldr-card");
    expect(card.tagName).toBe("SECTION");
    expect(card).toHaveAttribute("aria-labelledby", "tldr");
    expect(within(card).getByRole("heading", { level: 2, name: "TL;DR" })).toHaveAttribute("id", "tldr");
    const list = container.querySelector("ul#tldr-points")!;
    expect(list).toHaveAttribute("tabindex", "-1");
    const items = list.querySelectorAll(":scope > li");
    expect(items).toHaveLength(3);
    expect(items[1]).toHaveTextContent("Second point is plain text.");
    expect(container.querySelector("summary")).toBeNull();
    expect(container.querySelector("video")).toBeNull();
    expect(container).not.toHaveTextContent("TL;DR video");
  });

  it("shows markup literally and backtick spans as code", () => {
    const { container } = render(<TldrCard title="Demo" tldr={all} video={null} />);
    const first = container.querySelector("ul#tldr-points li")!;
    expect(first.querySelector("code")).toHaveTextContent("git");
    expect(first).toHaveTextContent("<b>x</b>");
    expect(first).toHaveTextContent("[a](b)");
    expect(first.querySelector("b")).toBeNull();
    expect(first.querySelector("a")).toBeNull();
  });

  it("has one Terminal block and the command lead for an all/command entry", () => {
    render(<TldrCard title="Demo" tldr={all} video={null} />);
    const card = screen.getByTestId("tldr-card");
    expect(within(card).getByRole("heading", { level: 3, name: "Try this" })).toBeInTheDocument();
    expect(within(card).getByText("Run it in your terminal, in any repo.")).toBeInTheDocument();
    expect(within(card).getAllByRole("figure")).toHaveLength(1);
    expect(within(card).getByRole("button", { name: "Copy code: Terminal" })).toBeInTheDocument();
  });

  it("labels an all/prompt entry Prompt with the prompt lead", () => {
    const t: LessonTldr = { points: all.points, try_this: { all: { kind: "prompt", text: "Do the thing." } } };
    render(<TldrCard title="Demo" tldr={t} video={null} />);
    expect(screen.getByRole("button", { name: "Copy code: Prompt" })).toBeInTheDocument();
    expect(screen.getByText("Type it into your agent.")).toBeInTheDocument();
  });

  it("always has two blocks, Claude Code then Codex CLI, with a lead generated from the kinds", () => {
    render(<TldrCard title="Demo" tldr={perTool} video={null} />);
    const card = screen.getByTestId("tldr-card");
    const figs = within(card).getAllByRole("figure");
    expect(figs).toHaveLength(2);
    expect(figs[0]).toHaveTextContent("Claude Code");
    expect(figs[1]).toHaveTextContent("Codex CLI");
    expect(
      within(card).getByText("Claude Code: type it into the agent. Codex CLI: run it in your terminal."),
    ).toBeInTheDocument();
  });

  it("uses the shared lead when both tools have the same kind", () => {
    const t: LessonTldr = {
      points: all.points,
      try_this: {
        claude: { kind: "command", text: "claude --version" },
        codex: { kind: "command", text: "codex --version" },
      },
    };
    render(<TldrCard title="Demo" tldr={t} video={null} />);
    expect(screen.getByText("Run it in your terminal, in any repo.")).toBeInTheDocument();
    expect(screen.getAllByRole("figure")).toHaveLength(2);
  });
});

describe("TldrCard video row (TL-14, TL-15)", () => {
  it("renders a closed details row above the points, with no Watch wording and no autoplay", () => {
    const { container } = render(<TldrCard title="Demo" tldr={all} video={video} />);
    const details = container.querySelector("details")!;
    expect(details).not.toHaveAttribute("open");
    const summary = details.querySelector("summary#tldr-video-toggle")!;
    expect(summary).toHaveTextContent("TL;DR video");
    expect(summary).toHaveTextContent("0:31 · No sound");
    expect(summary).not.toHaveTextContent(/watch/i);
    expect(summary.querySelector("time")).toHaveAttribute("datetime", "PT31S");
    expect(summary.querySelector("img")).toHaveAttribute("src", "/media/lessons/l9-demo/tldr.webp");
    expect(summary.querySelector("img")).toHaveAttribute("alt", "");
    const v = container.querySelector("video")!;
    expect(v).toHaveAttribute("controls");
    expect(v).toHaveAttribute("preload", "none");
    expect(v).toHaveAttribute("playsinline");
    expect(v).toHaveAttribute("poster", "/media/lessons/l9-demo/tldr.webp");
    expect(v).toHaveAttribute("aria-label", "TL;DR video: Demo");
    for (const a of ["autoplay", "loop", "muted"]) expect(v).not.toHaveAttribute(a);
    const track = v.querySelector("track")!;
    expect(track).toHaveAttribute("kind", "captions");
    expect(track).toHaveAttribute("srclang", "en");
    expect(track).toHaveAttribute("default");
    // Row comes before the points in the DOM.
    expect(details.compareDocumentPosition(container.querySelector("ul#tldr-points")!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("has Read instead before the transcript, and a plain-text transcript", () => {
    const { container } = render(<TldrCard title="Demo" tldr={all} video={video} />);
    const read = screen.getByRole("link", { name: "Read instead" });
    expect(read).toHaveAttribute("href", "#tldr-points");
    const toggle = container.querySelector("summary#tldr-transcript-toggle")!;
    expect(toggle).toHaveTextContent("Transcript");
    expect(toggle).toHaveTextContent("Transcript for TL;DR video");
    expect(read.compareDocumentPosition(toggle)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    const panel = container.querySelector("[role=region][aria-labelledby=tldr-transcript-toggle]")!;
    expect(panel).toHaveTextContent("Title card: Demo");
  });
});

describe("curriculum first point (TL-7)", () => {
  const lesson = (slug: string, tldrFirst: string | null) => ({
    slug,
    sort: 1,
    title: `Title ${slug}`,
    objective: `Objective of ${slug}`,
    est_minutes: 10,
    tool_versions: {},
    last_verified_on: null,
    tldr: tldrFirst ? { points: [tldrFirst, "b", "c"] } : null,
  });
  const levels: CurriculumListLevel[] = [
    { number: 1, title: "L", summary: "S", lessons: [lesson("with", "First `point` here."), { ...lesson("without", null), sort: 2 }] },
  ];

  it("shows the first point in place of the objective, in the same clamped element, and keeps the objective otherwise", () => {
    const { container } = render(<CurriculumList levels={levels} today="2026-10-01" />);
    const rows = container.querySelectorAll("ol > li");
    const p = rows[0]!.querySelector("p.line-clamp-2")!;
    expect(p).toHaveTextContent("First point here.");
    expect(p.querySelector("code")).toHaveTextContent("point");
    expect(rows[0]).not.toHaveTextContent("Objective of with");
    expect(rows[0]).not.toHaveTextContent("TL;DR");
    expect(rows[1]!.querySelector("p.line-clamp-2")).toHaveTextContent("Objective of without");
  });
});

describe("rail entry", () => {
  it("lists TL;DR first, linking to #tldr, only when asked", () => {
    const { rerender } = render(<LessonRail hasExercise={false} hasTldr />);
    const links = within(screen.getByRole("navigation", { name: "On this lesson", hidden: true })).getAllByRole("link", {
      hidden: true,
    });
    expect(links[0]).toHaveTextContent("TL;DR");
    expect(links[0]).toHaveAttribute("href", "#tldr");
    rerender(<LessonRail hasExercise={false} />);
    expect(screen.queryByText("TL;DR")).toBeNull();
  });
});
