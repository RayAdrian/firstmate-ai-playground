import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// CodeBlock is an async client component; the Why section does not use it, but the sections module imports it.
vi.mock("@/components/ui/code-block", () => ({ CodeBlock: () => null }));

const media = vi.hoisted(() => ({ items: [] as unknown[] }));
vi.mock("@/components/lesson/server/media", () => ({ getLessonMedia: vi.fn(async () => media.items) }));
vi.mock("@/components/lesson/server/queries", () => ({
  getCurriculum: vi.fn(async () => ({
    levels: [{ number: 1, lessons: [{ slug: "l1-first-session", number: "1.1", title: "First session" }] }],
  })),
}));

const db = vi.hoisted(() => ({ row: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ dbRead: vi.fn(async () => db.row) }));
vi.mock("@/lib/db/server", () => ({ getReadClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ is: () => ({ maybeSingle: () => null }) }) }) }) }) }));
vi.mock("@/lib/time/now", () => ({ getNow: vi.fn(async () => new Date("2026-09-30T05:00:00Z")), manilaDate: () => "2026-09-30" }));

import { WatchLine } from "@/components/diagram/watch-line";
import { WhySection } from "@/components/workflows/workflow-sections";
import { getWorkflowPage } from "@/lib/workflows/queries";
import { flowInput, parse } from "../g0/fixtures";

const item = (kind: "animation" | "recording" = "recording") => ({
  manifest: { id: "l1-first-session", lesson_slug: "l1-first-session", kind, title: "First session: a working install" },
});

beforeEach(() => {
  media.items = [item()];
  vi.restoreAllMocks();
});

describe("DG-11: the watch line", () => {
  it("renders 'Watch: <title> (Lesson X.Y) →' linking to the Watch block's heading id", async () => {
    const el = await WatchLine({ watch: "l1-first-session/l1-first-session", context: "workflow w" });
    const { container } = render(el);
    const a = container.querySelector("a")!;
    expect(a.getAttribute("href")).toBe("/lessons/l1-first-session#watch-l1-first-session");
    expect(a.textContent).toBe("Watch: First session: a working install (Lesson 1.1) →");
    expect(a.querySelector('[aria-hidden="true"]:not(svg)')!.textContent).toBe(" →");
    expect(container.querySelectorAll("a")).toHaveLength(1);
  });

  it("is omitted and logged when the manifest is missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    media.items = [];
    expect(await WatchLine({ watch: "l1-first-session/l1-first-session", context: "workflow w" })).toBeNull();
    expect(String(warn.mock.calls[0]?.[0])).toContain("workflow w");
  });

  it("is omitted and logged when the lesson is gone or archived", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    media.items = [{ manifest: { id: "x", lesson_slug: "l7-gone", kind: "animation", title: "T" } }];
    expect(await WatchLine({ watch: "l7-gone/x", context: "workflow w" })).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("DG-10: the diagram sits first in 'Why it works'", () => {
  it("renders the figure before the prose, as a band, inside the section", () => {
    const { container } = render(<WhySection why="Because." diagram={parse(flowInput())} />);
    const section = container.querySelector("section")!;
    const kids = [...section.children].map((c) => c.tagName);
    expect(kids).toEqual(["H2", "FIGURE", "P"]);
    expect(section.querySelector("figure")!.className).toContain("-mx-5");
    expect(section.querySelector("figure")!.className).not.toContain("rounded");
  });

  it("without a diagram or watch it renders exactly as before", () => {
    const { container } = render(<WhySection why="Because." />);
    expect([...container.querySelector("section")!.children].map((c) => c.tagName)).toEqual(["H2", "P"]);
    expect(container.querySelector("figure")).toBeNull();
  });
});

describe("DG-9: an invalid stored workflow diagram never 404s or crashes the page", () => {
  const row = (over: Record<string, unknown>) => ({
    id: "00000000-0000-0000-0000-000000000001",
    slug: "w",
    title: "A workflow",
    problem: "Something goes wrong here",
    tools: ["claude-code"],
    setup: [],
    setup_kinds: [],
    prompt: { shared: "x" },
    result_before: "b".repeat(30),
    result_after: "a".repeat(30),
    steps: ["one", "two", "three"],
    why_md: "w".repeat(60),
    use_cases: ["testing"],
    stacks: ["any"],
    related_lesson_slug: null,
    level: null,
    tool_versions: { claude_code: "2.1.0" },
    verified_on: "2026-09-20",
    author_name: "A",
    reviewed_on: "2026-09-25",
    content_hash: "h",
    created_at: "2026-09-20T00:00:00Z",
    updated_at: "2026-09-20T00:00:00Z",
    removed_at: null,
    diagram: null,
    watch: null,
    ...over,
  });

  it("returns the page with diagram null, and logs, when the stored diagram fails validation", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    db.row = row({ diagram: { type: "flow", id: "bad", title: "T", summary: "S", steps: [] } });
    const data = await getWorkflowPage("w");
    expect(data).not.toBeNull();
    expect(data?.workflow.diagram).toBeNull();
    expect(String(warn.mock.calls[0]?.[0])).toContain("workflow w");
  });

  it("returns the page with watch null, and logs, when the stored watch is malformed", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    db.row = row({ watch: "NOT A WATCH" });
    const data = await getWorkflowPage("w");
    expect(data?.workflow.watch).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("keeps a valid stored diagram and watch", async () => {
    db.row = row({ diagram: parse(flowInput()), watch: "l1-first-session/l1-first-session" });
    const data = await getWorkflowPage("w");
    expect(data?.workflow.diagram?.id).toBe("ask-loop");
    expect(data?.workflow.watch).toBe("l1-first-session/l1-first-session");
  });

  it("still returns null for a row that fails the contract for another reason", async () => {
    db.row = row({ tools: ["nope"] });
    expect(await getWorkflowPage("w")).toBeNull();
  });
});
