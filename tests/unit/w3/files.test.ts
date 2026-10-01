// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";
import { REPO_URL, WORKFLOW_OUTDATED_ISSUE_TEMPLATE, buildWorkflowFrontmatterSchema } from "../../../src/lib/contracts/workflow";

const root = path.resolve(__dirname, "../../..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

describe("skill files (WF-10, WF-14)", () => {
  it("the Codex copy is byte-identical to the Claude Code skill", () => {
    const a = fs.readFileSync(path.join(root, ".claude/skills/share-workflow/SKILL.md"));
    const b = fs.readFileSync(path.join(root, ".agents/skills/share-workflow/SKILL.md"));
    expect(a.equals(b)).toBe(true);
    expect(fs.lstatSync(path.join(root, ".agents/skills/share-workflow/SKILL.md")).isSymbolicLink()).toBe(false);
  });
  it("has name and description frontmatter and drives only the CLI", () => {
    const { data, content } = matter(read(".claude/skills/share-workflow/SKILL.md"));
    expect(data.name).toBe("share-workflow");
    expect(String(data.description).length).toBeGreaterThan(40);
    for (const cmd of ["preflight", "read", "draft --answers", "confirm", "open-pr"]) expect(content).toContain(`workflows:share -- ${cmd}`);
    expect(content).toMatch(/exactly three questions/i);
    expect(content).toContain("client-safe");
    expect(content).toContain("workspace-write");
  });
});

describe("_TEMPLATE.md (WF-15)", () => {
  const { data, content } = matter(read("content/workflows/_TEMPLATE.md"));
  it("fails validation only on its placeholder values", () => {
    const schema = buildWorkflowFrontmatterSchema({ useCases: ["testing"], stacks: ["any"], today: "2026-10-01" });
    const names = (v: unknown) => {
      const r = schema.safeParse(v);
      return new Set(r.success ? [] : r.error.issues.map((i) => String(i.path[0])));
    };
    const base = { ...data, verified_on: String(data.verified_on) };
    expect(names(base)).toEqual(new Set(["verified_on", "client_safe"]));
    // With those two filled in, the remaining placeholders are the taxonomy values.
    expect(names({ ...base, verified_on: "2026-10-01", client_safe: "confirmed" })).toEqual(new Set(["use_cases", "stacks"]));
  });
  it("has the five sections in order and no others", () => {
    expect(content.split("\n").filter((l) => /^## /.test(l))).toEqual(["## Result", "## Setup", "## Prompt", "## Steps", "## Why it works"]);
  });
  it("_takedowns.txt exists and is empty", () => {
    expect(read("content/workflows/_takedowns.txt")).toBe("");
  });
});

describe(".github files and docs (WF-21, WF-23, WF-37)", () => {
  it("PR template: callout above the checklist, confidentiality box first, no gate section", () => {
    const t = read(".github/PULL_REQUEST_TEMPLATE/workflow.md");
    const callout = "Human review at merge is the only check for client names, client code, internal URLs and people. CI checks secrets and format, nothing else.";
    expect(t).toContain(callout);
    expect(t.indexOf(callout)).toBeLessThan(t.indexOf("- [ ]"));
    const merger = t.slice(t.indexOf("## Merger review"));
    expect(merger).toMatch(/- \[ \] \*\*1\. Client-safe/);
    expect(merger.indexOf("1. Client-safe")).toBeLessThan(merger.indexOf("2. Real"));
    expect(t).not.toMatch(/gate\/|gate:.*-green/);
    for (const item of ["client or prospect names", "client code", "internal URLs", "secrets or tokens", "people outside First Mate"]) expect(t).toContain(item);
  });
  it("issue form has workflow, what-broke (required) and optional versions fields", () => {
    const y = parseYaml(read(`.github/ISSUE_TEMPLATE/${WORKFLOW_OUTDATED_ISSUE_TEMPLATE}`));
    const byId = Object.fromEntries(y.body.map((b: { id: string }) => [b.id, b]));
    expect(byId.workflow.validations.required).toBe(true);
    expect(byId["what-broke"].validations.required).toBe(true);
    expect(byId.versions.validations.required).toBe(false);
    expect(y.labels).toContain("workflow-outdated");
  });
  it("CODEOWNERS: owner active, placeholder stewards commented out", () => {
    const lines = read(".github/CODEOWNERS").split("\n");
    const active = lines.filter((l) => l.trim() && !l.trim().startsWith("#"));
    expect(active).toContain("/.github/ @RayAdrian");
    expect(active.some((l) => l.startsWith("/content/workflows/ @RayAdrian"))).toBe(true);
    expect(active.join("\n")).not.toContain("fm-steward");
    expect(lines.join("\n")).toContain("# /content/workflows/ @RayAdrian @fm-steward-1");
  });
  it("CONTRIBUTING has the anchor the Share button links to, with the callout and the 6-step path", () => {
    const c = read("CONTRIBUTING.md");
    expect(c).toMatch(/^## Share a workflow$/m); // GitHub anchor: #share-a-workflow
    expect(`${REPO_URL}/blob/main/CONTRIBUTING.md#share-a-workflow`).toContain("#share-a-workflow");
    expect(c).toContain("Human review at merge is the only check for client names, client code, internal URLs and people. CI checks secrets and format, nothing else.");
    for (const s of ["_TEMPLATE.md", "npm run workflows:validate", "npm run workflows:scan", "client_safe: confirmed", "workflow/<slug>", "gh pr create --template workflow.md --label workflow"]) {
      expect(c).toContain(s);
    }
  });
  it("takedown runbook has the seven steps", () => {
    const r = read("docs/runbooks/workflow-takedown.md");
    for (const h of ["## 1. Contain", "## 2. Rewrite history", "## 3. Purge GitHub's copies", "## 4. Purge local copies", "## 5. Notify", "## 6. Prevent", "## 7. Record"]) expect(r).toContain(h);
    expect(r).toContain("_takedowns.txt");
  });
});
