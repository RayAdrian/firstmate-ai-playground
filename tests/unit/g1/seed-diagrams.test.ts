import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatIssue } from "../../../scripts/seed/lib/issues";
import { loadContent } from "../../../scripts/seed/lib/load";
import { contentSandbox, FM_NOW } from "../b/helpers";

/** DG-7: a bad lesson diagram fails the seed. Each rule runs through the real loader on a temp content folder. */

const LESSON = "content/lessons/l2/01-context-files.md";
const GOOD = `type: stack
id: ladder
title: A ladder
summary: Higher wins.
layers:
  - {id: low, label: Low}
  - {id: high, label: High}
axis: {low: soft, high: hard}`;

const fence = (yaml: string): string => "```diagram\n" + yaml + "\n```";
/** Replace the whole Concept body of the fixture lesson. */
function withConcept(concept: string) {
  const sb = contentSandbox();
  sb.edit(LESSON, (t) => t.replace(/## Concept[\s\S]*?\n## Claude Code/, `## Concept\n\n${concept}\n\n## Claude Code`));
  return sb;
}
function load(sb: ReturnType<typeof contentSandbox>) {
  return loadContent({ contentDir: sb.contentDir, exercisesDir: sb.exercisesDir, now: FM_NOW });
}
const messages = (sb: ReturnType<typeof contentSandbox>) => load(sb).issues.map(formatIssue);

describe("DG-7: lesson diagram validation", () => {
  it("the fixture lessons (one diagram of each type) load with no issues, and the fence stays in concept_md", () => {
    const r = load(contentSandbox());
    expect(r.issues.map(formatIssue)).toEqual([]);
    expect(r.lessons.find((l) => l.slug === "l2-context-files")?.concept_md).toContain("```diagram\ntype: flow");
  });

  it("a valid diagram is accepted", () => {
    expect(messages(withConcept(`Prose.\n\n${fence(GOOD)}`))).toEqual([]);
  });

  it("invalid YAML", () => {
    const m = messages(withConcept(fence("type: [stack")));
    expect(m).toHaveLength(1);
    expect(m[0]).toMatch(/01-context-files\.md:\d+: diagram #1: diagram: /);
  });

  it("a schema or cap failure names the diagram id and the field", () => {
    const m = messages(withConcept(fence(GOOD.replace("label: Low", `label: ${"x".repeat(30)}`))));
    expect(m).toHaveLength(1);
    expect(m[0]).toMatch(/: diagram ladder: layers\[0\]\.label: /);
  });

  it("a cross-field failure (two emphasised nodes)", () => {
    const yaml = GOOD.replace("{id: low, label: Low}", "{id: low, label: Low, emphasis: true}").replace("{id: high, label: High}", "{id: high, label: High, emphasis: true}");
    const m = messages(withConcept(fence(yaml)));
    expect(m.some((x) => /diagram ladder: layers\[1\]\.emphasis: at most one emphasised node/.test(x))).toBe(true);
  });

  it("a label-fit failure is a seed error, named by path", () => {
    // Widths always fit by construction (fit-or-stack), so the reachable failure is the height budget: six two-line
    // steps with subs, stacked, is over 560.
    const steps = Array.from({ length: 6 }, (_, i) => `  - {id: s${i}, label: "${"a".repeat(24)}\\n${"b".repeat(24)}", sub: "${"c".repeat(28)}", next: edge}`).join("\n");
    const yaml = `type: flow\nid: tall\ntitle: T\nsummary: S\nsteps:\n${steps}`;
    const m = messages(withConcept(fence(yaml)));
    expect(m).toHaveLength(1);
    expect(m[0]).toMatch(/diagram tall: layout: height \d+ is over the 560 maximum/);
  });

  it("a duplicate diagram id in one lesson", () => {
    const m = messages(withConcept(`${fence(GOOD)}\n\n${fence(GOOD)}`));
    expect(m).toHaveLength(1);
    expect(m[0]).toMatch(/diagram ladder: id: duplicate diagram id "ladder"/);
  });

  it("more than 2 diagrams in a lesson", () => {
    const g = (id: string) => fence(GOOD.replace("id: ladder", `id: ${id}`));
    const m = messages(withConcept(`${g("one")}\n\n${g("two")}\n\n${g("three")}`));
    expect(m).toHaveLength(1);
    expect(m[0]).toMatch(/diagram three: fence: at most 2 diagrams per lesson/);
  });

  it("a diagram fence outside ## Concept", () => {
    const sb = withConcept("Prose.");
    sb.edit(LESSON, (t) => t.replace("Write a `CLAUDE.md` at the repo root.", `Write a file.\n\n${fence(GOOD)}`));
    const m = messages(sb);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatch(/diagram ladder: fence: a diagram fence is only allowed inside ## Concept \(found under ## Claude Code\)/);
  });

  it("anchors, aliases and custom tags are rejected", () => {
    for (const bad of [GOOD.replace("id: ladder", "id: &a ladder"), `${GOOD}\nextra: *a`, GOOD.replace("title: A ladder", "title: !custom A ladder")]) {
      expect(messages(withConcept(fence(bad))).length).toBeGreaterThan(0);
    }
  });

  it("a diagram-like fence in another language is not a diagram", () => {
    expect(messages(withConcept("```yaml\ntype: nonsense\n```"))).toEqual([]);
  });

  it("prints a non-failing note when the horizontal drawing falls back to the stacked form", () => {
    // Three columns of long labels do not fit a row.
    const z = (id: string) => `  - id: ${id}\n    label: ${"Z".repeat(20)}\n    items:\n      - {id: ${id}-i, label: "${"w".repeat(24)}"}`;
    const yaml = `type: boundary\nid: wide\ntitle: T\nsummary: S\nzones:\n${z("a")}\n${z("b")}\n${z("c")}`;
    const r = load(withConcept(fence(yaml)));
    expect(r.issues).toEqual([]);
    expect(r.warnings.map(formatIssue).join("\n")).toMatch(/diagram wide: horizontal stacked, labels too wide for a row/);
  });
});

describe("DG-7: the seed command", () => {
  it("npm run seed --dry-run exits 1, prints the message and writes nothing for a bad diagram", () => {
    const sb = withConcept(fence(GOOD.replace("label: Low", `label: ${"x".repeat(30)}`)));
    const res = spawnSync("npx", ["tsx", "scripts/seed/index.ts", "--dry-run"], {
      cwd: path.resolve(__dirname, "../../.."),
      env: { ...process.env, CONTENT_DIR: sb.contentDir, EXERCISES_DIR: sb.exercisesDir, FM_NOW: FM_NOW.toISOString() },
      encoding: "utf8",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/nothing was written/);
    expect(res.stderr).toMatch(/01-context-files\.md:\d+: diagram ladder: layers\[0\]\.label: /);
  }, 60_000);

  it("a valid fixture passes the dry run", () => {
    const out = execFileSync("npx", ["tsx", "scripts/seed/index.ts", "--dry-run"], {
      cwd: path.resolve(__dirname, "../../.."),
      env: { ...process.env, CONTENT_DIR: contentSandbox().contentDir, EXERCISES_DIR: contentSandbox().exercisesDir, FM_NOW: FM_NOW.toISOString() },
      encoding: "utf8",
    });
    expect(out).toMatch(/dry run OK/);
  }, 60_000);
});
