import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Tabs } from "@/components/ui";

const items = [
  { id: "claude", label: "Claude Code", content: <p>claude body</p> },
  { id: "codex", label: "Codex CLI", content: <p>codex body</p> },
  { id: "extra", label: "Extra", content: <p>extra body</p> },
];

function setup() {
  render(<Tabs items={items} label="Tool" />);
  return {
    user: userEvent.setup(),
    tab: (name: string) => screen.getByRole("tab", { name }),
  };
}

describe("Tabs keyboard pattern", () => {
  it("uses roving tabindex with only the active tab in the tab order", () => {
    const { tab } = setup();
    expect(tab("Claude Code")).toHaveAttribute("tabindex", "0");
    expect(tab("Codex CLI")).toHaveAttribute("tabindex", "-1");
    expect(tab("Extra")).toHaveAttribute("tabindex", "-1");
  });

  it("ArrowRight moves focus, selects, and wraps from last to first", async () => {
    const { user, tab } = setup();
    tab("Claude Code").focus();
    await user.keyboard("{ArrowRight}");
    expect(tab("Codex CLI")).toHaveFocus();
    expect(tab("Codex CLI")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("codex body")).toBeVisible();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(tab("Claude Code")).toHaveFocus();
    expect(tab("Claude Code")).toHaveAttribute("aria-selected", "true");
  });

  it("ArrowLeft wraps from first to last", async () => {
    const { user, tab } = setup();
    tab("Claude Code").focus();
    await user.keyboard("{ArrowLeft}");
    expect(tab("Extra")).toHaveFocus();
    expect(tab("Extra")).toHaveAttribute("aria-selected", "true");
  });

  it("Home and End jump to the first and last tab", async () => {
    const { user, tab } = setup();
    tab("Claude Code").focus();
    await user.keyboard("{End}");
    expect(tab("Extra")).toHaveFocus();
    await user.keyboard("{Home}");
    expect(tab("Claude Code")).toHaveFocus();
    expect(tab("Claude Code")).toHaveAttribute("aria-selected", "true");
  });

  it("falls back to the first tab when value is unknown", () => {
    render(<Tabs items={items} value="nope" />);
    expect(screen.getByRole("tab", { name: "Claude Code" })).toHaveAttribute("aria-selected", "true");
  });
});
