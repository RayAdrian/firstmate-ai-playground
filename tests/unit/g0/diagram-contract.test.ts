// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse as parseYaml, parseDocument } from "yaml";
import {
  DIAGRAM_YAML_OPTIONS,
  diagramSchema,
  estimateTextWidth,
  DIAGRAM_LABEL_MAX,
  buildWorkflowFrontmatterSchema,
  workflowRowSchema,
} from "@/lib/contracts";
import {
  EDGE16,
  L24,
  SUB28,
  boundaryInput,
  capBoundary,
  capFlow,
  capLanes,
  capStack,
  flowInput,
  lanesInput,
  stackInput,
} from "./fixtures";

type Obj = Record<string, unknown>;
const clone = <T,>(v: T): T => structuredClone(v);
const issues = (v: unknown) => {
  const r = diagramSchema.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};
const fails = (v: unknown, pathPrefix: string) => {
  const found = issues(v);
  expect(found.length, `expected a failure at ${pathPrefix}`).toBeGreaterThan(0);
  expect(found.some((m) => m.startsWith(pathPrefix)), found.join(" | ")).toBe(true);
};

describe("diagramSchema: valid fixtures", () => {
  it.each([
    ["flow", flowInput],
    ["stack", stackInput],
    ["boundary", boundaryInput],
    ["lanes", lanesInput],
    ["flow at caps", capFlow],
    ["stack at caps", capStack],
    ["boundary at caps", capBoundary],
    ["lanes at caps", capLanes],
  ])("%s parses", (_n, make) => {
    expect(issues(make())).toEqual([]);
  });

  it("applies defaults for loops, exits, items and crossings", () => {
    const f = diagramSchema.parse({ type: "flow", id: "f", title: "t", summary: "s", steps: [{ id: "a", label: "A" }, { id: "b", label: "B" }] });
    expect(f).toMatchObject({ loops: [], exits: [] });
    const b = diagramSchema.parse({ type: "boundary", id: "b", title: "t", summary: "s", zones: [{ id: "z", label: "Z" }] });
    expect(b).toMatchObject({ crossings: [], zones: [{ items: [] }] });
  });

  it("rejects an unknown type (a 5th type needs a design review)", () => {
    expect(issues({ ...flowInput(), type: "comparison" }).length).toBeGreaterThan(0);
  });
});

describe("diagramSchema: text caps are hard fails", () => {
  it.each([
    ["title 61", (d: Obj) => (d.title = "t".repeat(61)), "title"],
    ["title empty", (d: Obj) => (d.title = ""), "title"],
    ["summary 201", (d: Obj) => (d.summary = "s".repeat(201)), "summary"],
    ["id uppercase", (d: Obj) => (d.id = "Bad"), "id"],
    ["id 33 chars", (d: Obj) => (d.id = "a".repeat(33)), "id"],
    ["unknown key", (d: Obj) => (d.extra = 1), ""],
  ])("common: %s", (_n, mutate, p) => {
    const d = clone(flowInput()) as Obj;
    mutate(d);
    fails(d, p);
  });

  const withStep = (patch: Obj) => {
    const d = clone(flowInput()) as Obj;
    Object.assign((d.steps as Obj[])[0], patch);
    return d;
  };
  it("label: 24-char lines and 2 lines pass, the 49-char cap is the max", () => {
    expect(DIAGRAM_LABEL_MAX).toBe(49);
    expect(issues(withStep({ label: `${L24}\n${L24}` }))).toEqual([]);
  });
  it.each([
    ["a line of 25", { label: "x".repeat(25) }],
    ["3 lines", { label: "a\nb\nc" }],
    ["an empty line", { label: "a\n" }],
    ["a blank line", { label: "a\n  " }],
    ["a leading newline", { label: "\na" }],
    ["2 lines but one of 25", { label: `${L24}\n${"x".repeat(25)}` }],
    ["total over 49", { label: "x".repeat(50) }],
    ["empty", { label: "" }],
    ["sub of 29", { sub: `${SUB28}x` }],
    ["a multi-line sub", { sub: "a\nb" }],
    ["empty sub", { sub: "" }],
    ["next of 17", { next: `${EDGE16}x` }],
    ["emphasis false", { emphasis: false }],
    ["step key", { colour: "red" }],
  ])("flow step: %s fails", (_n, patch) => {
    fails(withStep(patch), "steps.0");
  });
  it("sub of exactly 28 and edge of exactly 16 pass", () => {
    expect(issues(withStep({ sub: SUB28, next: EDGE16 }))).toEqual([]);
  });
});

describe("diagramSchema: count caps are hard fails", () => {
  const step = (i: number) => ({ id: `s${i}`, label: `S${i}` });
  it("flow steps 2..6", () => {
    const d = clone(flowInput()) as Obj;
    d.loops = [];
    d.exits = [];
    d.steps = [step(1)];
    fails(d, "steps");
    d.steps = [1, 2, 3, 4, 5, 6, 7].map(step);
    fails(d, "steps");
    d.steps = [1, 2].map(step);
    expect(issues(d)).toEqual([]);
  });
  it("flow loops <= 2 and exits <= 2", () => {
    const d = clone(flowInput()) as Obj;
    d.loops = [1, 2, 3].map(() => ({ from: "verify", to: "edit", label: "x" }));
    fails(d, "loops");
    d.loops = [];
    d.exits = [1, 2, 3].map(() => ({ from: "verify", label: "x", text: "X", style: "ok" }));
    fails(d, "exits");
  });
  it("flow exit style must be ok or risk", () => {
    const d = clone(flowInput()) as Obj;
    d.exits = [{ from: "verify", label: "x", text: "X", style: "warn" }];
    fails(d, "exits.0.style");
  });
  it("stack layers 2..5, and the axis is required", () => {
    const d = clone(stackInput()) as Obj;
    d.layers = [{ id: "a", label: "A" }];
    fails(d, "layers");
    d.layers = [1, 2, 3, 4, 5, 6].map((i) => ({ id: `l${i}`, label: "L" }));
    fails(d, "layers");
    const e = clone(stackInput()) as Obj;
    delete e.axis;
    fails(e, "axis");
    const g = clone(stackInput()) as Obj;
    g.axis = { low: `${EDGE16}x`, high: "h" };
    fails(g, "axis.low");
  });
  it("boundary: at most 4 items per zone, 4 crossings, 3 zones in total", () => {
    const d = clone(boundaryInput()) as Obj;
    (d.zones as Obj[])[1].items = [1, 2, 3, 4, 5].map((i) => ({ id: `i${i}`, label: "I" }));
    fails(d, "zones.1.items");
    const c = clone(boundaryInput()) as Obj;
    c.crossings = [1, 2, 3, 4, 5].map(() => ({ from: "web", to: "shell", label: "x" }));
    fails(c, "crossings");
    const z = clone(boundaryInput()) as Obj;
    (z.zones as Obj[]).push({ id: "extra", label: "Extra" });
    fails(z, "zones");
  });
  it("boundary: a nested zone carries no zones (one level deep)", () => {
    const d = clone(boundaryInput()) as Obj;
    const nested = ((d.zones as Obj[])[0].zones as Obj[])[0];
    nested.zones = [{ id: "deep", label: "Deep" }];
    fails(d, "zones.0.zones.0");
  });
  it("boundary: zone labels are single lines of at most 24", () => {
    const d = clone(boundaryInput()) as Obj;
    (d.zones as Obj[])[0].label = "x".repeat(25);
    fails(d, "zones.0.label");
  });
  it("lanes: 2..3 lanes, cols 1..6 integers, 4 handoffs, 1 marker", () => {
    const one = clone(lanesInput()) as Obj;
    one.lanes = [{ id: "reviewer", label: "R" }];
    fails(one, "lanes");
    const four = clone(lanesInput()) as Obj;
    four.lanes = [1, 2, 3, 4].map((i) => ({ id: `l${i}`, label: "L" }));
    fails(four, "lanes");
    for (const col of [0, 7, 1.5]) {
      const d = clone(lanesInput()) as Obj;
      (d.steps as Obj[])[0].col = col;
      fails(d, "steps.0.col");
    }
    const h = clone(lanesInput()) as Obj;
    h.handoffs = [1, 2, 3, 4, 5].map(() => ({ from: "review-a", to: "push-b" }));
    fails(h, "handoffs");
    const m = clone(lanesInput()) as Obj;
    m.marker = { col: 7, label: "x", style: "ok" };
    fails(m, "marker.col");
    const m2 = clone(lanesInput()) as Obj;
    m2.marker = [{ col: 1, label: "x", style: "ok" }];
    fails(m2, "marker");
  });
  it("lanes: at least 2 steps", () => {
    const d = clone(lanesInput()) as Obj;
    d.steps = [(d.steps as Obj[])[0]];
    d.handoffs = [];
    fails(d, "steps");
  });
});

describe("diagramSchema: cross-field rules", () => {
  it("duplicate node ids fail, across zones, items and lanes", () => {
    const f = clone(flowInput()) as Obj;
    (f.steps as Obj[])[1].id = "ask";
    fails(f, "steps.1.id");
    const b = clone(boundaryInput()) as Obj;
    ((b.zones as Obj[])[1].items as Obj[])[0].id = "web";
    fails(b, "zones.1.items.0.id");
    const b2 = clone(boundaryInput()) as Obj;
    (b2.zones as Obj[])[1].id = "web"; // zone id colliding with an item id
    fails(b2, "zones.1.id");
    const l = clone(lanesInput()) as Obj;
    (l.steps as Obj[])[0].id = "reviewer"; // step id colliding with a lane id
    fails(l, "steps.0.id");
  });

  it("flow references must resolve", () => {
    const d = clone(flowInput()) as Obj;
    (d.loops as Obj[])[0].from = "nope";
    fails(d, "loops.0.from");
    const e = clone(flowInput()) as Obj;
    (e.loops as Obj[])[0].to = "nope";
    fails(e, "loops.0.to");
    const x = clone(flowInput()) as Obj;
    (x.exits as Obj[])[0].from = "nope";
    fails(x, "exits.0.from");
  });

  it("a flow loop's `to` may not be after its `from`; a self-loop is allowed", () => {
    const d = clone(flowInput()) as Obj;
    d.loops = [{ from: "edit", to: "verify", label: "x" }];
    fails(d, "loops.0.to");
    d.loops = [{ from: "edit", to: "edit", label: "x" }];
    expect(issues(d)).toEqual([]);
  });

  it("boundary crossings may reference an item or a zone, and must resolve", () => {
    const d = clone(boundaryInput()) as Obj;
    d.crossings = [{ from: "outside", to: "host", label: "x" }, { from: "web", to: "shell", label: "y" }];
    expect(issues(d)).toEqual([]);
    d.crossings = [{ from: "ghost", to: "host", label: "x" }];
    fails(d, "crossings.0.from");
    d.crossings = [{ from: "web", to: "ghost", label: "x" }];
    fails(d, "crossings.0.to");
  });

  it("lanes references and (lane, col) uniqueness", () => {
    const a = clone(lanesInput()) as Obj;
    (a.steps as Obj[])[0].lane = "ghost";
    fails(a, "steps.0.lane");
    const b = clone(lanesInput()) as Obj;
    (b.steps as Obj[])[1].lane = "reviewer";
    (b.steps as Obj[])[1].col = 1;
    fails(b, "steps.1.col");
    const c = clone(lanesInput()) as Obj;
    (c.handoffs as Obj[])[0].to = "ghost";
    fails(c, "handoffs.0.to");
    const d = clone(lanesInput()) as Obj;
    (d.handoffs as Obj[])[0].from = "reviewer"; // a lane is not a step
    fails(d, "handoffs.0.from");
  });

  it("at most one emphasised node per diagram, in every type", () => {
    const f = clone(flowInput()) as Obj;
    (f.steps as Obj[])[2].emphasis = true;
    fails(f, "steps.2.emphasis");
    const s = clone(stackInput()) as Obj;
    (s.layers as Obj[])[0].emphasis = true;
    fails(s, "layers.2.emphasis"); // the later of the two is reported
    const b = clone(boundaryInput()) as Obj;
    ((b.zones as Obj[])[1].items as Obj[])[0].emphasis = true;
    fails(b, "zones.1.items.0.emphasis");
    const l = clone(lanesInput()) as Obj;
    (l.steps as Obj[])[0].emphasis = true;
    fails(l, "steps.2.emphasis"); // the later of the two is reported
  });
});

describe("estimateTextWidth", () => {
  it("is 0.55em per character plus 15% slack", () => {
    expect(estimateTextWidth("", 14)).toBe(0);
    expect(estimateTextWidth("abcd", 10)).toBeCloseTo(4 * 0.55 * 10 * 1.15, 10);
    expect(estimateTextWidth(L24, 14)).toBeCloseTo(24 * 0.55 * 14 * 1.15, 10);
  });
  it("scales linearly with length and font size", () => {
    expect(estimateTextWidth("ab", 12) * 2).toBeCloseTo(estimateTextWidth("abcd", 12), 10);
    expect(estimateTextWidth("abc", 24)).toBeCloseTo(estimateTextWidth("abc", 12) * 2, 10);
  });
});

describe("DIAGRAM_YAML_OPTIONS", () => {
  const ok = "type: flow\nid: f\ntitle: T\nsummary: S\n";
  it("parses plain YAML", () => {
    expect(parseYaml(ok, DIAGRAM_YAML_OPTIONS)).toMatchObject({ type: "flow", id: "f" });
  });
  it("rejects aliases", () => {
    expect(() => parseYaml("a: &x 1\nb: *x\n", DIAGRAM_YAML_OPTIONS)).toThrow();
  });
  it("does not expand merge keys", () => {
    const v = parseYaml("base: &b {a: 1}\nm:\n  <<: *b\n", { ...DIAGRAM_YAML_OPTIONS, maxAliasCount: -1 });
    expect(v.m).not.toEqual({ a: 1 });
  });
  it("rejects duplicate keys", () => {
    expect(() => parseYaml("a: 1\na: 2\n", DIAGRAM_YAML_OPTIONS)).toThrow();
  });
  it("does not resolve custom tags to values", () => {
    const doc = parseDocument("a: !custom 1\n", DIAGRAM_YAML_OPTIONS);
    expect(doc.warnings.length + doc.errors.length).toBeGreaterThan(0);
  });
  it("round-trips a fixture through YAML into the schema", () => {
    const text = "type: stack\nid: s\ntitle: T\nsummary: S\nlayers:\n  - {id: a, label: A}\n  - {id: b, label: B}\naxis: {low: l, high: h}\n";
    expect(diagramSchema.safeParse(parseYaml(text, DIAGRAM_YAML_OPTIONS)).success).toBe(true);
  });
});

describe("workflow frontmatter: diagram and watch (PRD §17.3)", () => {
  const ctx = {
    useCases: ["review"],
    stacks: ["any"],
    lessonSlugs: ["l4-parallel-worktrees"],
    mediaIds: ["l4-parallel-worktrees/worktrees", "l5-gates/gates"],
    today: "2026-10-01",
  };
  const base = {
    title: "Per-SHA gate statuses",
    problem: "An approval given on one commit silently covers a later push",
    tools: ["claude-code"],
    use_cases: ["review"],
    stacks: ["any"],
    tool_versions: { claude_code: "2.1.0" },
    verified_on: "2026-09-30",
    client_safe: "confirmed",
  };
  const run = (extra: Obj, c: object = ctx) => {
    const r = buildWorkflowFrontmatterSchema(c).safeParse({ ...base, ...extra });
    return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  };

  it("files without the fields stay valid", () => {
    expect(run({})).toEqual([]);
  });
  it("accepts a valid diagram and watch", () => {
    expect(run({ diagram: flowInput(), watch: "l4-parallel-worktrees/worktrees" })).toEqual([]);
  });
  it("rejects an invalid diagram with a diagram.* path", () => {
    const bad = clone(flowInput()) as Obj;
    bad.title = "t".repeat(61);
    expect(run({ diagram: bad }).some((m) => m.startsWith("diagram.title"))).toBe(true);
    const cross = clone(flowInput()) as Obj;
    (cross.loops as Obj[])[0].to = "ghost";
    expect(run({ diagram: cross }).some((m) => m.startsWith("diagram.loops.0.to"))).toBe(true);
  });
  it.each(["Lesson/media", "l4", "l4/", "/x", "a/b/c", "a b/c", "l4-parallel-worktrees:worktrees", ""])(
    "rejects malformed watch %j",
    (w) => {
      expect(run({ watch: w }, {}).some((m) => m.startsWith("watch"))).toBe(true);
    },
  );
  it("rejects a watch that resolves to no manifest, only when mediaIds is given", () => {
    expect(run({ watch: "l4-parallel-worktrees/ghost" }).some((m) => m.startsWith("watch"))).toBe(true);
    expect(run({ watch: "l4-parallel-worktrees/ghost" }, { ...ctx, mediaIds: undefined })).toEqual([]);
    expect(run({ watch: "l4-parallel-worktrees/ghost" }, { ...ctx, mediaIds: [] }).some((m) => m.startsWith("watch"))).toBe(true);
  });
  it("watch is not derived from, or checked against, related_lesson", () => {
    expect(run({ related_lesson: "l4-parallel-worktrees", watch: "l5-gates/gates" })).toEqual([]);
  });
});

describe("workflow row and migration", () => {
  const row = {
    id: "00000000-0000-0000-0000-000000000001",
    slug: "per-sha-gate-statuses",
    title: "Per-SHA gate statuses",
    problem: "An approval given on one commit silently covers a later push",
    tools: ["claude-code"],
    setup: [],
    setup_kinds: [],
    prompt: { shared: "Do the thing" },
    result_before: "before",
    result_after: "after",
    steps: ["one"],
    why_md: "because",
    use_cases: ["review"],
    stacks: ["any"],
    related_lesson_slug: null,
    level: null,
    tool_versions: {},
    verified_on: "2026-09-30",
    author_name: "First Mate Stewards",
    reviewed_on: null,
    content_hash: "abc",
    removed_at: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  };
  it("treats diagram and watch as optional, accepts null and parsed values", () => {
    expect(workflowRowSchema.safeParse(row).success).toBe(true);
    expect(workflowRowSchema.parse({ ...row, diagram: null, watch: null })).toMatchObject({ diagram: null, watch: null });
    const parsed = workflowRowSchema.parse({ ...row, diagram: flowInput(), watch: "l4/x" });
    expect(parsed.diagram?.type).toBe("flow");
    expect(parsed.watch).toBe("l4/x");
  });
  it("rejects an invalid stored diagram or watch", () => {
    expect(workflowRowSchema.safeParse({ ...row, diagram: { type: "flow" } }).success).toBe(false);
    expect(workflowRowSchema.safeParse({ ...row, watch: "nope" }).success).toBe(false);
  });
  it("the migration adds both columns, nullable, without touching grants", () => {
    const sql = readFileSync(path.join(process.cwd(), "supabase/migrations/20261002000000_workflow_diagrams.sql"), "utf8");
    expect(sql).toMatch(/add column diagram jsonb\b(?!.*not null)/i);
    expect(sql).toMatch(/add column watch text\b(?!.*not null)/i);
    expect(sql).not.toMatch(/\bdrop\b|\bgrant\b|\brevoke\b/i);
  });
});
