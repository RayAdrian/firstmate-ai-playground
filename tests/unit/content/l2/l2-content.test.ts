// @vitest-environment node
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { checklistItemSchema, exerciseJsonSchema, lessonFrontmatterSchema } from "@/lib/contracts";

const root = process.cwd();
const lessonDir = path.join(root, "content/lessons/l2");
const lessonFiles = readdirSync(lessonDir).filter((f) => f.endsWith(".md")).sort();

const expectedExercises = ["ex-2-1-conventions", "ex-2-2-long-task", "ex-2-3-feedback-loop"];

function sections(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  let current: string | null = null;
  let inFence = false;
  for (const line of body.split("\n")) {
    if (line.startsWith("```")) inFence = !inFence;
    const m = !inFence && /^## (.+?)\s*$/.exec(line);
    if (m) {
      current = m[1];
      out[current] = "";
    } else if (current) {
      out[current] += line + "\n";
    }
  }
  return out;
}

describe("level 2 lessons", () => {
  it("has lessons 2.1 to 2.3", () => {
    expect(lessonFiles).toHaveLength(3);
  });

  for (const file of lessonFiles) {
    describe(file, () => {
      const parsed = matter(readFileSync(path.join(lessonDir, file), "utf8"));
      const fm = lessonFrontmatterSchema.safeParse(parsed.data);

      it("frontmatter matches the lesson contract", () => {
        expect(fm.success, fm.success ? "" : JSON.stringify(fm.error.issues)).toBe(true);
      });

      it("is level 2 and records the verified tool versions", () => {
        if (!fm.success) throw new Error("invalid frontmatter");
        expect(fm.data.level).toBe(2);
        expect(fm.data.tool_versions.claude_code).toMatch(/^\d+\.\d+\.\d+/);
        expect(fm.data.tool_versions.codex_cli).toMatch(/^\d+\.\d+\.\d+/);
        expect(expectedExercises).toContain(fm.data.exercise);
      });

      it("has exactly the Concept, Claude Code and Codex CLI sections, all non-empty", () => {
        const s = sections(parsed.content);
        expect(Object.keys(s).sort()).toEqual(["Claude Code", "Codex CLI", "Concept"]);
        for (const body of Object.values(s)) expect(body.trim().length).toBeGreaterThan(200);
      });

      it("has a First Mate tip in the concept", () => {
        expect(sections(parsed.content)["Concept"]).toMatch(/^### First Mate tip$/m);
      });

      it("has balanced code fences and no raw HTML tags outside code", () => {
        const fences = parsed.content.split("\n").filter((l) => l.startsWith("```")).length;
        expect(fences % 2).toBe(0);
        const prose = parsed.content.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "");
        expect(prose).not.toMatch(/<\/?[a-z][^>]*>/i);
      });
    });
  }

  it("uses sort 1..3 and unique slugs", () => {
    const fms = lessonFiles.map((f) => lessonFrontmatterSchema.parse(matter(readFileSync(path.join(lessonDir, f), "utf8")).data));
    expect(fms.map((f) => f.sort)).toEqual([1, 2, 3]);
    expect(new Set(fms.map((f) => f.slug)).size).toBe(3);
    expect(fms.map((f) => f.exercise)).toEqual(expectedExercises);
  });
});

describe("level 2 exercises", () => {
  for (const slug of expectedExercises) {
    describe(slug, () => {
      const dir = path.join(root, "exercises", slug);

      it("has the required files and folders", () => {
        for (const p of ["README.md", "CHECKLIST.md", "exercise.json", "starter/package.json", "solution/package.json"]) {
          expect(existsSync(path.join(dir, p)), p).toBe(true);
        }
      });

      it("exercise.json matches the contract and slug", () => {
        const json = exerciseJsonSchema.parse(JSON.parse(readFileSync(path.join(dir, "exercise.json"), "utf8")));
        expect(json.slug).toBe(slug);
        expect(json.verify).not.toBe("manual");
        expect(json.starter_prompts?.claude).toBeTruthy();
        expect(json.starter_prompts?.codex).toBeTruthy();
        expect(json.solution_notes?.length).toBeGreaterThanOrEqual(2);
      });

      it("CHECKLIST.md has unique explicit ids", () => {
        const items = readFileSync(path.join(dir, "CHECKLIST.md"), "utf8")
          .split("\n")
          .filter((l) => l.trim())
          .map((l) => {
            const m = /^- \[ \] ([a-z0-9_-]{1,64}): (.+)$/.exec(l);
            expect(m, l).not.toBeNull();
            return checklistItemSchema.parse({ id: m![1], text: m![2] });
          });
        expect(items.length).toBeGreaterThanOrEqual(5);
        expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
      });
    });
  }
});
