import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/curriculum";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import { GlobalNotices, SiteFooter, SiteHeader, SkipLink, isNavActive } from "@/components/ui";

beforeEach(() => {
  pathname = "/curriculum";
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

describe("isNavActive (DESIGN §5.1)", () => {
  it.each([
    ["/curriculum", "/curriculum", true],
    ["/curriculum", "/lessons/l1-first-session", true],
    ["/curriculum", "/exercises", false],
    ["/exercises", "/exercises", true],
    ["/news", "/news", true],
    ["/news", "/news/archive", true],
    ["/bookmarks", "/bookmarks", true],
    ["/bookmarks", "/bookmarks/x", false],
    ["/progress", "/progress", true],
    ["/curriculum", "/", false],
    ["/news", "/newsletter", false],
    ["/news", null, false],
  ])("%s on %s is %s", (href, current, expected) => {
    expect(isNavActive(href, current)).toBe(expected);
  });
});

describe("SiteHeader (TC-A-28)", () => {
  it("names the home link 'First Mate AI Playground' and exposes the five links with aria-current", () => {
    pathname = "/lessons/l1-first-session";
    render(<SiteHeader />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    const home = screen.getByRole("link", { name: "First Mate AI Playground" });
    expect(home).toHaveAttribute("href", "/");
    expect(home.querySelector("img")).toHaveAttribute("alt", "First Mate");
    const nav = screen.getAllByRole("navigation", { name: "Main", hidden: true })[0];
    for (const name of ["Curriculum", "Exercises", "News", "Bookmarks", "Progress"]) {
      expect(nav.querySelector(`a[href]`)).not.toBeNull();
      expect(screen.getAllByRole("link", { name, hidden: true }).length).toBeGreaterThan(0);
    }
    const current = screen
      .getAllByRole("link", { name: "Curriculum", hidden: true })
      .filter((l) => l.getAttribute("aria-current") === "page");
    expect(current.length).toBeGreaterThan(0);
    for (const other of screen.getAllByRole("link", { name: "News", hidden: true })) {
      expect(other).not.toHaveAttribute("aria-current");
    }
  });

  it("logo swaps to the dark variant with <picture>", () => {
    const { container } = render(<SiteHeader />);
    expect(container.querySelector("source")).toHaveAttribute("srcset", "/brand/firstmate-logo-dark.svg");
    expect(container.querySelector("source")).toHaveAttribute("media", "(prefers-color-scheme: dark)");
    expect(container.querySelector("img")).toHaveAttribute("src", "/brand/firstmate-logo.svg");
  });

  it("menu button: fixed label, aria-expanded toggles, first link focused on open, Escape returns focus", async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);
    const button = screen.getByRole("button", { name: "Menu" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("aria-controls", "mobile-nav");
    const panel = document.getElementById("mobile-nav") as HTMLElement;
    expect(panel).toHaveAttribute("hidden");

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAccessibleName("Menu"); // the label never changes
    expect(panel).not.toHaveAttribute("hidden");
    expect(panel.querySelector("a")).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(panel).toHaveAttribute("hidden");
    expect(button).toHaveFocus();
  });

  it("closes on route change and on an outside click", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <>
        <SiteHeader />
        <p>outside</p>
      </>,
    );
    const button = screen.getByRole("button", { name: "Menu" });
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    pathname = "/news";
    rerender(
      <>
        <SiteHeader />
        <p>outside</p>
      </>,
    );
    expect(button).toHaveAttribute("aria-expanded", "false");

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByText("outside"));
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("closes when the viewport grows to the desktop breakpoint", async () => {
    let listener: ((e: { matches: boolean }) => void) | undefined;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
        listener = cb;
      },
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    const user = userEvent.setup();
    render(<SiteHeader />);
    const button = screen.getByRole("button", { name: "Menu" });
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    act(() => listener?.({ matches: true }));
    expect(button).toHaveAttribute("aria-expanded", "false");
  });
});

describe("Shell parts", () => {
  it("skip link targets #main", () => {
    render(<SkipLink />);
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main");
  });

  it("footer is a contentinfo landmark with no extra links", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("contentinfo")).toHaveTextContent("First Mate AI Playground · internal, runs locally");
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("GlobalNotices renders its slot", () => {
    render(
      <GlobalNotices>
        <div role="status">Progress can&apos;t be saved in this browser</div>
      </GlobalNotices>,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
