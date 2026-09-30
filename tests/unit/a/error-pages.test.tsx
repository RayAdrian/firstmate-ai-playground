import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ErrorPage from "@/app/error";
import NotFound from "@/app/not-found";
import { NotFoundView } from "@/components/ui";
import { DB_UNAVAILABLE_COMMAND, DB_UNAVAILABLE_MESSAGE, DbUnavailableError } from "@/lib/db/errors";

// M2: the commands in the message render as <code> (no literal backticks), so match on the paragraph's text.
const MESSAGE_TEXT = DB_UNAVAILABLE_MESSAGE.replaceAll("`", "");
const isMessageParagraph = (_: string, el: Element | null) => el?.tagName === "P" && el.textContent === MESSAGE_TEXT;

describe("error boundary (DESIGN §6.10)", () => {
  it("DB down: h1, verbatim message, Terminal command with 'Copy code: Terminal', Try again", async () => {
    const retry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorPage error={new DbUnavailableError()} reset={vi.fn()} retry={retry} />);
    expect(screen.getByRole("heading", { level: 1, name: "Database unavailable" })).toBeInTheDocument();
    expect(screen.getByText(isMessageParagraph)).toBeInTheDocument();
    expect(screen.getByRole("figure", { name: "Terminal" })).toBeInTheDocument();
    expect(screen.getByText(DB_UNAVAILABLE_COMMAND)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy code: Terminal" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("DB down is detected from the production digest alone", () => {
    render(<ErrorPage error={Object.assign(new Error("hidden"), { digest: "DB_UNAVAILABLE" })} reset={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Database unavailable" })).toBeInTheDocument();
  });

  it("generic error: alert notice, no server message or stack, digest as an opaque reference", async () => {
    const reset = vi.fn();
    const user = userEvent.setup();
    const error = Object.assign(new Error("boom-secret-detail"), { digest: "3fa9c1" });
    error.stack = "Error: boom-secret-detail\n    at secretFn (/srv/app/node_modules/x.js:1:1)";
    const { container } = render(<ErrorPage error={error} reset={reset} />);
    expect(screen.getByRole("heading", { level: 1, name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("This page couldn't load. Your saved progress is not affected.");
    expect(screen.getByRole("link", { name: "Back to curriculum" })).toHaveAttribute("href", "/curriculum");
    expect(screen.getByText("Reference: 3fa9c1")).toBeInTheDocument();
    expect(container.innerHTML).not.toContain("boom-secret-detail");
    expect(container.innerHTML).not.toContain("node_modules");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1); // falls back to reset() when retry is not provided
  });
});

describe("404", () => {
  it("app 404 uses the branded view with a 'Go to curriculum' link", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to curriculum" })).toHaveAttribute("href", "/curriculum");
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { name: "Back to curriculum" })).toBeNull();
  });

  it("lesson variant renders the slug as escaped text", () => {
    const slug = "<img src=x onerror=alert(1)>";
    const { container } = render(
      <NotFoundView heading="Lesson not found">
        &quot;{slug}&quot; isn&apos;t in the current curriculum. It may have been renamed or archived.
      </NotFoundView>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Lesson not found" })).toBeInTheDocument();
    expect(container.querySelector("img[src='x']")).toBeNull();
    expect(container).toHaveTextContent(slug);
  });
});
