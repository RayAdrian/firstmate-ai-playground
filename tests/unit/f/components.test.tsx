import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NewsCard } from "@/components/news/news-card";
import type { NewsCardItem } from "@/components/news/queries";
import { UnscoredSection } from "@/components/news/unscored-section";
import NewsArchiveError from "@/app/news/archive/error";
import { DbUnavailableError } from "@/lib/db/errors";
import * as store from "@/lib/progress/store";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const item = (over: Partial<NewsCardItem> = {}): NewsCardItem => ({
  id: "11111111-1111-4111-8111-111111111111",
  title: "Model release",
  url: "https://example.com/post",
  sourceName: "Fixture Source",
  publishedAt: "2026-09-29T22:01:00+00:00",
  score: 87,
  tags: ["security", "new-model"],
  why: "Because it matters",
  status: "scored",
  ...over,
});

beforeEach(() => {
  window.localStorage.clear();
  store.__resetProgressStoreForTests();
});
afterEach(() => {
  cleanup();
  store.__resetProgressStoreForTests();
});

describe("NewsCard (N-1.3)", () => {
  it("shows link, source, Manila date, score, tags in fixed order and why-it-matters", () => {
    render(<NewsCard item={item()} />);
    const link = screen.getByRole("link", { name: /^Model release\s*\(opens in new tab\)$/ });
    expect(link).toHaveAttribute("href", "https://example.com/post");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toMatch(/noopener/);
    expect(link.getAttribute("rel")).toMatch(/noreferrer/);
    expect(screen.getByText("Fixture Source", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Wed 30 Sep, 06:01")).toBeInTheDocument();
    expect(screen.getByText("87")).toBeInTheDocument();
    // Fixed order puts the security chip last regardless of the stored order.
    const tags = within(screen.getByRole("list", { name: "Tags" })).getAllByRole("listitem");
    expect(tags.map((t) => t.textContent)).toEqual(["New model", "Security"]);
    expect(screen.getByText("Because it matters")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Model release" })).toBeInTheDocument();
  });

  it("renders feed HTML as inert text", () => {
    const html = '<img src=x onerror="window.__xss=3">Plain text only';
    const { container } = render(<NewsCard item={item({ title: "Ignore <b>bold</b>", why: html })} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain("Ignore <b>bold</b>");
    expect(container.textContent).toContain(html);
  });

  it("renders the title as plain text when there is no safe URL (AMB-F5)", () => {
    render(<NewsCard item={item({ url: null })} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Model release");
  });

  it("omits the tag list when there are no tags", () => {
    render(<NewsCard item={item({ tags: [] })} />);
    expect(screen.queryByRole("list", { name: "Tags" })).toBeNull();
  });

  it("unscored variant has no tile, tags or why, and says why it is unscored", () => {
    const { rerender } = render(
      <NewsCard variant="unscored" item={item({ score: null, tags: [], why: null, status: "pending" })} />,
    );
    expect(screen.queryByText("Why it matters")).toBeNull();
    expect(screen.queryByText(/Relevance score/)).toBeNull();
    expect(screen.getByText("Unscored")).toBeInTheDocument();
    rerender(<NewsCard variant="unscored" item={item({ score: null, tags: [], why: null, status: "failed" })} />);
    expect(screen.getByText("Scoring failed")).toBeInTheDocument();
  });

  it("compact variant keeps the score but drops tags and why", () => {
    render(<NewsCard variant="compact" item={item()} />);
    expect(screen.getByText("87")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Tags" })).toBeNull();
    expect(screen.queryByText("Why it matters")).toBeNull();
  });
});

describe("bookmark toggle (N-5.1)", () => {
  it("server HTML is unpressed and aria-disabled, never pressed", () => {
    const html = renderToString(<NewsCard item={item()} />);
    expect(html).not.toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-disabled="true"');
  });

  it("toggles by DB id, persists, and announces removal", async () => {
    render(<NewsCard item={item()} />);
    const button = await screen.findByRole("button", { name: "Bookmark: Model release" });
    await act(async () => {});
    expect(button).toHaveAttribute("aria-pressed", "false");
    await act(async () => {
      fireEvent.click(button);
    });
    expect(button).toHaveAttribute("aria-pressed", "true");
    const stored = JSON.parse(window.localStorage.getItem("fm-playground:v1") ?? "{}") as {
      bookmarks: { news: Record<string, string> };
    };
    expect(Object.keys(stored.bookmarks.news)).toEqual(["11111111-1111-4111-8111-111111111111"]);
    await act(async () => {
      fireEvent.click(button);
    });
    expect(button).toHaveAttribute("aria-pressed", "false");
  });
});

describe("UnscoredSection (N-2.1)", () => {
  it("is collapsed by default and toggles with aria-expanded and aria-controls", () => {
    render(
      <UnscoredSection count={3}>
        <ul>
          <li>hidden item</li>
        </ul>
      </UnscoredSection>,
    );
    const button = screen.getByRole("button", { name: "Unscored (3)" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("hidden item")).not.toBeVisible();
    expect(document.getElementById(button.getAttribute("aria-controls") ?? "")).not.toBeNull();
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("hidden item")).toBeVisible();
    expect(screen.getByRole("heading", { level: 2 })).toContainElement(button);
  });
});

describe("archive error boundary (S9-18)", () => {
  it("shows a safe alert and Retry calls reset once, with no internals", () => {
    const reset = vi.fn();
    const err = Object.assign(new Error("boom at /src/secret/file.ts:12"), { digest: "abc123" });
    render(<NewsArchiveError error={err} reset={reset} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("This page couldn't load.");
    expect(document.body.textContent).not.toMatch(/boom|secret|file\.ts|abc123/);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("re-throws a database outage so the app-wide error takes over", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<NewsArchiveError error={new DbUnavailableError()} reset={() => {}} />)).toThrow();
    spy.mockRestore();
  });
});
