import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ErrorPage from "@/app/error";
import { Card } from "@/components/ui";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

describe("route error boundary keeps keyboard focus while retrying", () => {
  it("'Try again' is busy but not disabled, and stays focused, while the retry is pending", async () => {
    const user = userEvent.setup();
    const retry = vi.fn(() => new Promise<void>(() => {}));
    render(<ErrorPage error={new Error("boom")} reset={vi.fn()} retry={retry} />);
    const button = screen.getByRole("button", { name: "Try again" });
    button.focus();
    await user.keyboard("{Enter}");
    expect(retry).toHaveBeenCalledTimes(1);
    const pending = screen.getByRole("button", { name: /Try again/ });
    expect(pending).toHaveAttribute("aria-busy", "true");
    expect(pending).not.toBeDisabled();
    expect(pending).toHaveFocus();
  });
});

describe("Card.Link", () => {
  it("draws its own focus ring on the stretched area, so a non-interactive Card is still focus-visible", () => {
    render(
      <Card>
        <Card.Link href="/x">Open</Card.Link>
      </Card>,
    );
    const link = screen.getByRole("link", { name: "Open" });
    expect(link.className).toContain("focus-visible:after:outline-2");
    expect(link.className).toContain("focus-visible:after:outline-focus");
  });

  it("an interactive Card keeps a single ring (the link's own is suppressed by the card)", () => {
    const { container } = render(
      <Card interactive>
        <Card.Link href="/x">Open</Card.Link>
      </Card>,
    );
    expect(container.firstElementChild?.className).toContain("[&_a:focus-visible]:after:outline-none");
  });
});
