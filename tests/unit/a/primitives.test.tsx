import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Bookmark } from "lucide-react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  FilterChip,
  Notice,
  ProgressBar,
  Skeleton,
  SkeletonRegion,
  announce,
  LiveRegion,
  progressPercent,
} from "@/components/ui";

describe("ProgressBar (TC-A-20)", () => {
  it.each([
    [2, 4, 50],
    [0, 4, 0],
    [4, 4, 100],
    [1, 3, 33],
    [0, 0, 0],
    [5, 4, 100],
    [-1, 4, 0],
  ])("value %s of %s gives aria-valuenow %s", (value, max, expected) => {
    render(<ProgressBar label="Level 3" value={value} max={max} />);
    const bar = screen.getByRole("progressbar", { name: "Level 3" });
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAttribute("aria-valuenow", String(expected));
    expect(bar.outerHTML).not.toContain("NaN");
  });

  it("rounds half up and keeps aria-valuetext", () => {
    expect(progressPercent(1, 8)).toBe(13); // 12.5
    render(<ProgressBar label="Level 2" value={2} max={4} valueText="2 of 4 lessons complete" />);
    expect(screen.getByRole("progressbar", { name: "Level 2" })).toHaveAttribute(
      "aria-valuetext",
      "2 of 4 lessons complete",
    );
  });

  it("shows the paired visible count on request, including 0 / 0", () => {
    render(<ProgressBar label="Level 1" value={0} max={0} showCount />);
    expect(screen.getByText("0 / 0")).toBeInTheDocument();
  });

  it("renders a same-size placeholder with no role before the client has mounted", async () => {
    // Server render: useSyncExternalStore uses the server snapshot, so no progressbar is emitted.
    const { renderToString } = await import("react-dom/server");
    const html = renderToString(<ProgressBar label="Level 3" value={2} max={4} showCount />);
    expect(html).toContain('data-testid="progress-placeholder"');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("progressbar");
    expect(html).not.toContain("0 / ");
  });
});

describe("Checkbox (TC-A-21)", () => {
  function Harness({ spy }: { spy: (v: boolean) => void }) {
    const [checked, setChecked] = useState(false);
    return (
      <>
        <button type="button">Before</button>
        <Checkbox
          id="c1"
          label="Test is green"
          checked={checked}
          onChange={(v) => {
            spy(v);
            setChecked(v);
          }}
        />
      </>
    );
  }

  it("is a native, labelled checkbox toggled by Space and by clicking the label; Enter does nothing", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(<Harness spy={spy} />);
    const box = screen.getByRole("checkbox", { name: "Test is green" });
    expect(box.tagName).toBe("INPUT");
    expect(box).toHaveAttribute("type", "checkbox");
    screen.getByRole("button", { name: "Before" }).focus();
    await user.tab();
    expect(box).toHaveFocus();
    await user.keyboard(" ");
    expect(spy).toHaveBeenLastCalledWith(true);
    await user.click(screen.getByText("Test is green"));
    expect(spy).toHaveBeenLastCalledWith(false);
    await user.keyboard("{Enter}");
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("supports disabled (used before hydration)", () => {
    render(<Checkbox label="Item" checked={false} onChange={() => {}} disabled />);
    expect(screen.getByRole("checkbox", { name: "Item" })).toBeDisabled();
  });
});

describe("Notice (TC-A-22, DESIGN §4.10 and §11.4)", () => {
  it("defaults: polite status, danger alert, error is an alias of danger", () => {
    render(
      <>
        <Notice tone="info">info</Notice>
        <Notice tone="warning">warn</Notice>
        <Notice tone="success">ok</Notice>
        <Notice tone="neutral">neutral</Notice>
        <Notice tone="danger">danger</Notice>
        <Notice tone="error">error</Notice>
      </>,
    );
    expect(screen.getAllByRole("status").map((n) => n.textContent)).toEqual(["info", "warn", "ok", "neutral"]);
    expect(screen.getAllByRole("alert").map((n) => n.textContent)).toEqual(["danger", "error"]);
    expect(screen.getByText("error").closest("[data-tone]")).toHaveAttribute("data-tone", "danger");
  });

  it("live={false} renders no live role (server-rendered content); live can be overridden", () => {
    render(
      <>
        <Notice tone="warning" live={false}>
          stale
        </Notice>
        <Notice tone="danger" live="polite">
          soft danger
        </Notice>
        <Notice tone="info" live="assertive">
          loud info
        </Notice>
      </>,
    );
    expect(screen.getByText("stale").closest("[data-tone]")).not.toHaveAttribute("role");
    expect(screen.getByText("soft danger").closest("[role]")).toHaveAttribute("role", "status");
    expect(screen.getByText("loud info").closest("[role]")).toHaveAttribute("role", "alert");
  });

  it("dismiss removes the notice, fires onDismiss once and moves focus to the main heading", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Before</button>
        <Notice tone="warning" dismissible onDismiss={onDismiss}>
          Saved progress was unreadable and has been reset
        </Notice>
        <main>
          <h1>Page title</h1>
        </main>
      </>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Saved progress was unreadable and has been reset");
    screen.getByRole("button", { name: "Before" }).focus();
    await user.tab();
    const dismiss = screen.getByRole("button", { name: "Dismiss" });
    expect(dismiss).toHaveFocus();
    expect(dismiss.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("status")).toBeNull();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });

  it("renders a title, body and actions", () => {
    render(
      <Notice tone="danger" title="Import failed" actions={<button type="button">Retry</button>}>
        <p>Nothing was changed.</p>
      </Notice>,
    );
    expect(screen.getByText("Import failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

describe("Skeleton (TC-A-23)", () => {
  it("skeleton blocks are hidden from assistive tech; the region exposes one status", () => {
    render(
      <SkeletonRegion testId="curriculum-skeleton" label="Loading curriculum…">
        <Skeleton.Title />
        <Skeleton.Text lines={4} />
        <Skeleton.Row />
        <Skeleton.NewsCard />
        <Skeleton.Badge />
        <Skeleton className="h-9 w-20" />
      </SkeletonRegion>,
    );
    const region = screen.getByTestId("curriculum-skeleton");
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Loading curriculum…");
    const blocks = region.querySelectorAll(":scope > div");
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) expect(block).toHaveAttribute("aria-hidden", "true");
  });
});

describe("EmptyState (TC-A-24)", () => {
  it("renders title, body, command and action; region is named by its title", () => {
    render(
      <EmptyState
        title={
          <>
            No lessons seeded yet. Run <code>npm run seed</code>.
          </>
        }
        command="npm run seed"
        action={{ label: "Clear filters", href: "/news/archive" }}
      >
        The curriculum is empty.
      </EmptyState>,
    );
    expect(screen.getByRole("region", { name: "No lessons seeded yet. Run npm run seed." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy code: Terminal" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute("href", "/news/archive");
  });

  it("renders no command or action chrome when the props are absent", () => {
    render(<EmptyState title="Nothing bookmarked yet" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByRole("heading", { name: "Nothing bookmarked yet" })).toBeInTheDocument();
  });
});

describe("Button, Card, Badge, FilterChip", () => {
  it("Button defaults to type=button, merges classes and keeps stub props working", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button onClick={onClick} className="border-danger text-danger" aria-disabled>
        Reset all progress
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Reset all progress" });
    expect(button).toHaveAttribute("type", "button");
    expect(button.className).toContain("border-danger");
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1); // aria-disabled stays focusable and clickable; callers guard
    expect(button.className).toContain("aria-disabled:opacity-50"); // the visual treatment matches aria-disabled
  });

  it("Button loading sets aria-busy and swaps the icon for a spinner", () => {
    const { rerender } = render(
      <Button icon={<Bookmark data-testid="icon" />} variant="primary">
        Save
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Save" })).not.toHaveAttribute("aria-busy");
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    rerender(
      <Button icon={<Bookmark data-testid="icon" />} variant="primary" loading>
        Save
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByTestId("icon")).toBeNull();
  });

  it("Card renders its parts and a stretched link", () => {
    render(
      <Card as="article" interactive>
        <Card.Header eyebrow="Level 2" title="Context engineering" as="h3" />
        <Card.Body>body</Card.Body>
        <Card.Footer>
          <Card.Link href="/curriculum#level-2">Open</Card.Link>
        </Card.Footer>
      </Card>,
    );
    expect(screen.getByRole("article")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Context engineering" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open" }).className).toContain("after:absolute");
  });

  it("Badge pairs an icon with text and FilterChip names the removal", () => {
    render(
      <>
        <Badge variant="success" icon={<Bookmark data-testid="i" />}>
          Completed
        </Badge>
        <FilterChip label="Tooling" href="/news/archive" />
      </>,
    );
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByTestId("i").closest("[aria-hidden='true']")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Remove filter: Tooling" })).toHaveAttribute("href", "/news/archive");
  });
});

describe("announce()", () => {
  it("clears then sets the text on the next frame in the single live region", async () => {
    render(<LiveRegion />);
    const region = document.getElementById("fm-live") as HTMLElement;
    expect(region).toHaveAttribute("role", "status");
    announce("Lesson marked complete");
    expect(region).toHaveTextContent("");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40));
    });
    expect(region).toHaveTextContent("Lesson marked complete");
    // Repeating the same message re-announces (cleared first).
    announce("Lesson marked complete");
    expect(region).toHaveTextContent("");
  });

  it("creates a hidden region when the shell is absent", async () => {
    announce("hello");
    expect(document.getElementById("fm-live")).not.toBeNull();
    document.getElementById("fm-live")?.remove();
  });
});
