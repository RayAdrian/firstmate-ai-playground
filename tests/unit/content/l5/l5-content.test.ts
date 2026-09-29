// @vitest-environment node
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { describe, expect, it } from "vitest";
import { exerciseJsonSchema, checklistItemSchema } from "@/lib/contracts/exercise";
import { lessonFrontmatterSchema } from "@/lib/contracts/lesson";

const root = path.resolve(__dirname, "../../../..");
const lessonDir = path.join(root, "content/lessons/l5");
const exercisesDir = path.join(root, "exercises");

const EXPECTED_LESSONS = [
  { file: "01-model-routing.md", slug: "l5-model-routing", exercise: "ex-5-1-routing" },
  { file: "02-multi-agent-teams.md", slug: "l5-multi-agent-teams", exercise: "ex-5-2-team" },
  { file: "03-gated-merge-pipelines.md", slug: "l5-gated-merge-pipelines", exercise: "ex-5-3-gates" },
  { file: "04-capstone-ship-like-first-mate.md", slug: "l5-capstone", exercise: "ex-5-4-capstone" },
];

/** Remove fenced code blocks so headings inside examples are not counted. */
const stripFences = (md: string) => md.replace(/^```[\s\S]*?^```/gm, "");

describe("L5 lessons", () => {
  it("has exactly the four lessons from PRD section 7", () => {
    expect(readdirSync(lessonDir).sort()).toEqual(EXPECTED_LESSONS.map((l) => l.file));
  });

  for (const expected of EXPECTED_LESSONS) {
    describe(expected.file, () => {
      const raw = readFileSync(path.join(lessonDir, expected.file), "utf8");
      const parsed = matter(raw);

      it("frontmatter matches the lesson contract", () => {
        const result = lessonFrontmatterSchema.safeParse(parsed.data);
        expect(result.success, result.success ? "" : JSON.stringify(result.error.issues, null, 2)).toBe(true);
      });

      it("has the expected slug, level, sort and exercise", () => {
        const fm = lessonFrontmatterSchema.parse(parsed.data);
        expect(fm.slug).toBe(expected.slug);
        expect(fm.level).toBe(5);
        expect(fm.sort).toBe(EXPECTED_LESSONS.indexOf(expected) + 1);
        expect(fm.exercise).toBe(expected.exercise);
        expect(existsSync(path.join(exercisesDir, fm.exercise, "exercise.json"))).toBe(true);
      });

      it("records the verified tool versions and a date that is not in the future", () => {
        const fm = lessonFrontmatterSchema.parse(parsed.data);
        expect(fm.tool_versions).toEqual({ claude_code: "2.1.284", codex_cli: "0.154.0" });
        // Verified dates are Manila dates, which can be a day ahead of UTC.
        const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
        expect(fm.last_verified_on <= tomorrow).toBe(true);
      });

      it("has both tool sections and no other top-level sections", () => {
        const headings = stripFences(parsed.content)
          .split("\n")
          .filter((l) => /^## /.test(l))
          .map((l) => l.trim());
        expect(headings).toEqual(["## Concept", "## Claude Code", "## Codex CLI"]);
      });

      it("has non-trivial content in every section", () => {
        // Split on level-2 headings that are not inside a code fence.
        const sections: string[] = [];
        let inFence = false;
        for (const line of parsed.content.split("\n")) {
          if (line.startsWith("```")) inFence = !inFence;
          if (!inFence && line.startsWith("## ")) sections.push("");
          if (sections.length > 0) sections[sections.length - 1] += `${line}\n`;
        }
        expect(sections).toHaveLength(3);
        for (const s of sections) expect(s.trim().length).toBeGreaterThan(400);
      });

      it("ends the concept with a First Mate tip", () => {
        const concept = parsed.content.split(/^## Claude Code$/m)[0];
        expect(concept).toMatch(/^### First Mate tip$/m);
      });

      it("uses no raw HTML tags outside code fences", () => {
        const text = stripFences(parsed.content).replace(/`[^`]*`/g, "");
        expect(text).not.toMatch(/<\/?[a-z][a-z0-9-]*[\s>]/i);
      });

      it("has no emoji", () => {
        expect(raw).not.toMatch(/\p{Extended_Pictographic}/u);
      });
    });
  }

  it("uses unique slugs and sort values", () => {
    const fms = EXPECTED_LESSONS.map((l) =>
      lessonFrontmatterSchema.parse(matter(readFileSync(path.join(lessonDir, l.file), "utf8")).data),
    );
    expect(new Set(fms.map((f) => f.slug)).size).toBe(fms.length);
    expect(new Set(fms.map((f) => f.sort)).size).toBe(fms.length);
  });
});

describe("L5 exercises", () => {
  const dirs = readdirSync(exercisesDir).filter(
    (d) => d.startsWith("ex-5-") && statSync(path.join(exercisesDir, d)).isDirectory(),
  );

  it("has exactly the four exercises from PRD section 7", () => {
    expect(dirs.sort()).toEqual(["ex-5-1-routing", "ex-5-2-team", "ex-5-3-gates", "ex-5-4-capstone"]);
  });

  for (const dir of ["ex-5-1-routing", "ex-5-2-team", "ex-5-3-gates", "ex-5-4-capstone"]) {
    describe(dir, () => {
      const base = path.join(exercisesDir, dir);
      const json = JSON.parse(readFileSync(path.join(base, "exercise.json"), "utf8"));

      it("has every required file", () => {
        for (const p of ["README.md", "CHECKLIST.md", "exercise.json", "starter/package.json", "solution/package.json"]) {
          expect(existsSync(path.join(base, p)), p).toBe(true);
        }
      });

      it("exercise.json matches the contract and the folder name", () => {
        const result = exerciseJsonSchema.safeParse(json);
        expect(result.success, result.success ? "" : JSON.stringify(result.error.issues, null, 2)).toBe(true);
        expect(json.slug).toBe(dir);
        expect(json.title).toBeTruthy();
        expect(json.goal).toBeTruthy();
        expect(json.starter_prompts?.claude).toBeTruthy();
        expect(json.starter_prompts?.codex).toBeTruthy();
        expect(json.solution_notes.length).toBeGreaterThanOrEqual(2);
        expect(json.setup_cmd).toContain(`exercises/${dir}/starter`);
      });

      it("has a checklist with unique, stable ids", () => {
        const lines = readFileSync(path.join(base, "CHECKLIST.md"), "utf8")
          .split("\n")
          .filter((l) => l.trim() !== "");
        expect(lines.length).toBeGreaterThanOrEqual(5);
        const ids = new Set<string>();
        for (const line of lines) {
          const m = /^- \[ \] ([a-z0-9_-]{1,64}): (.+)$/.exec(line);
          expect(m, `bad checklist line: ${line}`).not.toBeNull();
          const item = checklistItemSchema.parse({ id: m![1], text: m![2] });
          expect(ids.has(item.id)).toBe(false);
          ids.add(item.id);
        }
      });

      it("needs no API key", () => {
        const scan = (dirPath: string): string[] =>
          readdirSync(dirPath, { withFileTypes: true }).flatMap((e) => {
            if (e.name === "node_modules") return [];
            const p = path.join(dirPath, e.name);
            return e.isDirectory() ? scan(p) : [p];
          });
        for (const file of scan(base)) {
          const text = readFileSync(file, "utf8");
          expect(text, file).not.toMatch(/process\.env\.[A-Z_]*API_KEY/);
          expect(text, file).not.toMatch(/^[A-Z_]*API_KEY=/m);
        }
      });

      if (json.verify === "manual") {
        it("is manual, so the checklist carries the weight", () => {
          expect(dir).toBe("ex-5-4-capstone");
          expect(readFileSync(path.join(base, "README.md"), "utf8")).toMatch(/Manual/);
        });
      } else {
        const run = (which: "starter" | "solution") =>
          spawnSync("sh", ["-c", json.verify], { cwd: path.join(base, which), encoding: "utf8", timeout: 60_000 });

        it("verify passes on solution/", () => {
          const r = run("solution");
          expect(r.status, r.stdout + r.stderr).toBe(0);
        });

        it("verify fails on starter/", () => {
          const r = run("starter");
          expect(r.status, "starter must fail verify").not.toBe(0);
        });
      }
    });
  }
});
