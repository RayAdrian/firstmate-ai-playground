import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown, shallowestHeading } from "@/components/lesson/markdown";

// Lighthouse flagged "heading-order" on lessons: bodies written with `###` were shifted to h5 under a page h2.
describe("lesson markdown heading levels (axe heading-order)", () => {
  it("a body whose shallowest heading is ### starts at h3, never skipping a level", () => {
    const { container } = render(<Markdown source={"### First Mate tip\n\ntext\n\n#### Detail\n\n### Next"} />);
    expect(container.querySelectorAll("h3")).toHaveLength(2);
    expect(container.querySelectorAll("h4")).toHaveLength(1);
    expect(container.querySelector("h5")).toBeNull();
  });

  it("keeps the DESIGN rule for bodies that start at #", () => {
    const { container } = render(<Markdown source={"# One\n\n## Two"} />);
    expect(container.querySelectorAll("h3")).toHaveLength(1);
    expect(container.querySelectorAll("h4")).toHaveLength(1);
  });

  it("finds the shallowest heading outside code fences only", () => {
    expect(shallowestHeading("text only")).toBeNull();
    expect(shallowestHeading("```md\n# not a heading\n```\n\n### real")).toBe(3);
    expect(shallowestHeading("~~~\n# x\n~~~\n#### y")).toBe(4);
    expect(shallowestHeading("#hashtag is not a heading")).toBeNull();
  });

  it("follows CommonMark fence rules: a shorter inner fence does not close a longer one", () => {
    const src = "````md\n```\n# comment inside\n```\n# still inside\n````\n\n#### real";
    expect(shallowestHeading(src)).toBe(4);
    // a different fence character never closes, and the closing fence takes no info string
    expect(shallowestHeading("```\n~~~\n# inside\n``` js\n# inside too\n```\n### out")).toBe(3);
    // an unterminated fence swallows the rest of the document
    expect(shallowestHeading("```\n# inside\n")).toBeNull();
  });
});
