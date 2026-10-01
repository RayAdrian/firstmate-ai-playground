import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// CodeBlock is an async Server Component (Shiki); jsdom cannot render it, so a sync stand-in keeps the label and code.
vi.mock("@/components/ui/code-block", () => ({
  CodeBlock: ({ code, title, language }: { code: string; title?: string; language?: string }) => (
    <figure>
      <figcaption>{title ?? language ?? "text"}</figcaption>
      <pre>{code}</pre>
    </figure>
  ),
}));

import { WorkflowsThatUseThis } from "@/components/workflows/lesson-row";
import { facetOptions, SHARE_URL, WorkflowsIndexView } from "@/components/workflows/index-view";
import { WorkflowDetail } from "@/components/workflows/workflow-detail";
import { REPO_URL } from "@/lib/contracts";
import { KNOWN_STACKS, KNOWN_USE_CASES } from "@/lib/workflows/labels";
import { card, params, row, TODAY, verifiedDaysAgo } from "./helpers";

function index(rows: ReturnType<typeof card>[], p = params()) {
  const { useCases, stacks } = facetOptions(rows);
  return render(<WorkflowsIndexView rows={rows} params={p} today={TODAY} useCases={useCases} stacks={stacks} />);
}

describe("WF-30 index", () => {
  it("has one h1, a search box and a Share link that opens safely in a new tab", () => {
    index([card()]);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Workflows" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search workflows" })).toBeInTheDocument();
    const share = screen.getByRole("link", { name: /^Share/ });
    expect(share).toHaveAttribute("href", `${REPO_URL}/blob/main/CONTRIBUTING.md#share-a-workflow`);
    expect(share).toHaveAttribute("href", SHARE_URL);
    expect(share).toHaveAttribute("target", "_blank");
    expect(share).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows the count and a complete card", () => {
    index([
      card({
        slug: "no-setup",
        title: "Prompt only one",
        tools: ["codex"],
        setup_kinds: [],
        stacks: ["any"],
        verified_on: "2026-09-20",
        author_name: "Ada Lovelace",
      }),
      card({ slug: "with-setup", title: "Hook guard", setup_kinds: ["hook", "config"], stacks: ["nextjs", "react"] }),
    ]);
    expect(screen.getByText("2 workflows")).toBeInTheDocument();
    const promptOnly = screen.getByRole("link", { name: "Prompt only one" }).closest("li") as HTMLElement;
    expect(within(promptOnly).getByRole("link", { name: "Prompt only one" })).toHaveAttribute("href", "/workflows/no-setup");
    expect(within(promptOnly).getByText("Codex CLI")).toBeInTheDocument();
    expect(within(promptOnly).queryByText("Claude Code")).toBeNull();
    expect(within(promptOnly).getByText("Prompt only")).toBeInTheDocument();
    expect(within(promptOnly).getByText("Any stack")).toBeInTheDocument();
    expect(within(promptOnly).getByText("Verified 20 Sep 2026")).toBeInTheDocument();
    expect(within(promptOnly).getByText("by Ada Lovelace")).toBeInTheDocument();

    const hook = screen.getByRole("link", { name: "Hook guard" }).closest("li") as HTMLElement;
    expect(within(hook).getByText("Hook")).toBeInTheDocument();
    expect(within(hook).getByText("Config")).toBeInTheDocument();
    expect(within(hook).getByText("Claude Code")).toBeInTheDocument();
    expect(within(hook).getByText("Codex CLI")).toBeInTheDocument();
    expect(within(hook).getByText("Next.js")).toBeInTheDocument();
    expect(within(hook).queryByText("Prompt only")).toBeNull();
  });

  it("keeps the whole problem in the DOM while clamping it visually", () => {
    const problem = "A long problem sentence that goes on and on about how the agent keeps missing the point entirely.";
    index([card({ problem })]);
    const p = screen.getByText(problem);
    expect(p).toHaveClass("line-clamp-2");
    expect(p.textContent).toBe(problem);
  });

  it("shows a May be outdated badge from 61 days and hides archived rows behind Show archived (N)", () => {
    index([
      card({ slug: "ok", title: "Fresh one", verified_on: verifiedDaysAgo(60) }),
      card({ slug: "old", title: "Older one", verified_on: verifiedDaysAgo(61) }),
      card({ slug: "dead", title: "Dead one", verified_on: verifiedDaysAgo(181) }),
    ]);
    expect(screen.getByText("2 workflows")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Dead one" })).toBeNull();
    const old = screen.getByRole("link", { name: "Older one" }).closest("li") as HTMLElement;
    expect(within(old).getByText("May be outdated")).toBeInTheDocument();
    const fresh = screen.getByRole("link", { name: "Fresh one" }).closest("li") as HTMLElement;
    expect(within(fresh).queryByText("May be outdated")).toBeNull();
    expect(screen.getByRole("link", { name: "Show archived (1)" })).toHaveAttribute("href", "/workflows?archived=1");
  });

  it("with archived=1 lists archived rows with an Archived badge", () => {
    index([card({ slug: "dead", title: "Dead one", verified_on: verifiedDaysAgo(181) })], params({ archived: true }));
    const dead = screen.getByRole("link", { name: "Dead one" }).closest("li") as HTMLElement;
    expect(within(dead).getByText("Archived")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Show archived/ })).toBeNull();
  });

  it("empty database: No workflows yet. plus a Share the first one link", () => {
    index([]);
    const region = screen.getByRole("region", { name: "No workflows yet." });
    const link = within(region).getByRole("link", { name: /^Share the first one/ });
    expect(link).toHaveAttribute("href", SHARE_URL);
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("0 workflows")).toBeInTheDocument();
  });

  it("no match: the empty state has the only Clear filters link on the page", () => {
    index([card()], params({ tool: "codex", use: ["security"] }));
    expect(screen.getByRole("region", { name: "No workflows match these filters" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Clear filters" })).toHaveLength(1);
  });

  it("active filters are chips that link to the same URL minus that value", () => {
    index([card({ tools: ["codex"], use_cases: ["review", "testing"] })], params({ tool: "codex", use: ["review", "testing"], q: "plan" }));
    const chip = screen.getByRole("link", { name: "Remove filter: Review" });
    expect(chip).toHaveAttribute("href", "/workflows?tool=codex&use=testing&q=plan");
    expect(screen.getByRole("link", { name: "Remove filter: Codex CLI" })).toHaveAttribute(
      "href",
      "/workflows?use=review&use=testing&q=plan",
    );
    expect(screen.getByRole("link", { name: "Remove filter: Search: plan" })).toHaveAttribute(
      "href",
      "/workflows?tool=codex&use=review&use=testing",
    );
    expect(screen.getAllByRole("link", { name: "Clear filters" })).toHaveLength(1);
  });

  it("the filter form is a real GET form with an explicit Apply button", () => {
    index([card()], params({ tool: "claude", stack: ["nextjs"] }));
    const form = screen.getByRole("form", { name: "Filters" });
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/workflows");
    expect(screen.getByRole("button", { name: "Apply filters" })).toHaveAttribute("type", "submit");
    expect(screen.getByRole("combobox", { name: "Tool" })).toHaveValue("claude");
    expect(screen.getByRole("checkbox", { name: "Next.js" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Filters (2)" })).toHaveAttribute("aria-expanded", "false");
    // Every taxonomy value is offered even when no workflow uses it yet.
    for (const u of KNOWN_USE_CASES) expect(form.querySelector(`input[name="use"][value="${u}"]`)).not.toBeNull();
    for (const s of KNOWN_STACKS) expect(form.querySelector(`input[name="stack"][value="${s}"]`)).not.toBeNull();
    // The search box joins the form through the form attribute.
    expect(screen.getByRole("searchbox", { name: "Search workflows" })).toHaveAttribute("form", form.id);
  });
});

describe("WF-39a lesson row", () => {
  const items = [1, 2, 3].map((n) => card({ slug: `w${n}`, title: `Workflow ${n}`, problem: `Problem ${n} is described here.` }));

  it("renders nothing for zero workflows (no empty heading)", () => {
    const { container } = render(<WorkflowsThatUseThis lessonSlug="l1-a" items={[]} total={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists title and problem; no See all at three or fewer", () => {
    render(<WorkflowsThatUseThis lessonSlug="l1-a" items={items} total={3} />);
    expect(screen.getByRole("heading", { level: 2, name: "Workflows that use this" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Workflow 2/ })).toHaveAttribute("href", "/workflows/w2");
    expect(screen.getByText("Problem 2 is described here.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^See all/ })).toBeNull();
  });

  it("links See all N to the lesson-filtered index when there are more than three", () => {
    render(<WorkflowsThatUseThis lessonSlug="l1-a" items={items} total={5} />);
    expect(screen.getByRole("link", { name: "See all 5" })).toHaveAttribute("href", "/workflows?lesson=l1-a");
  });
});

describe("WF-33 to WF-38 workflow page", () => {
  const lesson = { slug: "l2-memory", number: "2.2", title: "Memory" };

  function detail(over: Partial<Parameters<typeof WorkflowDetail>[0]> = {}) {
    return render(
      <WorkflowDetail workflow={row()} freshness="fresh" lesson={lesson} urlTool={null} {...over} />,
    );
  }

  it("header: breadcrumb, eyebrow, h1, problem", () => {
    detail();
    const crumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumb).getByRole("link", { name: "Workflows" })).toHaveAttribute("href", "/workflows");
    expect(within(crumb).getByText("Plan before code")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Workflow", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Plan before code" })).toBeInTheDocument();
    expect(screen.getByText("The agent starts editing before it understands the change.", { selector: "p" })).toBeInTheDocument();
  });

  it("h2 sections come in the specified order", () => {
    detail();
    const names = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(names).toEqual(["Result", "Setup", "Prompt", "Steps", "Why it works"]);
  });

  it("Result shows Before and After cards", () => {
    detail();
    const result = screen.getByRole("region", { name: "Result" });
    expect(within(result).getByRole("heading", { level: 3, name: "Before" })).toBeInTheDocument();
    expect(within(result).getByRole("heading", { level: 3, name: "After" })).toBeInTheDocument();
    expect(within(result).getByText("The agent edits files straight away.")).toBeInTheDocument();
  });

  it("Steps is an ordered list", () => {
    detail();
    const steps = screen.getByRole("region", { name: "Steps" });
    expect(within(steps).getAllByRole("listitem")).toHaveLength(3);
    expect(steps.querySelector("ol")).not.toBeNull();
  });

  it("WF-34 Reviewed and Verified are separate and never share words", () => {
    detail();
    const reviewed = screen.getByText("Reviewed by stewards");
    expect(reviewed.textContent?.toLowerCase()).not.toContain("verified");
    // The whole Reviewed element (badge plus its date) never uses the word either.
    const reviewedWrap = reviewed.parentElement as HTMLElement;
    expect(reviewedWrap.textContent).toContain("Reviewed by stewards");
    expect(reviewedWrap.textContent?.toLowerCase()).not.toContain("verified");
    const verified = screen.getByText(/^Author-verified on Claude Code v2\.1\.0, Codex CLI v0\.40\.0/);
    expect(verified.textContent).toContain(" · ");
    expect(verified.contains(reviewed)).toBe(false);
  });

  it("WF-34 omits the Reviewed date when it is unknown but keeps the badge", () => {
    detail({ workflow: row({ reviewed_on: null }) });
    expect(screen.getByText("Reviewed by stewards")).toBeInTheDocument();
  });

  it("WF-35 renders the rail at lg and the same facts inline below, with the report link and a related lesson", () => {
    detail();
    const rail = screen.getByLabelText("At a glance", { selector: "aside" });
    expect(rail).toBeInTheDocument();
    const toc = within(rail).getByRole("navigation", { name: "On this page" });
    expect(within(toc).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      "#result",
      "#setup",
      "#prompt",
      "#steps",
      "#why-it-works",
    ]);
    for (const id of ["result", "setup", "prompt", "steps", "why-it-works"]) {
      expect(document.getElementById(id)).not.toBeNull();
    }
    const inline = screen.getByLabelText("At a glance", { selector: "section" });
    expect(within(inline).queryByRole("navigation", { name: "On this page" })).toBeNull();
    for (const scope of [rail, inline]) {
      expect(within(scope).getByRole("link", { name: /^Builds on Lesson 2\.2: Memory/ })).toHaveAttribute(
        "href",
        "/lessons/l2-memory",
      );
      const report = within(scope).getByRole("link", { name: /^Report outdated/ });
      expect(report).toHaveAttribute("target", "_blank");
      expect(report).toHaveAttribute("rel", "noopener noreferrer");
      expect(report.getAttribute("href")).toContain("title=Outdated%3A+plan-before-code&workflow=plan-before-code");
      expect(within(scope).getByText("Context file")).toBeInTheDocument();
      expect(within(scope).getByText("Next.js")).toBeInTheDocument();
    }
  });

  it("WF-35 hides Builds on when the related lesson is missing", () => {
    detail({ lesson: null });
    expect(screen.queryByRole("link", { name: /^Builds on Lesson/ })).toBeNull();
  });

  it("WF-35 shows Prompt only in the rail for a workflow with no setup files", () => {
    detail({ workflow: row({ setup: [], setup_kinds: [] }) });
    const rail = screen.getByLabelText("At a glance", { selector: "aside" });
    expect(within(rail).getByText("Prompt only")).toBeInTheDocument();
    // Both tools are covered, so each tab says so for its own tool.
    expect(screen.getByText("No setup files for Claude Code.")).toBeInTheDocument();
    expect(screen.getByText("No setup files for Codex CLI.")).toBeInTheDocument();
  });

  it("WF-36 both tools: Setup and Prompt tabs; tool-tagged setup blocks only in their tab", () => {
    detail();
    const setupTabs = screen.getByRole("tablist", { name: "Setup tool" });
    expect(within(setupTabs).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Claude Code", "Codex CLI"]);
    expect(screen.getByRole("tablist", { name: "Prompt tool" })).toBeInTheDocument();

    const claudePanel = document.getElementById("panel-setup-claude") as HTMLElement;
    const codexPanel = document.getElementById("panel-setup-codex") as HTMLElement;
    // AGENTS.md has no tool= so it is in both; the others only in their own tab.
    expect(within(claudePanel).getByText("AGENTS.md")).toBeInTheDocument();
    expect(within(codexPanel).getByText("AGENTS.md")).toBeInTheDocument();
    expect(within(claudePanel).getByText(".claude/settings.json")).toBeInTheDocument();
    expect(within(claudePanel).queryByText(".codex/config.toml")).toBeNull();
    expect(within(codexPanel).getByText(".codex/config.toml")).toBeInTheDocument();
    expect(within(codexPanel).queryByText(".claude/settings.json")).toBeNull();
    // Result, Steps and Why it works sit outside the tabs.
    for (const name of ["Result", "Steps", "Why it works"]) {
      expect(screen.getByRole("region", { name }).closest('[role="tabpanel"]')).toBeNull();
    }
  });

  it("WF-36 one tool: no tabs and no tablist in the DOM", () => {
    detail({
      workflow: row({
        tools: ["codex"],
        tool_versions: { codex_cli: "0.40.0" },
        setup: [{ path: ".codex/config.toml", kind: "config", lang: "toml", tool: "codex", code: "x" }],
        setup_kinds: ["config"],
      }),
    });
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.getByText(".codex/config.toml")).toBeInTheDocument();
    expect(screen.getByText(/^Author-verified on Codex CLI v0\.40\.0/)).toBeInTheDocument();
  });

  it("per-tool prompts: each tab shows its own prompt, a missing one falls back to shared", () => {
    detail({
      workflow: row({ prompt: { shared: "```text\nSHARED PROMPT\n```", codex: "```text\nCODEX PROMPT\n```" } }),
    });
    const claude = document.getElementById("panel-prompt-claude") as HTMLElement;
    const codex = document.getElementById("panel-prompt-codex") as HTMLElement;
    expect(within(claude).getByText("SHARED PROMPT")).toBeInTheDocument();
    expect(within(codex).getByText("CODEX PROMPT")).toBeInTheDocument();
    expect(within(codex).queryByText("SHARED PROMPT")).toBeNull();
  });

  it("WF-33 renders markdown with the L-7 rules: a script in Why it works is escaped text", () => {
    detail({ workflow: row({ why_md: "Because <script>window.__xss = 1</script> never runs, and the plan is visible." }) });
    const why = screen.getByRole("region", { name: "Why it works" });
    expect(why.querySelector("script")).toBeNull();
    expect(why.textContent).toContain("<script>window.__xss = 1</script>");
  });

  it("WF-38 an archived workflow shows the Notice and stays readable", () => {
    detail({ freshness: "archived", workflow: row({ verified_on: "2026-01-15" }) });
    expect(screen.getByText(/Archived:/)).toBeInTheDocument();
    expect(screen.getByText(/not verified since 15 Jan 2026\. Kept for reference; the setup may no longer work\./)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("WF-40 a 61-day-old workflow shows May be outdated in the header", () => {
    detail({ freshness: "outdated" });
    expect(screen.getAllByText("May be outdated").length).toBeGreaterThan(0);
  });
});
