import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ShowToggle } from "@/components/news/show-toggle";

afterEach(() => cleanup());

describe("ShowToggle", () => {
  it("shows the Top count when there is one", () => {
    render(<ShowToggle date={null} show="relevant" topCount={3} allCount={9} />);
    expect(screen.getByRole("link", { name: "Top 3" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "All (9)" })).toBeInTheDocument();
  });

  it("reads 'Top' with no count when nothing is above the bar", () => {
    render(<ShowToggle date={null} show="all" topCount={0} allCount={5} />);
    expect(screen.getByRole("link", { name: "Top" })).toBeInTheDocument();
    expect(screen.queryByText(/Top 0/)).toBeNull();
  });
});
