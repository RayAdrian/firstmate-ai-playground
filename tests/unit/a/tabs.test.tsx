import { render, screen } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { Asterisk, Hexagon } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { Tabs, type TabItem } from "@/components/ui";

const items: TabItem[] = [
  { id: "claude", label: "Claude Code", icon: <Asterisk />, content: <p>Claude panel text</p> },
  { id: "codex", label: "Codex CLI", icon: <Hexagon />, content: <p>Codex panel text</p> },
  { id: "c", label: "Tool C", content: <p>C panel text</p> },
];

describe("Tabs ARIA (TC-A-07, TC-A-09)", () => {
  it("exposes tablist, tabs and a single visible panel with the right relationships", () => {
    render(<Tabs items={items} label="Tool" scope="lesson" />);
    expect(screen.getByRole("tablist", { name: "Tool" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    const claude = screen.getByRole("tab", { name: "Claude Code" });
    const codex = screen.getByRole("tab", { name: "Codex CLI" });
    expect(claude).toHaveAttribute("aria-selected", "true");
    expect(claude).toHaveAttribute("tabindex", "0");
    expect(codex).toHaveAttribute("aria-selected", "false");
    expect(codex).toHaveAttribute("tabindex", "-1");
    // Selector-contract ids.
    expect(claude).toHaveAttribute("id", "tab-lesson-claude");
    expect(claude).toHaveAttribute("aria-controls", "panel-lesson-claude");
    const panel = screen.getByRole("tabpanel", { name: "Claude Code" });
    expect(panel).toHaveAttribute("id", "panel-lesson-claude");
    expect(panel).toHaveAttribute("aria-labelledby", "tab-lesson-claude");
    expect(panel).toHaveAttribute("tabindex", "0");
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1); // hidden panels are out of the a11y tree
  });

  it("renders every panel in the DOM so switching needs no fetch", () => {
    render(<Tabs items={items} />);
    expect(screen.getByText("Codex panel text")).not.toBeVisible();
    expect(screen.getByText("Codex panel text")).toBeInTheDocument();
  });

  it("icons are decorative and do not change the accessible name", () => {
    render(<Tabs items={items} />);
    const tab = screen.getByRole("tab", { name: "Claude Code" });
    expect(tab.querySelector("svg")).not.toBeNull();
    expect(tab.querySelector("[aria-hidden='true'] svg, svg[aria-hidden='true']")).not.toBeNull();
    expect(tab).toHaveTextContent("Claude Code");
  });

  it("marks the active tab with a 2px bottom border class and bold weight, not colour alone (D-1.2)", () => {
    render(<Tabs items={items} />);
    const active = screen.getByRole("tab", { name: "Claude Code" });
    const inactive = screen.getByRole("tab", { name: "Codex CLI" });
    expect(active.className).toContain("border-b-2");
    expect(active.className).toContain("border-link");
    expect(active.className).toContain("font-bold");
    expect(inactive.className).toContain("border-transparent");
    expect(inactive.className).not.toContain("border-link");
  });
});

describe("Tabs keyboard (TC-A-10, TC-A-11)", () => {
  it("arrows, Home and End move focus, activate, and wrap; up/down do nothing", async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(<Controlled onValueChange={onValueChange} />);
    const tab = (name: string) => screen.getByRole("tab", { name });
    tab("Claude Code").focus();

    await user.keyboard("{ArrowRight}");
    expect(tab("Codex CLI")).toHaveFocus();
    expect(tab("Codex CLI")).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowRight}");
    expect(tab("Tool C")).toHaveFocus();
    await user.keyboard("{ArrowRight}"); // wraps
    expect(tab("Claude Code")).toHaveFocus();
    await user.keyboard("{ArrowLeft}"); // wraps back
    expect(tab("Tool C")).toHaveFocus();
    expect(onValueChange.mock.calls.map((c) => c[0])).toEqual(["codex", "c", "claude", "c"]);

    await user.keyboard("{ArrowUp}{ArrowDown}");
    expect(onValueChange).toHaveBeenCalledTimes(4);

    await user.keyboard("{Home}");
    expect(tab("Claude Code")).toHaveFocus();
    await user.keyboard("{End}");
    expect(tab("Tool C")).toHaveFocus();
    // Exactly one tab is in the tab order at any time.
    expect(screen.getAllByRole("tab").filter((t) => t.getAttribute("tabindex") === "0")).toEqual([tab("Tool C")]);
  });

  it("does not fire onValueChange when the active tab is re-selected", async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(<Tabs items={items} value="claude" onValueChange={onValueChange} />);
    await user.click(screen.getByRole("tab", { name: "Claude Code" }));
    expect(onValueChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("tab", { name: "Codex CLI" }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it("Tab enters the active tab (never the first), then the panel; the others are not tab stops", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Before</button>
        <Tabs items={items} value="codex" />
      </>,
    );
    screen.getByRole("button", { name: "Before" }).focus();
    await user.tab();
    expect(screen.getByRole("tab", { name: "Codex CLI" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("tabpanel", { name: "Codex CLI" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("tab", { name: "Codex CLI" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Before" })).toHaveFocus();
  });

  it("works uncontrolled and falls back to the first tab for an unknown value", async () => {
    const user = userEvent.setup();
    render(<Tabs items={items} />);
    await user.click(screen.getByRole("tab", { name: "Codex CLI" }));
    expect(screen.getByText("Codex panel text")).toBeVisible();
    render(<Tabs items={items} value="nope" label="Other" />);
    expect(within2("Other")).toHaveAttribute("aria-selected", "true");
  });
});

function within2(listName: string): HTMLElement {
  const list = screen.getByRole("tablist", { name: listName });
  return list.querySelector("[role=tab]") as HTMLElement;
}

function Controlled({ onValueChange }: { onValueChange: (id: string) => void }) {
  const [value, setValue] = useState("claude");
  return (
    <Tabs
      items={items}
      value={value}
      onValueChange={(id) => {
        onValueChange(id);
        setValue(id);
      }}
    />
  );
}
