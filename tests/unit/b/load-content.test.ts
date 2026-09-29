import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatIssue } from "../../../scripts/seed/lib/issues";
import { loadContent } from "../../../scripts/seed/lib/load";
import { FM_NOW, contentSandbox } from "./helpers";

function load(sb: ReturnType<typeof contentSandbox>) {
  return loadContent({ contentDir: sb.contentDir, exercisesDir: sb.exercisesDir, now: FM_NOW });
}

describe("loadContent: happy path (TC-B-01, TC-B-04)", () => {
  it("loads 2 levels, 4 lessons and 2 exercises with no issues", () => {
    const r = load(contentSandbox());
    expect(r.issues.map(formatIssue)).toEqual([]);
    expect(r.levels.map((l) => [l.number, l.slug, l.title])).toEqual([
      [1, "l1", "Foundations"],
      [2, "l2", "Context engineering"],
    ]);
    expect(r.lessons.map((l) => l.slug).sort()).toEqual([
      "l1-first-session",
      "l1-permissions",
      "l2-context-files",
      "l2-memory",
    ]);
    const auto = r.exercises.find((e) => e.slug === "ex-fx-auto");
    expect(auto).toMatchObject({
      lessonSlug: "l1-first-session",
      verify_cmd: "npm test",
      repo_path: "exercises/ex-fx-auto/starter",
      setup_cmd: "cp -r exercises/ex-fx-auto/starter ~/fm-ex/ex-fx-auto && cd ~/fm-ex/ex-fx-auto && npm i",
      checklist: [
        { id: "c1", text: "Test is green" },
        { id: "c2", text: "No test files edited" },
        { id: "c3", text: "Diff reviewed" },
      ],
      starter_prompts: { claude: "Claude prompt fx", codex: "Codex prompt fx" },
    });
    expect(auto?.solution_notes).toHaveLength(3);
    expect(r.exercises.find((e) => e.slug === "ex-fx-manual")?.verify_cmd).toBeNull();
  });

  it("pins the fenced fixture blocks byte for byte", () => {
    const l = load(contentSandbox()).lessons.find((x) => x.slug === "l1-first-session");
    expect(l?.concept_md).toContain("```bash\nnpm i -g @anthropic-ai/claude-code\nclaude --version\n```");
    expect(l?.concept_md).toContain('```json title="settings.json"\n{ "permissions": { "allow": ["Bash(npm test)"] } }\n```');
    expect(l?.concept_md).toContain(`\`\`\`\necho "plain block"\n${"x".repeat(300)}\n\`\`\``);
  });

  it("has a stable content_hash across loads", () => {
    const sb = contentSandbox();
    expect(load(sb).lessons.map((l) => l.content_hash)).toEqual(load(sb).lessons.map((l) => l.content_hash));
  });
});

describe("loadContent: missing directories", () => {
  it("tolerates a missing content directory", () => {
    const empty = mkdtempSync(path.join(tmpdir(), "fm-empty-"));
    try {
      const r = loadContent({ contentDir: path.join(empty, "content"), exercisesDir: path.join(empty, "exercises"), now: FM_NOW });
      expect(r.issues).toEqual([]);
      expect(r.levels).toEqual([]);
      expect(r.lessons).toEqual([]);
      expect(r.exercises).toEqual([]);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it("tolerates an empty lessons directory", () => {
    const sb = contentSandbox();
    sb.remove("content/lessons/l1");
    sb.remove("content/lessons/l2");
    sb.remove("exercises");
    const r = load(sb);
    expect(r.issues.map(formatIssue)).toEqual([]);
    expect(r.lessons).toEqual([]);
  });
});

describe("loadContent: validation", () => {
  it("folder and frontmatter level must agree (TC-B-02)", () => {
    const sb = contentSandbox();
    sb.write(
      "content/lessons/l2/01-first-session.md",
      readFileSync(`${sb.contentDir}/lessons/l1/01-first-session.md`, "utf8"),
    );
    sb.remove("content/lessons/l1/01-first-session.md");
    const out = load(sb).issues.map(formatIssue).join("\n");
    expect(out).toContain("content/lessons/l2/01-first-session.md");
    expect(out).toMatch(/level/);
  });

  it("collects every fault before reporting (TC-B-08)", () => {
    const sb = contentSandbox();
    sb.edit("content/lessons/l1/01-first-session.md", (t) => t.replace(/^objective: .*\n/m, ""));
    sb.edit("exercises/ex-fx-manual/exercise.json", (t) => t.replace('"verify": "manual"', '"verify": 42'));
    sb.edit("content/levels.yaml", (t) => t.replace("    title: Context engineering\n", ""));
    const issues = load(sb).issues;
    const files = issues.map((i) => i.file);
    expect(files).toContain("content/lessons/l1/01-first-session.md");
    expect(files).toContain("exercises/ex-fx-manual/exercise.json");
    expect(files).toContain("content/levels.yaml");
    for (const i of issues) expect(i.field && i.reason).toBeTruthy();
  });

  it("rejects a duplicate slug across files (TC-B-13)", () => {
    const sb = contentSandbox();
    sb.write(
      "content/lessons/l2/03-copy.md",
      `---\nslug: l1-first-session\nlevel: 2\nsort: 3\ntitle: Copy\nobjective: o\nest_minutes: 5\ntool_versions:\n  claude_code: "2.1.0"\n  codex_cli: "0.40.0"\nlast_verified_on: 2026-09-01\ndifferences:\n  - d\n---\n\n## Concept\nC\n\n## Claude Code\nCC\n\n## Codex CLI\nCX\n`,
    );
    const issues = load(sb).issues;
    const dup = issues.find((i) => i.field === "slug");
    expect(dup?.reason).toMatch(/duplicate slug/);
    const text = formatIssue(dup!);
    expect(text).toContain("01-first-session.md");
    expect(text).toContain("03-copy.md");
  });

  it("rejects a duplicate sort within a level (TC-B-14)", () => {
    const sb = contentSandbox();
    sb.edit("content/lessons/l1/02-permissions.md", (t) => t.replace("sort: 2", "sort: 1"));
    const dup = load(sb).issues.find((i) => i.field === "sort");
    expect(dup?.reason).toMatch(/duplicate sort 1 in level 1/);
  });

  it("exercise references must resolve (TC-B-15)", () => {
    const a = contentSandbox();
    a.edit("content/lessons/l1/01-first-session.md", (t) => t.replace("exercise: ex-fx-auto", "exercise: ex-does-not-exist"));
    expect(load(a).issues.find((i) => i.field === "exercise")?.reason).toMatch(/unknown exercise/);

    const b = contentSandbox();
    b.edit("content/lessons/l2/01-context-files.md", (t) => t.replace("exercise: ex-fx-manual", "exercise: ex-fx-auto"));
    expect(load(b).issues.find((i) => i.field === "exercise")?.reason).toMatch(/already linked to l1-first-session/);

    const c = contentSandbox();
    c.edit("exercises/ex-fx-auto/exercise.json", (t) => t.replace('"slug": "ex-fx-auto"', '"slug": "ex-other"'));
    expect(load(c).issues.find((i) => i.field === "slug")?.reason).toMatch(/does not match folder/);
  });

  it("exercise.json is strict (TC-B-16)", () => {
    const sb = contentSandbox();
    sb.edit("exercises/ex-fx-auto/exercise.json", (t) => t.replace('"verify": "npm test"', '"verify": "npm test", "requiredKeys": ["OPENAI_API_KEY"]'));
    const i = load(sb).issues.find((x) => x.file.endsWith("exercise.json"));
    expect(i?.reason).toMatch(/unrecognized key/i);

    const empty = contentSandbox();
    empty.edit("exercises/ex-fx-auto/exercise.json", (t) => t.replace('"verify": "npm test"', '"verify": ""'));
    expect(load(empty).issues.find((x) => x.field === "verify")).toBeTruthy();

    const upper = contentSandbox();
    upper.edit("exercises/ex-fx-manual/exercise.json", (t) => t.replace('"manual"', '"MANUAL"'));
    expect(load(upper).issues.find((x) => x.field === "verify")?.reason).toMatch(/exactly "manual"/);
  });

  it("reports invalid JSON with a line", () => {
    const sb = contentSandbox();
    sb.write("exercises/ex-fx-auto/exercise.json", '{\n  "slug": "ex-fx-auto",\n  oops\n}');
    const i = load(sb).issues.find((x) => x.file.endsWith("exercise.json"));
    expect(i?.reason).toMatch(/invalid JSON/);
  });

  it("requires README.md, CHECKLIST.md, starter and solution (E-4.1)", () => {
    const sb = contentSandbox();
    sb.remove("exercises/ex-fx-auto/README.md");
    sb.remove("exercises/ex-fx-auto/solution");
    const reasons = load(sb).issues.map((i) => `${i.file} ${i.reason}`);
    expect(reasons.some((r) => r.includes("README.md"))).toBe(true);
    expect(reasons.some((r) => r.includes("solution"))).toBe(true);
  });

  it("a level referenced by a lesson must exist", () => {
    const sb = contentSandbox();
    sb.edit("content/levels.yaml", (t) => t.slice(0, t.indexOf("  - number: 2")));
    expect(load(sb).issues.some((i) => i.field === "level" && /no level 2/.test(i.reason))).toBe(true);
  });

  it("warns about an exercise no lesson references", () => {
    const sb = contentSandbox();
    sb.edit("content/lessons/l1/01-first-session.md", (t) => t.replace("exercise: ex-fx-auto\n", ""));
    const r = load(sb);
    expect(r.issues).toEqual([]);
    expect(r.exercises.find((e) => e.slug === "ex-fx-auto")).toBeUndefined();
    expect(r.warnings.some((w) => /no lesson/.test(w.reason))).toBe(true);
  });
});

describe("formatIssue", () => {
  it("renders file:line: field: reason", () => {
    expect(formatIssue({ file: "a.md", line: 3, field: "slug", reason: "bad" })).toBe("a.md:3: slug: bad");
    expect(formatIssue({ file: "a.md", field: "slug", reason: "bad" })).toBe("a.md: slug: bad");
  });
});
