// @vitest-environment node
// The output formats W3's share CLI (scripts/workflows/share.ts) parses from the subprocess calls. Do not change them
// without telling W3: `workflows:validate` prints `<path>: <field>: <reason>`, `workflows:scan` prints `<line>: <rule-id>`.
import { execFile } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { FM_NOW, REPO_ROOT, VALID, contentSandbox, readFixture } from "./helpers";

const run = promisify(execFile);
const tsx = path.join(REPO_ROOT, "node_modules/.bin/tsx");

async function cli(script: "validate" | "scan", args: string[], contentDir: string) {
  const env = { ...process.env, CONTENT_DIR: contentDir, FM_NOW: FM_NOW.toISOString() };
  try {
    const r = await run(tsx, [`scripts/workflows/${script}.ts`, ...args], { cwd: REPO_ROOT, env });
    return { code: 0, out: `${r.stdout}\n${r.stderr}` };
  } catch (e) {
    const err = e as { code: number; stdout: string; stderr: string };
    return { code: err.code, out: `${err.stdout}\n${err.stderr}` };
  }
}
const lines = (s: string) => s.split("\n").filter(Boolean);

describe("CLI output contract with W3", () => {
  it("workflows:validate prints '<path>: <field>: <reason>' per problem and exits non-zero", async () => {
    const { contentDir } = contentSandbox({
      "client-safe-yes.md": readFixture("invalid", "client-safe-yes.md"),
      "two-sentence-problem.md": readFixture("invalid", "two-sentence-problem.md"),
    });
    const r = await cli("validate", [], contentDir);
    expect(r.code).toBe(1);
    const problems = lines(r.out).filter((l) => l.startsWith("content/workflows/"));
    expect(problems).toEqual([
      "content/workflows/client-safe-yes.md: client_safe: must be exactly `confirmed`",
      "content/workflows/two-sentence-problem.md: problem: must be one sentence",
    ]);
    for (const p of problems) expect(p).toMatch(/^\S+: [\w.]+: .+$/);
  }, 30_000);

  it("workflows:validate exits 0 and prints no problem lines for a valid file", async () => {
    const { contentDir } = contentSandbox({ "good-one.md": VALID });
    const r = await cli("validate", [], contentDir);
    expect(r.code).toBe(0);
    expect(lines(r.out).filter((l) => l.startsWith("content/workflows/"))).toEqual([]);
  }, 30_000);

  it("workflows:scan -- <file> prints '<line>: <rule-id>' per finding and exits non-zero", async () => {
    const { workflowsDir, contentDir } = contentSandbox();
    const file = path.join(workflowsDir, "draft.md");
    writeFileSync(file, "clean line\ncall jane@acme-corp.io\nand 10.1.2.3\n");
    const r = await cli("scan", [file], contentDir);
    expect(r.code).toBe(1);
    expect(lines(r.out).filter((l) => /^\d+: \S+$/.test(l))).toEqual(["2: email", "3: ipv4"]);
  }, 30_000);

  it("workflows:scan exits 0 on a clean file", async () => {
    const { workflowsDir, contentDir } = contentSandbox({ "good-one.md": VALID });
    const r = await cli("scan", [path.join(workflowsDir, "good-one.md")], contentDir);
    expect(r.code).toBe(0);
    expect(lines(r.out).filter((l) => /^\d+: /.test(l))).toEqual([]);
  }, 30_000);

  it("workflows:scan with several files keeps every finding line in the '<line>: <rule-id>' shape", async () => {
    const { workflowsDir, contentDir } = contentSandbox();
    writeFileSync(path.join(workflowsDir, "a.md"), "x\n10.9.9.9\n");
    writeFileSync(path.join(workflowsDir, "b.md"), "bob@acme.io\n");
    const r = await cli("scan", [path.join(workflowsDir, "a.md"), path.join(workflowsDir, "b.md")], contentDir);
    expect(r.code).toBe(1);
    expect(lines(r.out).filter((l) => /^\d+: \S+$/.test(l))).toEqual(["2: ipv4", "1: email"]);
  }, 30_000);
});
