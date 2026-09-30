import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Markdown } from "@/components/lesson/markdown";
import { InlineText } from "@/components/lesson/inline-text";
import { RouteError } from "@/components/lesson/route-error";
import { DbUnavailableError } from "@/lib/db/errors";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("route error boundary", () => {
  it("shows a danger alert with retry and hides internals", () => {
    render(<RouteError error={new Error("SELECT * FROM secret")} reset={() => {}} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("This page couldn't load.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("SELECT");
  });

  it("re-throws a database-unavailable error to the app boundary", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<RouteError error={new DbUnavailableError()} reset={() => {}} />)).toThrow();
    spy.mockRestore();
  });
});

describe("InlineText", () => {
  it("renders backtick spans as code and everything else as text", () => {
    const { container } = render(<InlineText text="Run `npm test` then <b>x</b>" />);
    expect(container.querySelector("code")?.textContent).toBe("npm test");
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toBe("Run npm test then <b>x</b>");
  });

  it("leaves an unmatched backtick literal", () => {
    const { container } = render(<InlineText text="odd `tick" />);
    expect(container.querySelector("code")).toBeNull();
    expect(container.textContent).toBe("odd `tick");
  });
});

describe("markdown tables and long tokens", () => {
  it("wraps a scrollable table in a focusable labelled region", () => {
    render(<Markdown source={"| Name | Value |\n| --- | --- |\n| a | b |"} />);
    const region = screen.getByRole("region", { name: "Table: Name" });
    expect(region).toHaveAttribute("tabindex", "0");
  });

  it("lets inline code wrap anywhere", () => {
    const { container } = render(<Markdown source="Set `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` now" />);
    expect(container.querySelector("code")?.className).toContain("overflow-wrap:anywhere");
  });
});
