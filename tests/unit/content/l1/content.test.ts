// @vitest-environment node
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import matter from "gray-matter";
import { describe, expect, it } from "vitest";
import { exerciseJsonSchema, lessonFrontmatterSchema } from "@/lib/contracts";

const ROOT = process.cwd();
const LESSON_DIR = path.join(ROOT, "content/lessons/l1");
const EXPECTED = [
  { file: "01-first-session.md", slug: "l1-first-session", sort: 1, exercise: "ex-1-1-failing-test" },
  { file: "02-prompting-for-code.md", slug: "l1-prompting-for-code", sort: 2, exercise: "ex-1-2-vague-vs-precise" },
  { file: "03-permissions-sandboxing-undo.md", slug: "l1-permissions", sort: 3, exercise: "ex-1-3-safe-config" },
];

/** Split a lesson body into `## ` sections, ignoring headings inside fenced code blocks. */
function sections(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  let current: string | null = null;
  let inFence = false;
  for (const line of body.split("\n")) {
    if (/^```/.test(line)) inFence = !inFence;
    const h = !inFence ? /^## (.+)$/.exec(line) : null;
    if (h) {
      current = h[1].trim();
      out[current] = "";
    } else if (current) {
      out[current] += `${line}\n`;
    }
  }
  return out;
}

describe("level 1 lessons", () => {
  it("has exactly the three lessons from PRD section 7", () => {
    expect(readdirSync(LESSON_DIR).sort()).toEqual(EXPECTED.map((e) => e.file).sort());
  });

  for (const e of EXPECTED) {
    describe(e.file, () => {
      const parsed = matter(readFileSync(path.join(LESSON_DIR, e.file), "utf8"));

      it("frontmatter matches the lesson contract", () => {
        const fm = lessonFrontmatterSchema.parse(parsed.data);
        expect(fm.slug).toBe(e.slug);
        expect(fm.level).toBe(1);
        expect(fm.sort).toBe(e.sort);
        expect(fm.exercise).toBe(e.exercise);
        expect(fm.tool_versions).toEqual({ claude_code: "2.1.284", codex_cli: "0.154.0" });
      });

      it("has exactly the Concept, Claude Code and Codex CLI sections, all non-empty", () => {
        const s = sections(parsed.content);
        expect(Object.keys(s)).toEqual(["Concept", "Claude Code", "Codex CLI"]);
        for (const body of Object.values(s)) expect(body.trim().length).toBeGreaterThan(200);
      });

      it("has a First Mate tip in the concept section", () => {
        expect(sections(parsed.content)["Concept"]).toContain("### First Mate tip");
      });

      it("keeps code fences balanced", () => {
        const fences = parsed.content.split("\n").filter((l) => /^```/.test(l));
        expect(fences.length % 2).toBe(0);
      });

      it("has an exercise directory that exists", () => {
        expect(existsSync(path.join(ROOT, "exercises", e.exercise, "exercise.json"))).toBe(true);
      });
    });
  }
});

describe("ex-1-3 config checker", () => {
  const solution = path.join(ROOT, "exercises/ex-1-3-safe-config/solution");
  const runWithToml = (toml: string) => {
    const tmp = mkdtempSync(path.join(tmpdir(), "ex13-"));
    cpSync(solution, tmp, { recursive: true });
    writeFileSync(path.join(tmp, ".codex/config.toml"), toml);
    return spawnSync("node scripts/check-config.mjs", { cwd: tmp, shell: true, encoding: "utf8" });
  };
  const base = 'sandbox_mode = "workspace-write"\napproval_policy = "on-request"\nweb_search = "disabled"\n';

  it("accepts the safe config", () => {
    expect(runWithToml(base).status).toBe(0);
  });

  it("detects network enabled via the table form", () => {
    expect(runWithToml(`${base}[sandbox_workspace_write]\nnetwork_access = true\n`).status).toBe(1);
  });

  it("detects network enabled via the dotted form the lesson teaches", () => {
    const r = runWithToml(`${base}sandbox_workspace_write.network_access = true\n`);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("network_access");
  });
});

describe("level 1 exercises", () => {
  for (const e of EXPECTED) {
    describe(e.exercise, () => {
      const dir = path.join(ROOT, "exercises", e.exercise);

      it("has the required files", () => {
        for (const f of ["README.md", "CHECKLIST.md", "exercise.json", "starter/package.json", "solution/package.json"]) {
          expect(existsSync(path.join(dir, f)), f).toBe(true);
        }
      });

      const json = exerciseJsonSchema.parse(JSON.parse(readFileSync(path.join(dir, "exercise.json"), "utf8")));

      it("exercise.json matches the contract and has prompts for both tools", () => {
        expect(json.slug).toBe(e.exercise);
        expect(json.starter_prompts?.claude).toBeTruthy();
        expect(json.starter_prompts?.codex).toBeTruthy();
        expect(json.solution_notes?.length).toBeGreaterThanOrEqual(2);
        expect(json.solution_notes?.length).toBeLessThanOrEqual(5);
      });

      it("CHECKLIST.md items have unique, explicit ids", () => {
        const lines = readFileSync(path.join(dir, "CHECKLIST.md"), "utf8")
          .split("\n")
          .filter((l) => l.trim());
        const ids = lines.map((l) => {
          const m = /^- \[ \] ([a-z0-9_-]{1,64}): \S.*$/.exec(l);
          expect(m, `bad checklist line: ${l}`).not.toBeNull();
          return m![1];
        });
        expect(ids.length).toBeGreaterThanOrEqual(3);
        expect(new Set(ids).size).toBe(ids.length);
      });

      if (json.verify !== "manual") {
        const run = (which: "starter" | "solution") =>
          spawnSync(json.verify, { cwd: path.join(dir, which), shell: true, encoding: "utf8" });

        it("verify command fails on starter/", () => {
          const r = run("starter");
          expect(r.status).not.toBe(0);
          if (e.exercise === "ex-1-1-failing-test") {
            // Fails for the right reason: exactly one assertion fails, the other three pass.
            expect(r.stdout).toMatch(/ℹ pass 3/);
            expect(r.stdout).toMatch(/ℹ fail 1/);
          }
        });

        it("verify command passes on solution/", () => {
          const r = run("solution");
          expect(r.status, `${r.stdout}\n${r.stderr}`).toBe(0);
        });
      }
    });
  }
});
