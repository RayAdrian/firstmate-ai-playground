import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { render, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiagramFigure } from "@/components/diagram/diagram-figure";
import { LessonDiagram, validateStoredDiagram } from "@/components/diagram/lesson-diagram";
import { Markdown } from "@/components/lesson/markdown";
import type { DiagramInput } from "@/lib/contracts/diagram";
import { boundaryInput, flowInput, lanesInput, parse, stackInput } from "../g0/fixtures";

type FlowInput = Extract<DiagramInput, { type: "flow" }>;
const flowWith = (o: Partial<FlowInput>): DiagramInput => ({ ...(flowInput() as FlowInput), ...o });

const TYPES: [string, () => DiagramInput][] = [
  ["flow", flowInput],
  ["stack", stackInput],
  ["boundary", boundaryInput],
  ["lanes", lanesInput],
];

function parts(root: Element, svgSuffix: "h" | "v"): Record<string, number> {
  const svg = root.querySelector(`svg[aria-labelledby$="-title-${svgSuffix}"]`)!;
  const out: Record<string, number> = {};
  svg.querySelectorAll("[data-part]").forEach((el) => {
    const p = el.getAttribute("data-part")!;
    out[p] = (out[p] ?? 0) + 1;
  });
  return out;
}

describe("DG-1: every declared element renders, in both orientations", () => {
  it("flow: nodes (steps + exit boxes), edges, loops, exits", () => {
    const d = parse(flowInput());
    const { container } = render(<DiagramFigure diagram={d} />);
    for (const s of ["h", "v"] as const) {
      expect(parts(container, s)).toEqual({ node: d.type === "flow" ? d.steps.length + d.exits.length : 0, edge: 3, loop: 1, exit: 1 });
    }
  });

  it("stack: layer nodes and the axis", () => {
    const { container } = render(<DiagramFigure diagram={parse(stackInput())} />);
    for (const s of ["h", "v"] as const) expect(parts(container, s)).toEqual({ node: 3, axis: 1 });
  });

  it("boundary: zones (nested included), item nodes, crossings, legend", () => {
    const { container } = render(<DiagramFigure diagram={parse(boundaryInput())} />);
    for (const s of ["h", "v"] as const) {
      expect(parts(container, s)).toEqual({ zone: 3, node: 3, crossing: 2, legend: 1 });
    }
  });

  it("lanes: lanes, step nodes, handoffs, marker, legend", () => {
    const { container } = render(<DiagramFigure diagram={parse(lanesInput())} />);
    for (const s of ["h", "v"] as const) {
      const p = parts(container, s);
      expect(p.lane).toBe(2);
      expect(p.node).toBe(3);
      expect(p.handoff).toBe(2);
      expect(p.marker).toBe(1);
      expect(p.legend).toBe(1);
    }
  });

  it("marks the emphasised node and each risk element with data-state", () => {
    const { container } = render(<DiagramFigure diagram={parse(flowInput())} />);
    const h = container.querySelector('svg[aria-labelledby$="-title-h"]')!;
    expect(h.querySelectorAll('[data-state="key"]')).toHaveLength(1);
    const b = render(<DiagramFigure diagram={parse(boundaryInput())} />).container;
    expect(b.querySelectorAll('svg[aria-labelledby$="-title-h"] [data-part="crossing"][data-state="risk"]')).toHaveLength(1);
  });
});

describe("DG-1/DG-2: figure frame and two SVGs", () => {
  it.each(TYPES)("%s: figure, figcaption (not a heading), two SVGs with width and height, none taller than 560", (_t, mk) => {
    const d = parse(mk());
    const { container } = render(<DiagramFigure diagram={d} />);
    const figure = container.querySelector('figure[data-testid="diagram"]')!;
    expect(figure.className).toContain("rounded-card");
    const cap = figure.querySelector("figcaption")!;
    expect(cap.textContent).toBe(`${d.title}${d.summary}`);
    expect(figure.querySelector("h1,h2,h3,h4,h5,h6")).toBeNull();
    const svgs = figure.querySelectorAll('svg[role="img"]');
    expect(svgs).toHaveLength(2);
    const [h, v] = [svgs[0]!, svgs[1]!];
    expect(h.getAttribute("class")).toContain("hidden md:block");
    expect(v.getAttribute("class")).toContain("md:hidden");
    expect(v.getAttribute("class")).toContain("max-w-[336px]");
    for (const svg of [h, v]) {
      const [, , w, ht] = svg.getAttribute("viewBox")!.split(" ").map(Number);
      expect(Number(svg.getAttribute("width"))).toBe(w);
      expect(Number(svg.getAttribute("height"))).toBe(ht);
      expect(ht).toBeLessThanOrEqual(560);
    }
    expect(Number(v.getAttribute("width"))).toBe(280);
  });
});

describe("DG-4: the diagram as text", () => {
  it("each SVG is a labelled image: name = title, description = summary, ids unique per orientation", () => {
    const d = parse(flowInput());
    const { container } = render(
      <>
        <DiagramFigure diagram={d} />
        <DiagramFigure diagram={parse({ ...(stackInput() as Extract<DiagramInput, { type: "stack" }>), id: "other" })} />
      </>,
    );
    const ids = [...container.querySelectorAll("[id]")].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const svg = container.querySelector('svg[aria-labelledby="diagram-ask-loop-title-h"]')!;
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.querySelector("#diagram-ask-loop-title-h")!.textContent).toBe(d.title);
    expect(svg.getAttribute("aria-describedby")).toBe("diagram-ask-loop-desc-h");
    expect(svg.querySelector("#diagram-ask-loop-desc-h")!.textContent).toBe(d.summary);
    expect(container.querySelector('svg[aria-labelledby="diagram-ask-loop-title-v"]')).not.toBeNull();
  });

  it("nothing inside an SVG is focusable and nothing animates", () => {
    for (const [, mk] of TYPES) {
      const { container } = render(<DiagramFigure diagram={parse(mk())} />);
      expect(container.querySelector("svg a, svg button, svg [tabindex], svg foreignObject, svg animate, svg set")).toBeNull();
      expect(container.querySelector('svg[role="img"]')!.getAttribute("focusable")).toBe("false");
    }
  });

  it("has a closed <details> 'Diagram as text' with the summary as its toggle, in a labelled region", () => {
    const d = parse(flowInput());
    const { container } = render(<DiagramFigure diagram={d} />);
    const details = container.querySelector("figure details")!;
    expect(details.hasAttribute("open")).toBe(false);
    const summary = details.querySelector("summary")!;
    expect(summary.textContent).toBe(`Diagram as text for ${d.title}`);
    const region = within(details as HTMLElement).getByRole("region", { hidden: true });
    expect(region.getAttribute("aria-labelledby")).toBe(summary.id);
  });

  const text = (d: ReturnType<typeof parse>) => {
    const { container } = render(<DiagramFigure diagram={d} />);
    return container.querySelector("details [role=region]")!.textContent!;
  };

  it("flow: steps, arrows, loops and exits as sentences, with (key) and (risk)", () => {
    const d = parse(
      flowWith({
      steps: [
        { id: "ask", label: "Ask", next: "plan" },
        { id: "edit", label: "Edit", sub: "agent proposes", emphasis: true },
        { id: "approve", label: "Approve" },
        { id: "verify", label: "Verify" },
      ],
      exits: [
        { from: "verify", label: "passes", text: "Merge", style: "ok" },
        { from: "approve", label: "denied", text: "Stop", style: "risk" },
      ],
    }),
    );
    const t = text(d);
    expect(t).toContain("Ask Arrow to step 2: plan.");
    expect(t).toContain("Edit: agent proposes (key)");
    expect(t).toContain("From step 4 (Verify) back to step 2 (Edit): fails.");
    expect(t).toContain('From step 4 (Verify), exit "passes": Merge.');
    expect(t).toContain('From step 3 (Approve), exit "denied": Stop (risk).');
  });

  it("stack: ordered low to high", () => {
    const t = text(parse(stackInput()));
    expect(t).toContain("Ordered from suggested to enforced.");
    expect(t.indexOf("Instructions")).toBeLessThan(t.indexOf("Skills: loaded on demand"));
    expect(t.indexOf("Skills")).toBeLessThan(t.indexOf("Hooks (key)"));
  });

  it("boundary: nested zones, then the crossings in badge order with (risk)", () => {
    const t = text(parse(boundaryInput()));
    expect(t).toContain("Outside");
    expect(t).toContain("Sandbox");
    expect(t).toContain("Model (key)");
    expect(t).toContain("Crossings:");
    expect(t).toContain("Web page to Model: injects (risk).");
    expect(t).toContain("Sandbox to Host: asks first.");
  });

  it("lanes: column order then lane order, the marker before its column, then handoffs", () => {
    const t = text(parse(lanesInput()));
    expect(t).toContain("Lanes: Reviewer, Author.");
    expect(t).toContain("Time 1, Reviewer: Review A");
    expect(t.indexOf("Time 2, Author: Push B")).toBeLessThan(t.indexOf("Time 3, event: Head moved (risk)"));
    expect(t.indexOf("Time 3, event")).toBeLessThan(t.indexOf("Time 3, Reviewer: Post success (key)"));
    expect(t).toContain("Push B to Post success: refused (risk).");
    expect(t).toContain("Review A to Push B.");
  });
});

describe("DG-5: colour is never the only cue, and no colour literals", () => {
  it.each(TYPES)("%s markup has no hex, rgb(), hsl() or named colour values", (_t, mk) => {
    const { container } = render(<DiagramFigure diagram={parse(mk())} />);
    const html = [...container.querySelectorAll('svg[role="img"]')].map((s) => s.outerHTML).join("");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b(?![^<]*<\/(title|desc|text)>)/);
    expect(html).not.toMatch(/(rgb|rgba|hsl|hsla|oklch)\(/i);
    expect(html).not.toMatch(/\b(fill|stroke)="(?!none|url)[a-zA-Z]+"/);
    expect(html).not.toMatch(/style=/);
  });

  it("the emphasised node has a 2px stroke, a bold label and the accent fill", () => {
    const { container } = render(<DiagramFigure diagram={parse(stackInput())} />);
    const key = container.querySelector('svg[aria-labelledby$="-title-h"] [data-state="key"]')!;
    const rect = key.querySelector("rect")!;
    expect(rect.getAttribute("stroke-width")).toBe("2");
    expect(rect.getAttribute("class")).toContain("fill-accent-soft");
    expect(rect.getAttribute("class")).toContain("stroke-link");
    expect(key.querySelector("text")!.getAttribute("class")).toContain("font-bold");
  });

  it("risk elements are dashed, end in the x cap, and have a label in words", () => {
    const { container } = render(<DiagramFigure diagram={parse(boundaryInput())} />);
    const svg = container.querySelector('svg[aria-labelledby$="-title-v"]')!;
    const risk = svg.querySelector('[data-part="crossing"][data-state="risk"]')!;
    expect(risk.querySelector("circle")!.getAttribute("stroke-dasharray")).toBeTruthy();
    const legend = svg.querySelector('[data-part="legend"]')!;
    expect(legend.querySelector("path.stroke-danger")).not.toBeNull();
    expect(legend.textContent).toContain("injects");
    const h = container.querySelector('svg[aria-labelledby$="-title-h"]')!;
    expect(h.querySelector('marker[id$="-x"]')).not.toBeNull();
  });
});

describe("DG-6: diagram content renders safely", () => {
  it("a script tag and an img onerror in labels render as escaped text everywhere", () => {
    const d = parse(
      flowWith({
        steps: [
          { id: "a", label: "<script>x</script>" },
          { id: "b", label: '<img onerror="x">' },
        ],
        loops: [],
        exits: [],
      }),
    );
    const { container } = render(<DiagramFigure diagram={d} />);
    expect(container.querySelector("script, img")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
    expect(container.textContent).toContain("<script>x</script>");
    expect(container.querySelector("details")!.textContent).toContain("<script>x</script>");
  });

  it("the kit never uses dangerouslySetInnerHTML", () => {
    for (const f of walk(KIT)) expect(readFileSync(f, "utf8")).not.toContain("dangerouslySetInnerHTML");
  });
});

const KIT = path.resolve(__dirname, "../../../src/components/diagram");
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("DG-2: no client JS", () => {
  it("no module under the kit has 'use client' and none imports a client-only API", () => {
    const files = walk(KIT).filter((f) => /\.(ts|tsx)$/.test(f));
    expect(files.length).toBeGreaterThan(5);
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/^\s*["']use client["']/m);
      expect(src, f).not.toMatch(/from "react"[^;]*\b(useState|useEffect|useRef|useReducer|useLayoutEffect)\b/);
    }
  });
});

describe("DG-2: adding a diagram does not change a page's client bundle", () => {
  it("no 'use client' module imports the kit or the markdown module that hosts it", () => {
    const SRC = path.resolve(__dirname, "../../../src");
    const offenders = walk(SRC)
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .filter((f) => !f.startsWith(KIT))
      .map((f) => ({ f, src: readFileSync(f, "utf8") }))
      .filter(({ src }) => /^\s*["']use client["']/m.test(src))
      .filter(({ src }) => /components\/diagram|lesson\/markdown|from "\.\/markdown"/.test(src))
      .map(({ f }) => path.relative(SRC, f));
    expect(offenders).toEqual([]);
  });
});

describe("DG-9: a bad diagram never breaks a page", () => {
  it("LessonDiagram skips an invalid diagram, renders nothing and logs the page, id and reason (no text)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(
      <LessonDiagram source={"type: flow\nid: broken\ntitle: T\nsummary: S\nsteps: []\n"} index={1} context="lesson l9-demo" seenIds={new Set()} />,
    );
    expect(container.innerHTML).toBe("");
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0]?.[0]);
    expect(line).toContain("lesson l9-demo");
    expect(line).toContain("diagram broken");
    expect(line).toContain("steps");
    warn.mockRestore();
  });

  it("skips YAML that does not parse, and uses #n when there is no id", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(<LessonDiagram source={"type: [flow"} index={2} context="lesson l9-demo" seenIds={new Set()} />);
    expect(container.innerHTML).toBe("");
    expect(String(warn.mock.calls[0]?.[0])).toContain("diagram #2");
    warn.mockRestore();
  });

  it("skips a repeated id (DOM ids derive from it)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const seen = new Set<string>();
    const src = "type: stack\nid: dup\ntitle: T\nsummary: S\nlayers:\n  - {id: a, label: A}\n  - {id: b, label: B}\naxis: {low: lo, high: hi}\n";
    const first = render(<LessonDiagram source={src} index={1} context="lesson x" seenIds={seen} />);
    const second = render(<LessonDiagram source={src} index={2} context="lesson x" seenIds={seen} />);
    expect(first.container.querySelector("figure")).not.toBeNull();
    expect(second.container.innerHTML).toBe("");
    expect(String(warn.mock.calls[0]?.[0])).toContain("duplicate");
    warn.mockRestore();
  });

  it("validateStoredDiagram returns null for an invalid stored value instead of throwing, and logs", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(validateStoredDiagram({ type: "flow" }, "workflow w")).toBeNull();
    expect(validateStoredDiagram(null, "workflow w")).toBeNull();
    expect(validateStoredDiagram(parse(stackInput()), "workflow w")).not.toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe("DG-1: the markdown intercept", () => {
  const fence = "```diagram\ntype: stack\nid: ladder\ntitle: The ladder\nsummary: Hooks win.\nlayers:\n  - {id: a, label: Low}\n  - {id: b, label: High}\naxis: {low: soft, high: hard}\n```";
  const md = `Before the diagram.\n\n${fence}\n\nAfter the diagram.\n`;

  it("renders one figure at the fence position, in order with the prose around it", () => {
    const { container } = render(<Markdown source={md} diagramContext="lesson l9" />);
    expect(container.querySelectorAll('figure[data-testid="diagram"]')).toHaveLength(1);
    const kids = [...container.children].map((c) => c.tagName + ":" + (c.textContent ?? "").slice(0, 15));
    expect(kids[0]).toBe("P:Before the diag");
    expect(kids[1]!.startsWith("FIGURE")).toBe(true);
    expect(kids[2]).toBe("P:After the diagr");
  });

  it("adds no headings: the heading list is identical with and without the fence", () => {
    const withFence = render(<Markdown source={`### One\n\n${md}\n### Two\n\nx`} diagramContext="lesson l9" />).container;
    const without = render(<Markdown source={"### One\n\nBefore the diagram.\n\nAfter the diagram.\n\n### Two\n\nx"} />).container;
    const heads = (c: Element) => [...c.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => `${h.tagName}:${h.textContent}`);
    expect(heads(withFence)).toEqual(heads(without));
  });

  it("without a diagram context the fence stays a code block (tool tabs never draw diagrams)", () => {
    const { container } = render(<Markdown source={md} />);
    // CodeBlock is an async client component and cannot render in jsdom; what matters is that no figure is drawn.
    expect(container.querySelector("figure")).toBeNull();
  });

  it("an invalid diagram is skipped and the rest of the page renders", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(<Markdown source={"Before.\n\n```diagram\nnope: [\n```\n\nAfter.\n"} diagramContext="lesson l9" />);
    expect(container.querySelector("figure")).toBeNull();
    expect(container.textContent).toContain("Before.");
    expect(container.textContent).toContain("After.");
    expect(container.querySelector("pre")).toBeNull();
    warn.mockRestore();
  });
});
