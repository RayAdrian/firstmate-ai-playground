import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Differences, ToolPanelContent } from "@/components/lesson/lesson-sections";
import { Markdown, parseFenceTitle } from "@/components/lesson/markdown";

function renderMd(source: string) {
  const { container } = render(<Markdown source={source} />);
  return container;
}

describe("L-7 safe markdown (TC-C-51 matrix)", () => {
  it("shows raw HTML as literal text and creates no elements from it", () => {
    const inputs = [
      '<iframe src="https://evil"></iframe>',
      '<a href="x" onclick="y">t</a>',
      "<svg onload=alert(1)>",
      "<style>body{display:none}</style>",
      "<script>window.__xss=1</script>",
      '<img src=x onerror="window.__xss=2">',
    ];
    for (const input of inputs) {
      const c = renderMd(input);
      expect(c.querySelector("iframe, svg, style, script, img")).toBeNull();
      expect(c.querySelector("[onclick], [onerror], [onload]")).toBeNull();
      expect(c.textContent).toContain(input);
      c.remove();
    }
  });

  it("drops javascript: and data: link targets and unsafe images", () => {
    for (const md of [
      "[t](javascript:alert(1))",
      "[t](JAVASCRIPT:alert(1))",
      "[t](data:text/html,<b>)",
    ]) {
      const c = renderMd(md);
      const a = c.querySelector("a");
      expect(a?.getAttribute("href") ?? null).toBeNull();
      expect(c.textContent).toContain("t");
      c.remove();
    }
    const img = renderMd("![i](javascript:alert(1))");
    expect(img.querySelector("img")).toBeNull();
  });

  it("TC-C-52 external links open safely in a new tab; internal links stay put", () => {
    renderMd("[docs](https://docs.anthropic.com/) and [next](/lessons/l1-permissions)");
    const external = screen.getByRole("link", { name: /docs/ });
    expect(external).toHaveAttribute("target", "_blank");
    expect(external.getAttribute("rel")).toMatch(/noopener/);
    expect(external.getAttribute("rel")).toMatch(/noreferrer/);
    expect(external).toHaveTextContent("(opens in new tab)");
    const internal = screen.getByRole("link", { name: "next" });
    expect(internal).not.toHaveAttribute("target");
    expect(internal).not.toHaveAttribute("rel");
  });

  it("shifts headings so lesson markdown starts at h3", () => {
    const c = renderMd("# One\n\n## Two\n\n###### Six");
    expect(c.querySelector("h1, h2")).toBeNull();
    expect(c.querySelectorAll("h3")).toHaveLength(1);
    expect(c.querySelectorAll("h4")).toHaveLength(1);
    expect(c.querySelectorAll("h6")).toHaveLength(1);
  });

  it("parses fence titles", () => {
    expect(parseFenceTitle('title="settings.json"')).toBe("settings.json");
    expect(parseFenceTitle("")).toBeNull();
    expect(parseFenceTitle(undefined)).toBeNull();
  });
});

describe("L-3 differences and no-equivalent notice", () => {
  it("TC-C-34 renders differences as plain text", () => {
    const { container } = render(<Differences items={["<b>x</b>", "a & b"]} />);
    expect(container.querySelector("b")).toBeNull();
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual(["<b>x</b>", "a & b"]);
    expect(screen.getByRole("region", { name: "Key differences" })).toBeInTheDocument();
  });

  it("TC-C-36 no-equivalent panel names the tool and version, then the workaround", () => {
    render(
      <ToolPanelContent tool="claude" body={null} noEquivalent workaround="W" version="2.1.0" />,
    );
    expect(screen.getByText("No native equivalent in Claude Code (as of v2.1.0)")).toBeInTheDocument();
    expect(screen.getByText("Closest workaround")).toBeInTheDocument();
    expect(screen.getByText("W")).toBeInTheDocument();
  });

  it("names Codex CLI symmetrically and omits an unknown version", () => {
    render(<ToolPanelContent tool="codex" body={null} noEquivalent workaround="Use a profile" version={undefined} />);
    expect(screen.getByText("No native equivalent in Codex CLI")).toBeInTheDocument();
  });

  it("never renders an empty panel", () => {
    const { container } = render(
      <ToolPanelContent tool="codex" body={null} noEquivalent={false} workaround={null} version="0.4.0" />,
    );
    expect(container.textContent?.trim()).not.toBe("");
  });
});
