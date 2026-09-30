import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { describe, expect, it } from "vitest";
import { exerciseJsonSchema, checklistItemSchema, lessonFrontmatterSchema } from "@/lib/contracts";

const root = path.resolve(__dirname, "../../../..");
const lessonsDir = path.join(root, "content/lessons/l3");
const exercisesDir = path.join(root, "exercises");

const lessonFiles = readdirSync(lessonsDir).filter((f) => f.endsWith(".md")).sort();

/** Top-level `## ` headings of a markdown body, ignoring fenced code blocks. */
function h2Sections(body: string): Record<string, string> {
  const sections: Record<string, string> = {};
  let current: string | null = null;
  let fence = false;
  for (const line of body.split("\n")) {
    if (line.trimStart().startsWith("```")) fence = !fence;
    const m = !fence && line.match(/^## (.+?)\s*$/);
    if (m) {
      current = m[1];
      sections[current] = "";
    } else if (current !== null) {
      sections[current] += line + "\n";
    }
  }
  return sections;
}

/** CHECKLIST.md lines look like: - [ ] {#c1} text */
function parseChecklist(md: string) {
  return md
    .split("\n")
    .filter((l) => l.startsWith("- ["))
    .map((l) => {
      const m = l.match(/^- \[[ xX]\] \{#([a-z0-9_-]{1,64})\} (.+)$/);
      if (!m) throw new Error(`bad checklist line: ${l}`);
      return { id: m[1], text: m[2].trim() };
    });
}

describe("level 3 lessons", () => {
  it("has the four lessons from PRD section 7", () => {
    expect(lessonFiles).toEqual([
      "01-plan-first.md",
      "02-tdd-with-agents.md",
      "03-ai-code-review.md",
      "04-headless-and-scripted-agents.md",
    ]);
  });

  const parsed = lessonFiles.map((file) => {
    const { data, content } = matter(readFileSync(path.join(lessonsDir, file), "utf8"));
    return { file, data, content };
  });

  it("uses unique slugs and sort values 1..4", () => {
    expect(new Set(parsed.map((p) => p.data.slug)).size).toBe(4);
    expect(parsed.map((p) => p.data.sort)).toEqual([1, 2, 3, 4]);
  });

  for (const { file, data, content } of parsed) {
    describe(file, () => {
      it("frontmatter matches the lesson contract", () => {
        const fm = lessonFrontmatterSchema.parse(data);
        expect(fm.level).toBe(3);
        expect(fm.tool_versions).toEqual({ claude_code: "2.1.284", codex_cli: "0.154.0" });
      });

      it("has exactly the Concept, Claude Code and Codex CLI sections, all non-empty", () => {
        const sections = h2Sections(content);
        expect(Object.keys(sections).sort()).toEqual(["Claude Code", "Codex CLI", "Concept"]);
        for (const body of Object.values(sections)) expect(body.trim().length).toBeGreaterThan(200);
      });

      it("ends the concept with a First Mate tip", () => {
        expect(h2Sections(content)["Concept"]).toMatch(/^### First Mate tip$/m);
      });

      it("points at an exercise folder that exists and matches", () => {
        const fm = lessonFrontmatterSchema.parse(data);
        expect(existsSync(path.join(exercisesDir, fm.exercise, "exercise.json"))).toBe(true);
      });
    });
  }

  it("lesson 3.4 says the news pipeline uses claude -p", () => {
    const l34 = parsed.find((p) => p.data.slug === "l3-headless-agents");
    expect(l34?.content).toMatch(/news/i);
    expect(l34?.content).toMatch(/claude -p/);
  });
});

describe("level 3 exercises", () => {
  const slugs = ["ex-3-1-plan-first", "ex-3-2-tdd", "ex-3-3-review-seeded-bugs", "ex-3-4-headless-changelog"];

  for (const slug of slugs) {
    describe(slug, () => {
      const dir = path.join(exercisesDir, slug);
      const json = () => JSON.parse(readFileSync(path.join(dir, "exercise.json"), "utf8"));

      it("exercise.json matches the contract and its folder name", () => {
        const ex = exerciseJsonSchema.strict().parse(json());
        expect(ex.slug).toBe(slug);
        expect(ex.starter_prompts?.claude).toBeTruthy();
        expect(ex.starter_prompts?.codex).toBeTruthy();
        expect(ex.solution_notes?.length).toBeGreaterThanOrEqual(2);
      });

      it("has README, CHECKLIST with stable unique ids, a starter and a solution", () => {
        expect(existsSync(path.join(dir, "README.md"))).toBe(true);
        const items = parseChecklist(readFileSync(path.join(dir, "CHECKLIST.md"), "utf8"));
        expect(items.length).toBeGreaterThanOrEqual(5);
        for (const item of items) checklistItemSchema.parse(item);
        expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
        for (const part of ["starter", "solution"]) {
          expect(existsSync(path.join(dir, part, "package.json"))).toBe(true);
        }
      });
    });
  }

  it("lesson frontmatter names each exercise exactly once", () => {
    const named = lessonFiles.map((f) => matter(readFileSync(path.join(lessonsDir, f), "utf8")).data.exercise);
    expect(named.sort()).toEqual([...slugs].sort());
  });

  it("ex-3-3 is manual, the others have a verify command", () => {
    const verify = (s: string) => JSON.parse(readFileSync(path.join(exercisesDir, s, "exercise.json"), "utf8")).verify;
    expect(verify("ex-3-3-review-seeded-bugs")).toBe("manual");
    for (const s of ["ex-3-1-plan-first", "ex-3-2-tdd", "ex-3-4-headless-changelog"]) expect(verify(s)).not.toBe("manual");
  });

  // PRD E-4: every automated verify command fails on the starter and passes on the solution.
  for (const slug of ["ex-3-1-plan-first", "ex-3-2-tdd", "ex-3-4-headless-changelog"]) {
    it(`${slug}: verify fails on starter and passes on solution`, () => {
      const cmd: string = JSON.parse(readFileSync(path.join(exercisesDir, slug, "exercise.json"), "utf8")).verify;
      // A clean environment: node --test changes behaviour when it thinks it is nested in another runner.
      const env: NodeJS.ProcessEnv = { ...process.env };
      for (const key of ["NODE_OPTIONS", "NODE_TEST_CONTEXT", "VITEST", "VITEST_WORKER_ID", "VITEST_POOL_ID"]) delete env[key];
      const exec = (part: string) =>
        spawnSync("sh", ["-c", cmd], { cwd: path.join(exercisesDir, slug, part), encoding: "utf8", env });
      expect(exec("starter").status, "starter should fail").not.toBe(0);
      const solution = exec("solution");
      expect(solution.status, solution.stdout + solution.stderr).toBe(0);
    }, 60_000);
  }
});
