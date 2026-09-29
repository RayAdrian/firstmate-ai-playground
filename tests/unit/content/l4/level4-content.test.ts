// @vitest-environment node
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { describe, expect, it } from "vitest";
import { checklistItemSchema, exerciseJsonSchema, lessonFrontmatterSchema } from "@/lib/contracts";

const root = path.resolve(__dirname, "../../../..");
const lessonsDir = path.join(root, "content/lessons/l4");
const exercisesDir = path.join(root, "exercises");

const EXPECTED = [
  { file: "01-subagents.md", slug: "l4-subagents", sort: 1, exercise: "ex-4-1-subagents" },
  { file: "02-parallel-worktrees.md", slug: "l4-parallel-worktrees", sort: 2, exercise: "ex-4-2-worktrees" },
  { file: "03-mcp-servers.md", slug: "l4-mcp-servers", sort: 3, exercise: "ex-4-3-mcp-browser" },
  { file: "04-hooks-skills-commands.md", slug: "l4-hooks-skills-commands", sort: 4, exercise: "ex-4-4-automation" },
];

/** Top-level `## ` headings, ignoring anything inside fenced code blocks. */
function sections(body: string): Map<string, string> {
  const out = new Map<string, string>();
  let current: string | null = null;
  let fence = false;
  for (const line of body.split("\n")) {
    if (line.startsWith("```")) fence = !fence;
    const heading = !fence ? line.match(/^## (.+?)\s*$/) : null;
    if (heading) {
      current = heading[1];
      out.set(current, "");
    } else if (current !== null) {
      out.set(current, `${out.get(current)}${line}\n`);
    }
  }
  return out;
}

describe("level 4 lessons", () => {
  it("has exactly the four lessons from PRD 7", () => {
    expect(readdirSync(lessonsDir).sort()).toEqual(EXPECTED.map((e) => e.file));
  });

  for (const expected of EXPECTED) {
    describe(expected.file, () => {
      const parsed = matter(readFileSync(path.join(lessonsDir, expected.file), "utf8"));

      it("has valid frontmatter per the lesson contract", () => {
        const fm = lessonFrontmatterSchema.parse(parsed.data);
        expect(fm.slug).toBe(expected.slug);
        expect(fm.level).toBe(4);
        expect(fm.sort).toBe(expected.sort);
        expect(fm.exercise).toBe(expected.exercise);
        expect(fm.tool_versions).toEqual({ claude_code: "2.1.284", codex_cli: "0.154.0" });
        expect(fm.differences.length).toBeGreaterThanOrEqual(1);
        expect(fm.differences.length).toBeLessThanOrEqual(5);
      });

      it("has exactly the Concept, Claude Code and Codex CLI sections, all non-empty", () => {
        const found = sections(parsed.content);
        expect([...found.keys()]).toEqual(["Concept", "Claude Code", "Codex CLI"]);
        for (const [name, text] of found) expect(text.trim().length, name).toBeGreaterThan(200);
      });

      it("ends the concept with a First Mate tip", () => {
        const concept = sections(parsed.content).get("Concept") ?? "";
        expect(concept).toMatch(/^### First Mate tip$/m);
      });

      it("points at an exercise directory that exists", () => {
        expect(existsSync(path.join(exercisesDir, expected.exercise, "exercise.json"))).toBe(true);
      });
    });
  }
});

describe("level 4 exercises", () => {
  for (const { exercise: slug } of EXPECTED) {
    describe(slug, () => {
      const dir = path.join(exercisesDir, slug);

      it("has the required files", () => {
        for (const p of ["README.md", "CHECKLIST.md", "exercise.json", "starter/package.json", "solution/package.json"]) {
          expect(existsSync(path.join(dir, p)), p).toBe(true);
        }
      });

      it("has a valid exercise.json", () => {
        const json = exerciseJsonSchema.parse(JSON.parse(readFileSync(path.join(dir, "exercise.json"), "utf8")));
        expect(json.slug).toBe(slug);
        expect(json.verify).not.toBe("manual");
        expect(json.starter_prompts?.claude.length).toBeGreaterThan(50);
        expect(json.starter_prompts?.codex.length).toBeGreaterThan(50);
        expect(json.solution_notes?.length).toBeGreaterThanOrEqual(2);
      });

      it("has a checklist with stable, unique ids", () => {
        const lines = readFileSync(path.join(dir, "CHECKLIST.md"), "utf8")
          .split("\n")
          .filter((l) => l.trim() !== "");
        const items = lines.map((l) => {
          const m = l.match(/^- \[ \] ([a-z0-9_-]{1,64}): (.+)$/);
          expect(m, `bad checklist line: ${l}`).not.toBeNull();
          return checklistItemSchema.parse({ id: m![1], text: m![2] });
        });
        expect(items.length).toBeGreaterThanOrEqual(5);
        expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
      });

      it("verify fails on starter/ and passes on solution/", () => {
        const { verify } = JSON.parse(readFileSync(path.join(dir, "exercise.json"), "utf8")) as { verify: string };
        const run = (which: string) => spawnSync("sh", ["-c", verify], { cwd: path.join(dir, which), encoding: "utf8" });
        expect(run("starter").status).not.toBe(0);
        expect(run("solution").status).toBe(0);
      }, 60_000);
    });
  }
});
