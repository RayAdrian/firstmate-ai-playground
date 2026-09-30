import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { PROGRESS_STORAGE_KEY, type ProgressState } from "@/lib/contracts";
import { emptyState, markComplete, setToolPref, toggleChecklistItem } from "@/lib/progress";
import * as store from "@/lib/progress/store";
import { ExercisePanel, type ExercisePanelData } from "@/components/exercise/exercise-panel";
import { CompleteBlock } from "@/components/lesson/lesson-actions";
import { ToolProvider, ToolTabs } from "@/components/lesson/tool-tabs";

function persist(state: ProgressState) {
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(state));
}
function stored(): ProgressState {
  return JSON.parse(window.localStorage.getItem(PROGRESS_STORAGE_KEY) ?? "null") as ProgressState;
}

beforeEach(() => {
  window.localStorage.clear();
  store.__resetProgressStoreForTests();
  window.history.replaceState(null, "", "/lessons/x");
});

function Tabs({ initial = "claude", hasUrlTool = false }: { initial?: "claude" | "codex"; hasUrlTool?: boolean }) {
  return (
    <ToolProvider initialTool={initial} hasUrlTool={hasUrlTool}>
      <ToolTabs scope="lesson" label="Tool" panels={{ claude: <p>claude body</p>, codex: <p>codex body</p> }} />
      <ToolTabs scope="prompt" label="Starting prompt" panels={{ claude: <p>claude prompt</p>, codex: <p>codex prompt</p> }} />
    </ToolProvider>
  );
}

describe("L-2 tabs", () => {
  it("TC-C-21 ARIA structure with roving tabindex and linked ids", () => {
    render(<Tabs />);
    const tablist = screen.getByRole("tablist", { name: "Tool" });
    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
    expect(tabs.map((t) => t.textContent)).toEqual(["Claude Code", "Codex CLI"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveAttribute("tabindex", "0");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
    expect(tabs[1]).toHaveAttribute("tabindex", "-1");
    for (const t of tabs) {
      const panel = document.getElementById(t.getAttribute("aria-controls") ?? "");
      expect(panel).toHaveAttribute("role", "tabpanel");
      expect(panel).toHaveAttribute("aria-labelledby", t.id);
    }
    expect(document.getElementById("panel-lesson-codex")).toHaveAttribute("hidden");
    expect(tabs[0].querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    const ids = Array.from(document.querySelectorAll("[id]")).map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("TC-C-22/23 arrows wrap, Home/End jump, activation is automatic and shared", async () => {
    const user = userEvent.setup();
    render(<Tabs />);
    const claude = screen.getAllByRole("tab", { name: "Claude Code" })[0];
    const codex = screen.getAllByRole("tab", { name: "Codex CLI" })[0];
    act(() => claude.focus());
    await user.keyboard("{ArrowRight}");
    expect(codex).toHaveFocus();
    expect(codex).toHaveAttribute("aria-selected", "true");
    expect(window.location.search).toBe("?tool=codex");
    await user.keyboard("{ArrowRight}");
    expect(claude).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(codex).toHaveFocus();
    await user.keyboard("{Home}");
    expect(claude).toHaveFocus();
    await user.keyboard("{End}");
    expect(codex).toHaveFocus();
    // the second tablist follows (shared state)
    expect(screen.getAllByRole("tab", { name: "Codex CLI" })[1]).toHaveAttribute("aria-selected", "true");
  });

  it("TC-C-29 choosing a tab saves the preference and rewrites the URL without pushing history", async () => {
    const user = userEvent.setup();
    const before = window.history.length;
    render(<Tabs />);
    await user.click(screen.getAllByRole("tab", { name: "Codex CLI" })[0]);
    expect(stored().prefs.tool).toBe("codex");
    expect(window.location.search).toBe("?tool=codex");
    expect(window.history.length).toBe(before);
  });

  it("TC-C-28 a saved codex preference applies after hydration when the URL has no tool", () => {
    persist(setToolPref(emptyState(), "codex"));
    render(<Tabs />);
    expect(screen.getAllByRole("tab", { name: "Codex CLI" })[0]).toHaveAttribute("aria-selected", "true");
    expect(window.location.search).toBe("?tool=codex");
  });

  it("TC-C-30 an explicit URL tool wins and does not overwrite the preference", () => {
    persist(setToolPref(emptyState(), "codex"));
    render(<Tabs initial="claude" hasUrlTool />);
    expect(screen.getAllByRole("tab", { name: "Claude Code" })[0]).toHaveAttribute("aria-selected", "true");
    expect(stored().prefs.tool).toBe("codex");
  });
});

const exercise: ExercisePanelData = {
  slug: "ex-a",
  title: "Fix the test",
  goal: "Make it pass.",
  repoPath: "exercises/ex-a/starter",
  setupCmd: "cp -r a b",
  verifyCmd: null,
  prompts: { claude: "Claude prompt", codex: "Codex prompt" },
  checklist: [
    { id: "c1", text: "One" },
    { id: "c2", text: "Two" },
    { id: "c3", text: "Three" },
  ],
  solutionNotes: ["Note A", "Note B"],
};

function renderExercise() {
  return render(
    <ToolProvider initialTool="claude" hasUrlTool={false}>
      <ExercisePanel exercise={exercise} />
    </ToolProvider>,
  );
}

describe("E exercise panel", () => {
  it("TC-C-55 manual exercise shows the badge and no verify command", () => {
    renderExercise();
    expect(screen.getByText("Manual verification")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Copy code: Verify/ })).not.toBeInTheDocument();
    expect(screen.queryByText("null")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy code: Setup/ })).toBeInTheDocument();
  });

  it("TC-C-57/59 native checkboxes persist state; orphan ids are ignored in display and count", async () => {
    const user = userEvent.setup();
    persist(toggleChecklistItem(toggleChecklistItem(emptyState(), "ex-a", "c1", true), "ex-a", "zzz", true));
    renderExercise();
    const group = screen.getByRole("group", { name: "Checklist" });
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(3);
    expect(boxes.every((b) => b.tagName === "INPUT")).toBe(true);
    expect(group).toHaveTextContent("1 of 3 done");
    expect(screen.getByRole("checkbox", { name: "One" })).toBeChecked();
    await user.click(screen.getByText("Two"));
    await user.click(screen.getByText("Three"));
    expect(within(group).getByText("Exercise complete")).toBeInTheDocument();
    expect(stored().checklists["ex-a"]).toMatchObject({ c1: true, c2: true, c3: true, zzz: true });
    // TC-C-60: the lesson itself is not completed by finishing the checklist
    expect(stored().lessons).toEqual({});
    await user.click(screen.getByText("Three"));
    expect(within(group).queryByText("Exercise complete")).not.toBeInTheDocument();
  });

  it("TC-C-61 reference solution disclosure is collapsed by default and exposes the diff command", async () => {
    const user = userEvent.setup();
    renderExercise();
    const button = screen.getByRole("button", { name: "Compare with reference solution" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Note A")).not.toBeVisible();
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Note A")).toBeVisible();
    expect(screen.getByText("exercises/ex-a/solution")).toBeInTheDocument();
    expect(
      screen.getByText("git diff --no-index exercises/ex-a/starter exercises/ex-a/solution"),
    ).toBeInTheDocument();
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });
});

describe("L-5 mark complete", () => {
  it("TC-C-42/44 marks complete, shows 'Completed ✓ · Undo', focuses Undo, and undo removes the key", async () => {
    const user = userEvent.setup();
    render(<CompleteBlock slug="l1-a" />);
    await user.click(screen.getByRole("button", { name: "Mark complete" }));
    expect(stored().lessons["l1-a"].completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
    expect(screen.getByRole("button", { name: "Undo" }).parentElement).toHaveTextContent("Completed ✓ · Undo");
    const undo = screen.getByRole("button", { name: "Undo" });
    expect(undo).toHaveFocus();
    await user.click(undo);
    expect("l1-a" in stored().lessons).toBe(false);
    expect(screen.getByRole("button", { name: "Mark complete" })).toHaveFocus();
  });

  it("starts in the completed state when storage says so", () => {
    persist(markComplete(emptyState(), "l1-a", "2026-09-29T01:00:00.000Z"));
    render(<CompleteBlock slug="l1-a" />);
    expect(screen.getByRole("button", { name: "Undo" }).parentElement).toHaveTextContent("Completed ✓ · Undo");
  });
});
