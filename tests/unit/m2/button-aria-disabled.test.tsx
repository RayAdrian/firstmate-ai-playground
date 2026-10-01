import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui";

describe("Button aria-disabled (backlog: aria-disabled buttons ignored the mouse)", () => {
  it("reaches the caller's handler for the mouse exactly like the keyboard, and no pointer-events-none", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button aria-disabled="true" onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.className).not.toContain("pointer-events-none");
    expect(button.className).toContain("aria-disabled:opacity-50");
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    button.focus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("still fires when aria-disabled is absent", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Two</Button>);
    await user.click(screen.getByRole("button", { name: "Two" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
