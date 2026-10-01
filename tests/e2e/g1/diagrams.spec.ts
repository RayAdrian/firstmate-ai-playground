import { expect, test, type Page } from "@playwright/test";
import { collectConsole, expectNoSeriousA11y } from "../../support";

// G1 (PRD §17, DG-1 to DG-5, DG-10, DG-11): the diagram kit in a real browser. Runs against fx-base (`npm run db:reset:test`):
// the fixture lessons carry one diagram of each type (tests/fixtures/content/content-valid/), and the fixture workflow
// `fx-both-tools` carries a diagram and a `watch`.

type Fixture = { slug: string; id: string; title: string; type: string };
const DIAGRAMS: Fixture[] = [
  { slug: "l2-context-files", id: "edit-loop", title: "The edit, approve, verify loop", type: "flow" },
  { slug: "l2-context-files", id: "context-ladder", title: "Where context files are read from", type: "stack" },
  { slug: "l1-permissions", id: "trust-zones", title: "Who can reach the agent", type: "boundary" },
  { slug: "l1-permissions", id: "gate-race", title: "Review A, push B", type: "lanes" },
  // Lanes v2: the grid with the numbered time axis and a handoff across the marker, and a six-column timeline.
  { slug: "l2-memory", id: "pinned-approval", title: "An approval covers one commit", type: "lanes-grid" },
  { slug: "l2-memory", id: "six-columns", title: "Six steps across three lanes", type: "lanes-six" },
];
const WIDTHS = [360, 768, 1024, 1440] as const;
const SCHEMES = ["light", "dark"] as const;

const figure = (page: Page, d: Fixture) => page.locator(`figure[data-testid="diagram"]:has(svg[aria-labelledby="diagram-${d.id}-title-h"])`);

async function open(page: Page, d: Fixture, width: number, scheme: (typeof SCHEMES)[number] = "light") {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ colorScheme: scheme });
  await page.goto(`/lessons/${d.slug}`);
  await figure(page, d).waitFor();
  await page.evaluate(() => document.fonts.ready);
}

for (const d of DIAGRAMS) {
  test.describe(`${d.type} diagram "${d.id}"`, () => {
    test(`DG-2: exactly one image is visible, the vertical one below md and the horizontal one from md up`, async ({ page }) => {
      for (const width of WIDTHS) {
        await open(page, d, width);
        const img = page.getByRole("img", { name: d.title, exact: true });
        await expect(img).toHaveCount(1);
        const labelled = await img.getAttribute("aria-labelledby");
        expect(labelled).toBe(`diagram-${d.id}-title-${width < 768 ? "v" : "h"}`);
      }
    });

    test(`DG-2: no horizontal scroll, width/height attributes, nothing taller than 560, labels at least 12px`, async ({ page }) => {
      for (const width of WIDTHS) {
        await open(page, d, width);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `scroll overflow at ${width}`).toBeLessThanOrEqual(0);
        const info = await figure(page, d).evaluate((fig) => {
          const all = [...fig.querySelectorAll<SVGSVGElement>('svg[role="img"]')];
          return all.map((svg) => {
            const vb = svg.viewBox.baseVal;
            const box = svg.getBoundingClientRect();
            const scale = box.width / vb.width;
            const sizes = [...svg.querySelectorAll("text")].map((t) => Number(t.getAttribute("font-size")) * scale);
            return {
              visible: box.width > 0,
              widthAttr: Number(svg.getAttribute("width")),
              heightAttr: Number(svg.getAttribute("height")),
              vbW: vb.width,
              vbH: vb.height,
              rendered: box.width,
              minFont: sizes.length ? Math.min(...sizes) : 99,
            };
          });
        });
        for (const s of info) {
          expect(s.widthAttr).toBe(s.vbW);
          expect(s.heightAttr).toBe(s.vbH);
          expect(s.vbH).toBeLessThanOrEqual(560);
        }
        const shown = info.filter((s) => s.visible);
        expect(shown).toHaveLength(1);
        expect(shown[0]!.minFont, `label size at ${width}`).toBeGreaterThanOrEqual(11.9);
        if ((width === 768 || width === 1024) && shown[0]!.vbW === 576) {
          expect(shown[0]!.rendered, `horizontal svg at ${width}`).toBeGreaterThanOrEqual(575.5);
        }
      }
    });

    test(`DG-3: no label extends past its node in the browser, with the real font`, async ({ page }) => {
      for (const width of [360, 1440]) {
        await open(page, d, width);
        const overflows = await figure(page, d).evaluate((fig) => {
          const out: string[] = [];
          const svg = [...fig.querySelectorAll<SVGSVGElement>('svg[role="img"]')].find((s) => s.getBoundingClientRect().width > 0)!;
          svg.querySelectorAll('g[data-part="node"]').forEach((g) => {
            const rect = g.querySelector<SVGRectElement>(":scope > rect")!;
            const right = rect.x.baseVal.value + rect.width.baseVal.value;
            g.querySelectorAll(":scope > text").forEach((t) => {
              const b = (t as SVGTextElement).getBBox();
              if (b.x + b.width > right) out.push(`${t.textContent}: ${Math.round(b.x + b.width)} > ${Math.round(right)}`);
            });
          });
          return out;
        });
        expect(overflows, `at ${width}`).toEqual([]);
      }
    });

    test(`DG-4: "Diagram as text" is closed, opens, and lists the content`, async ({ page }) => {
      await open(page, d, 1440);
      const details = figure(page, d).locator("details");
      await expect(details).not.toHaveAttribute("open", "");
      const summary = details.locator("summary");
      await expect(summary).toContainText("Diagram as text");
      await summary.click();
      await expect(details).toHaveAttribute("open", "");
      const region = details.getByRole("region");
      await expect(region).toBeVisible();
      const text = (await region.innerText()).replace(/\s+/g, " ");
      if (d.type === "flow") {
        expect(text).toContain("Verify (key)");
        expect(text).toContain("From step 4 (Verify) back to step 2 (Edit): check fails.");
        expect(text).toContain('exit "denied": Agent stops (risk).');
      }
      if (d.type === "stack") expect(text).toContain("Ordered from farthest to nearest.");
      if (d.type === "boundary") {
        expect(text).toContain("Crossings:");
        expect(text).toContain("MCP server to Agent: injected text (risk).");
      }
      if (d.type === "lanes-grid") {
        expect(text).toContain("Time 3, Reviewer: Post success on A: refused: A not head (key) (risk)");
        expect(text).toContain("Review A to Post success on A: stale result.");
      }
      if (d.type === "lanes-six") expect(text).toContain("Time 6, Reviewer: Success refused (key) (risk)");
      if (d.type === "lanes") {
        expect(text).toContain("Time 3, event: Head moves (risk)");
        expect(text).toContain("Push B to Success refused: head moved (risk).");
      }
    });

    test(`DG-4: nothing inside the image is focusable; Tab goes from the content before to the summary`, async ({ page }) => {
      await open(page, d, 1440);
      expect(await figure(page, d).locator("svg a, svg button, svg [tabindex]").count()).toBe(0);
      await page.locator("h1").first().focus();
      let landed = "";
      for (let i = 0; i < 80 && landed === ""; i++) {
        await page.keyboard.press("Tab");
        landed = await page.evaluate(() => {
          const el = document.activeElement;
          return el?.closest('figure[data-testid="diagram"]') ? `${el.tagName}` : "";
        });
      }
      expect(landed).toBe("SUMMARY");
    });

    for (const scheme of SCHEMES) {
      test(`DG-4: axe finds no serious or critical violation at 360 and 1440, ${scheme}`, async ({ page }) => {
        for (const width of [360, 1440]) {
          await open(page, d, width, scheme);
          await figure(page, d).locator("summary").click();
          await expectNoSeriousA11y(page, { include: `figure[data-testid="diagram"]:has(svg[aria-labelledby="diagram-${d.id}-title-h"])` });
        }
      });
    }

    test("DG-4: under forced colours the strokes and labels keep a real colour", async ({ page }) => {
      await page.emulateMedia({ forcedColors: "active" });
      await open(page, d, 1440);
      await page.emulateMedia({ forcedColors: "active" });
      const colours = await figure(page, d).evaluate((fig) => {
        const svg = [...fig.querySelectorAll<SVGSVGElement>('svg[role="img"]')].find((s) => s.getBoundingClientRect().width > 0)!;
        const bad: string[] = [];
        const isBlank = (v: string) => v === "none" || v === "transparent" || v === "rgba(0, 0, 0, 0)";
        svg.querySelectorAll("rect").forEach((r) => {
          if (isBlank(getComputedStyle(r).stroke)) bad.push(`rect stroke ${getComputedStyle(r).stroke}`);
        });
        svg.querySelectorAll("text").forEach((t) => {
          if (isBlank(getComputedStyle(t).fill)) bad.push(`text fill ${getComputedStyle(t).fill}`);
        });
        return bad;
      });
      expect(colours).toEqual([]);
    });

    test("DG-5: no hex, rgb() or named colour in the served markup", async ({ page }) => {
      await open(page, d, 1440);
      const html = await figure(page, d).evaluate((fig) => [...fig.querySelectorAll('svg[role="img"]')].map((s) => s.outerHTML).join(""));
      expect(html).not.toMatch(/(rgb|hsl|oklch)a?\(/i);
      expect(html).not.toMatch(/\s(fill|stroke)="#/);
      expect(html).not.toMatch(/style=/);
    });
  });
}

test.describe("lanes v2", () => {
  const grid = DIAGRAMS.find((x) => x.id === "pinned-approval")!;
  const six = DIAGRAMS.find((x) => x.id === "six-columns")!;

  test("the grid has a numbered, arrowed time axis; the timeline rail shows the same numbers", async ({ page }) => {
    await open(page, grid, 1440);
    const h = figure(page, grid).locator('svg[aria-labelledby$="-title-h"]');
    const axis = h.locator('g[data-part="axis"]');
    await expect(axis.locator("text")).toHaveText(["Time", "1", "2", "3"]);
    await expect(axis.locator("circle")).toHaveCount(3);
    await expect(axis.locator("path[marker-end]")).toHaveCount(1);
    await open(page, grid, 360);
    const v = figure(page, grid).locator('svg[aria-labelledby$="-title-v"]');
    await expect(v.locator('g[data-part="axis"] text')).toHaveText(["1", "2", "3"]);
  });

  test("the handoff crosses the marker over an underlay, and the key risk step reads as key and risk", async ({ page }) => {
    await open(page, grid, 1440);
    const h = figure(page, grid).locator('svg[aria-labelledby$="-title-h"]');
    await expect(h.locator('g[data-part="handoff"] path.stroke-surface')).toHaveCount(1);
    await expect(h.locator('g[data-part="marker"]')).toHaveCount(1);
    await expect(h.locator('[data-part="node"][data-state~="key"][data-state~="risk"]')).toHaveCount(1);
    await expect(h.locator('[data-part="node"][data-state~="key"] rect')).toHaveAttribute("stroke-dasharray", "6 4");
  });

  test("six columns show the timeline at every width, with a numbered rail of six", async ({ page }) => {
    await open(page, six, 1440);
    const h = figure(page, six).locator('svg[aria-labelledby$="-title-h"]');
    expect(await h.getAttribute("viewBox")).toBe("0 0 280 " + (await h.getAttribute("height")));
    await expect(h.locator('g[data-part="axis"] circle')).toHaveCount(6);
  });
});

test("DG-1: diagrams add no headings: a figure holds no h1 to h6 and the h2 ids are unchanged", async ({ page }) => {
  await page.goto("/lessons/l2-context-files");
  const ids = await page.locator("h2[id]").evaluateAll((els) => els.map((e) => e.id));
  expect(ids).toContain("concept");
  expect(ids.indexOf("concept")).toBe(0);
  expect(new Set(ids).size).toBe(ids.length);
  expect(await page.locator("figure[data-testid=diagram] h1, figure[data-testid=diagram] h2, figure[data-testid=diagram] h3").count()).toBe(0);
});

test("DG-1: the figure sits where its fence is, between the prose around it", async ({ page }) => {
  await page.goto("/lessons/l2-context-files");
  const order = await page.locator("#concept ~ *").evaluateAll((els) => els.slice(0, 5).map((e) => `${e.tagName}:${(e.textContent ?? "").slice(0, 20)}`));
  expect(order[0]).toMatch(/^P:Context files are/);
  expect(order[1]).toMatch(/^FIGURE:/);
  expect(order[2]).toMatch(/^P:Nearer files win/);
  expect(order[3]).toMatch(/^FIGURE:/);
});

test("the page logs no console errors or warnings with diagrams on it", async ({ page }) => {
  const problems = collectConsole(page);
  await page.goto("/lessons/l1-permissions");
  await page.locator('figure[data-testid="diagram"]').first().waitFor();
  expect(problems()).toEqual([]);
});

test("CLS stays under 0.05 and no layout shift is attributed to a figure @nightly", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __cls: { value: number; fig: boolean }[] }).__cls = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean; sources?: { node?: Node }[] }[]) {
        if (e.hadRecentInput) continue;
        const fig = (e.sources ?? []).some((s) => s.node && (s.node as Element).closest?.('figure[data-testid="diagram"]'));
        (window as unknown as { __cls: { value: number; fig: boolean }[] }).__cls.push({ value: e.value, fig });
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/lessons/l2-context-files");
    await page.locator('figure[data-testid="diagram"]').first().waitFor();
    await page.waitForTimeout(1500);
    const shifts = await page.evaluate(() => (window as unknown as { __cls: { value: number; fig: boolean }[] }).__cls);
    expect(shifts.reduce((a, s) => a + s.value, 0)).toBeLessThan(0.05);
    expect(shifts.filter((s) => s.fig)).toEqual([]);
  }
});

test.describe("workflow placement (DG-10, DG-11)", () => {
  test("DG-10: the diagram is the first thing in 'Why it works', before the prose, outside the tool tabs", async ({ page }) => {
    await page.goto("/workflows/fx-both-tools");
    const why = page.locator("section[aria-labelledby=why-it-works]");
    const kids = await why.evaluate((s) => [...s.children].map((c) => c.tagName));
    expect(kids.slice(0, 3)).toEqual(["H2", "FIGURE", "P"]);
    const fig = why.locator('figure[data-testid="diagram"]');
    await expect(fig).toHaveCount(1);
    await expect(fig.getByRole("img", { name: "One list of checks, read by both tools", exact: true })).toBeVisible();
    // Same for both tools: switching the tool tabs does not change it.
    expect(await page.locator('[role="tabpanel"] figure[data-testid="diagram"]').count()).toBe(0);
  });

  test("DG-10: the band keeps its own surface and runs edge to edge in the callout", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/workflows/fx-both-tools");
    const box = await page.evaluate(() => {
      const s = document.querySelector("section[aria-labelledby=why-it-works]")!.getBoundingClientRect();
      const f = document.querySelector("section[aria-labelledby=why-it-works] figure")!.getBoundingClientRect();
      return { sLeft: s.left, sRight: s.right, fLeft: f.left, fRight: f.right };
    });
    expect(box.fRight).toBeCloseTo(box.sRight, 0);
    expect(box.fLeft - box.sLeft).toBeLessThanOrEqual(6);
  });

  test("a workflow without a diagram renders 'Why it works' as before", async ({ page }) => {
    await page.goto("/workflows/fx-claude-only");
    const why = page.locator("section[aria-labelledby=why-it-works]");
    expect(await why.evaluate((s) => [...s.children].map((c) => c.tagName)).then((t) => t.slice(0, 2))).toEqual(["H2", "P"]);
    await expect(page.locator('figure[data-testid="diagram"]')).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Watch:/ })).toHaveCount(0);
  });

  test("DG-11: the watch line links to the lesson's Watch block", async ({ page }) => {
    await page.goto("/workflows/fx-both-tools");
    const link = page.getByRole("link", { name: /^Watch:/ });
    await expect(link).toHaveCount(1);
    await expect(link).toHaveText("Watch: First session: a working install (Lesson 1.1) →");
    await expect(link).toHaveAccessibleName("Watch: First session: a working install (Lesson 1.1)");
    await expect(link).toHaveAttribute("href", "/lessons/l1-first-session#watch-l1-first-session");
    await link.click();
    await expect(page).toHaveURL(/\/lessons\/l1-first-session#watch-l1-first-session$/);
    await expect(page.locator("h3#watch-l1-first-session")).toBeVisible();
  });

  test("the watch line comes after the diagram and before the prose", async ({ page }) => {
    await page.goto("/workflows/fx-both-tools");
    const kids = await page.locator("section[aria-labelledby=why-it-works]").evaluate((s) => [...s.children].map((c) => c.tagName));
    expect(kids.slice(0, 4)).toEqual(["H2", "FIGURE", "P", "P"]);
  });

  for (const scheme of SCHEMES) {
    test(`axe finds no serious violation on the workflow page at 360 and 1440, ${scheme}`, async ({ page }) => {
      for (const width of [360, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto("/workflows/fx-both-tools");
        await page.locator('figure[data-testid="diagram"]').waitFor();
        await expectNoSeriousA11y(page, { include: "section[aria-labelledby=why-it-works]" });
      }
    });
  }
});
