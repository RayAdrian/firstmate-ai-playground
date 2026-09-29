import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CodeBlock, CommandLine, LiveRegion, PlainCodeBlock } from "@/components/ui";

type ClipboardMock = { writeText: ReturnType<typeof vi.fn> };

function mockClipboard(impl: () => Promise<void>): ClipboardMock {
  const writeText = vi.fn(impl);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  return { writeText };
}

function removeClipboard() {
  Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
}

function setPlatform(platform: string) {
  Object.defineProperty(navigator, "platform", { value: platform, configurable: true });
}

async function renderBlock(props: React.ComponentProps<typeof CodeBlock>) {
  const ui = await CodeBlock(props);
  return render(
    <>
      {ui}
      <LiveRegion />
    </>,
  );
}

const live = () => document.getElementById("fm-live") as HTMLElement;

beforeEach(() => {
  setPlatform("MacIntel");
});

afterEach(() => {
  vi.useRealTimers();
  window.getSelection()?.removeAllRanges();
});

describe("CodeBlock labels (TC-A-17)", () => {
  it("uses the language, the filename when given, and 'text' otherwise", async () => {
    await renderBlock({ code: "npm run seed", language: "bash" });
    expect(screen.getByRole("figure", { name: "bash" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy code: bash" })).toBeInTheDocument();
    expect(screen.getByLabelText("Code: bash").tagName).toBe("PRE");
    expect(screen.getByLabelText("Code: bash")).toHaveAttribute("tabindex", "0");
  });

  it("filename wins over language", async () => {
    await renderBlock({ code: "{}", language: "json", title: "settings.json" });
    expect(screen.getByRole("figure", { name: "settings.json" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy code: settings.json" })).toBeInTheDocument();
  });

  it("falls back to 'text' with no language or filename", async () => {
    await renderBlock({ code: "plain" });
    expect(screen.getByRole("figure", { name: "text" })).toBeInTheDocument();
  });
});

describe("CodeBlock copy (TC-A-13, TC-A-14)", () => {
  it("copies the exact source with only the final newline trimmed", async () => {
    const user = userEvent.setup();
    const clip = mockClipboard(() => Promise.resolve()); // after setup(): user-event installs its own clipboard
    await renderBlock({ code: "\tindented\n    four spaces\n\n", language: "bash" });
    await user.click(screen.getByRole("button", { name: /^Copy/ }));
    expect(clip.writeText).toHaveBeenCalledWith("\tindented\n    four spaces\n");
  });

  it("keeps unicode and does not include a prompt or button text", async () => {
    const user = userEvent.setup();
    const clip = mockClipboard(() => Promise.resolve());
    await renderBlock({ code: 'echo "Maligayang pagdating — ✓ 日本語"\n', language: "bash" });
    await user.click(screen.getByRole("button", { name: /^Copy/ }));
    expect(clip.writeText).toHaveBeenCalledWith('echo "Maligayang pagdating — ✓ 日本語"');
  });

  it("swaps to 'Copied' (name and icon), announces once, and reverts after 2s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockClipboard(() => Promise.resolve());
    await renderBlock({ code: "npm run seed", language: "bash" });
    expect(live()).toHaveAttribute("aria-live", "polite");
    expect(live()).toHaveTextContent("");

    await user.click(screen.getByRole("button", { name: "Copy code: bash" }));
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(live()).toHaveTextContent(/^Copied$/);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    expect(screen.getByRole("button", { name: "Copy code: bash" })).toBeInTheDocument();
  });

  it("repeated clicks restart the timer and keep focus on the button", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockClipboard(() => Promise.resolve());
    await renderBlock({ code: "x", language: "bash" });
    const button = () => screen.getByRole("button", { name: /^Cop(y|ied)/ });
    await user.click(button());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    await user.click(button());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(button()).toHaveAccessibleName("Copied"); // 3s after the first click, 1.5s after the second
    expect(button()).toHaveFocus();
  });
});

describe("CodeBlock clipboard denied (TC-A-16)", () => {
  it("selects the code, focuses the pre, shows the hint and announces it", async () => {
    const user = userEvent.setup();
    mockClipboard(() => Promise.reject(new DOMException("denied", "NotAllowedError")));
    await renderBlock({ code: "npm run seed\nnpm run news:run -- --dry-run", language: "bash" });
    await user.click(screen.getByRole("button", { name: "Copy code: bash" }));

    expect(window.getSelection()?.toString()).toBe("npm run seed\nnpm run news:run -- --dry-run");
    expect(screen.getByLabelText("Code: bash")).toHaveFocus();
    expect(screen.getByText("Press ⌘C to copy")).toBeInTheDocument();
    // The button reads "Copy" again, never "Failed" or "Copied".
    expect(screen.getByRole("button", { name: "Copy code: bash" })).toBeInTheDocument();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40));
    });
    expect(live()).toHaveTextContent("Copy blocked. Code selected. Press ⌘C to copy.");
  });

  it("uses Ctrl+C off macOS", async () => {
    setPlatform("Linux x86_64");
    const user = userEvent.setup();
    mockClipboard(() => Promise.reject(new Error("denied")));
    await renderBlock({ code: "ls", language: "bash" });
    await user.click(screen.getByRole("button", { name: /^Copy/ }));
    expect(screen.getByText("Press Ctrl+C to copy")).toBeInTheDocument();
  });

  it("falls back the same way when navigator.clipboard is undefined (insecure origin)", async () => {
    const user = userEvent.setup();
    removeClipboard();
    await renderBlock({ code: "ls -la", language: "bash" });
    await user.click(screen.getByRole("button", { name: /^Copy/ }));
    expect(window.getSelection()?.toString()).toBe("ls -la");
    expect(screen.getByText("Press ⌘C to copy")).toBeInTheDocument();
  });

  it("keeps the hint until BOTH 8s have passed and a click outside happened", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    removeClipboard();
    await renderBlock({ code: "ls", language: "bash" });
    await user.click(screen.getByRole("button", { name: /^Copy/ }));
    expect(screen.getByText("Press ⌘C to copy")).toBeInTheDocument();

    await user.click(document.body); // outside click before 8s: still shown
    expect(screen.getByText("Press ⌘C to copy")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8100);
    });
    expect(screen.queryByText("Press ⌘C to copy")).toBeNull();
  });
});

describe("CodeBlock highlighting (TC-A-18)", () => {
  it("colours tokens on the server render with at least 3 distinct colours and lifts comments to AA", async () => {
    const { container } = await renderBlock({
      code: '{"permissions": {"allow": ["Bash(npm test)"]}, "n": 1}',
      language: "json",
    });
    const colours = new Set(
      [...container.querySelectorAll<HTMLElement>("pre code span[style]")].map((s) => s.style.color).filter(Boolean),
    );
    expect(colours.size).toBeGreaterThanOrEqual(3);

    const sh = await renderBlock({ code: "# a comment\nls", language: "bash" });
    const comment = [...sh.container.querySelectorAll<HTMLElement>("pre code span[style]")].find((s) =>
      s.textContent?.includes("# a comment"),
    );
    expect(comment?.style.color).toBe("rgb(154, 164, 178)"); // #9aa4b2, not github-dark's #6a737d
  });

  it("renders unknown languages as plain text without failing", async () => {
    const { container } = await renderBlock({ code: "whatever", language: "klingon" });
    expect(container.querySelector("pre code")).toHaveTextContent("whatever");
    expect(screen.getByRole("figure", { name: "klingon" })).toBeInTheDocument();
  });

  it("preserves line breaks in the DOM text of the code element", async () => {
    const { container } = await renderBlock({ code: "a\nb\nc", language: "bash" });
    expect(container.querySelector("pre code")?.textContent).toBe("a\nb\nc");
  });
});

describe("CommandLine and PlainCodeBlock", () => {
  it("CommandLine is a labelled single-line block with a copy button named after its label", () => {
    render(<CommandLine command="supabase start && npm run seed" label="Terminal" />);
    expect(screen.getByRole("figure", { name: "Terminal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy code: Terminal" })).toBeInTheDocument();
    expect(screen.getByText("supabase start && npm run seed")).toBeInTheDocument();
  });

  it("PlainCodeBlock uses the same label rule and copy chrome without highlighting", () => {
    render(<PlainCodeBlock code={"a\nb"} language="ts" title="src/app/page.tsx" />);
    expect(screen.getByRole("figure", { name: "src/app/page.tsx" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy code: src/app/page.tsx" })).toBeInTheDocument();
  });
});
