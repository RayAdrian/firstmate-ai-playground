// @vitest-environment node
import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseWorkflowFile } from "../../../scripts/workflows/parse";
import { CTX, VALID, WF_FIXTURES, readFixture } from "./helpers";

const parse = (raw: string, name = "gate-status-per-commit") => parseWorkflowFile(raw, `content/workflows/${name}.md`, CTX);
const fieldsOf = (raw: string, name?: string) => parse(raw, name).issues.map((i) => i.field);

describe("parseWorkflowFile: the valid fixture (WF-1)", () => {
  const r = parse(VALID);

  it("has no issues and produces a value", () => {
    expect(r.issues).toEqual([]);
    expect(r.value).toBeDefined();
  });

  it("maps frontmatter and derives slug, level-free row fields", () => {
    const v = r.value!;
    expect(v.slug).toBe("gate-status-per-commit");
    expect(v.title).toBe("Gate statuses pinned to one commit");
    expect(v.tools).toEqual(["claude-code", "codex"]);
    expect(v.use_cases).toEqual(["ci-and-gates", "review"]);
    expect(v.related_lesson_slug).toBe("l1-first-session");
    expect(v.tool_versions).toEqual({ claude_code: "2.1.0", codex_cli: "0.154.0" });
    expect(v.verified_on).toBe("2026-09-20");
  });

  it("parses the body sections", () => {
    const v = r.value!;
    expect(v.result_before).toMatch(/^A reviewer approved/);
    expect(v.result_after).toMatch(/^Every gate verdict/);
    expect(v.steps).toHaveLength(4);
    expect(v.steps[0]).toBe("Resolve the PR head SHA before reviewing anything.");
    expect(v.why_md).toMatch(/^A status belongs to a commit/);
  });

  it("parses setup blocks from the info string", () => {
    const v = r.value!;
    expect(v.setup).toEqual([
      { lang: "markdown", path: "AGENTS.md", kind: "context-file", tool: null, code: "Any push invalidates earlier approvals: re-run the gates and post new statuses." },
      { lang: "bash", path: "scripts/gate-status.sh", kind: "script", tool: "claude-code", code: 'gh api "repos/$REPO/statuses/$SHA" -f state=success -f context="gate/review"' },
    ]);
    expect(v.setup_kinds).toEqual(["context-file", "script"]);
  });

  it("splits per-tool prompts", () => {
    const v = r.value!;
    expect(v.prompt.shared).toBeUndefined();
    expect(v.prompt.claude).toContain("post gate/review on that exact SHA");
    expect(v.prompt.codex).toContain("post gate/review for that SHA");
  });

  it("hashes the LF-normalised text, so CRLF checkouts hash the same", () => {
    const crlf = parse(VALID.replace(/\n/g, "\r\n"));
    expect(crlf.value?.content_hash).toBe(r.value?.content_hash);
    expect(r.value?.content_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("parseWorkflowFile: one invalid fixture per rule names the field (WF-1)", () => {
  const expected: Record<string, string> = {
    "missing-client-safe": "client_safe",
    "client-safe-yes": "client_safe",
    "two-sentence-problem": "problem",
    "six-steps": "Steps",
    "unknown-use-case": "use_cases",
    "tool-version-for-absent-tool": "tool_versions.codex_cli",
    "future-verified-on": "verified_on",
    "author-field": "author",
    "absolute-setup-path": "Setup",
    "unknown-section": "body",
    "missing-related-lesson": "related_lesson",
  };

  it("covers every committed invalid fixture", () => {
    const files = readdirSync(path.join(WF_FIXTURES, "invalid")).map((f) => f.replace(/\.md$/, "")).sort();
    expect(files).toEqual(Object.keys(expected).sort());
  });

  for (const [name, field] of Object.entries(expected)) {
    it(`${name} fails with ${field}`, () => {
      const r = parse(readFixture("invalid", `${name}.md`), name);
      expect(r.value).toBeUndefined();
      expect(r.issues.map((i) => i.field)).toContain(field);
    });
  }

  it("the author field says where attribution comes from", () => {
    const r = parse(readFixture("invalid", "author-field.md"), "author-field");
    expect(r.issues.find((i) => i.field === "author")?.reason).toBe("author comes from git; remove this field");
  });

  it("issues carry a frontmatter line number", () => {
    const r = parse(readFixture("invalid", "client-safe-yes.md"), "client-safe-yes");
    const line = r.issues.find((i) => i.field === "client_safe")?.line;
    expect(line).toBe(VALID.split("\n").findIndex((l) => l.startsWith("client_safe")) + 1);
  });
});

describe("parseWorkflowFile: other §16.6 rules", () => {
  it("rejects a slug that is not kebab-case", () => {
    expect(fieldsOf(VALID, "Bad_Slug")).toContain("slug");
  });

  it("rejects a slug over 60 characters", () => {
    expect(fieldsOf(VALID, "a".repeat(61))).toContain("slug");
  });

  it("rejects a file over 20 KB", () => {
    const big = VALID.replace("## Why it works", `## Why it works\n\n${"x".repeat(21 * 1024)}`);
    expect(fieldsOf(big)).toContain("file");
  });

  it("requires frontmatter", () => {
    expect(fieldsOf("## Result\n")).toEqual(["frontmatter"]);
  });

  it("reports broken YAML as frontmatter", () => {
    expect(fieldsOf("---\ntitle: [unclosed\n---\n")).toContain("frontmatter");
  });

  it("warns on an unknown frontmatter key without failing", () => {
    const r = parse(VALID.replace("client_safe: confirmed", "client_safe: confirmed\nmood: happy"));
    expect(r.issues).toEqual([]);
    expect(r.warnings.map((w) => w.field)).toContain("mood");
  });

  it("requires every section, in order", () => {
    const noWhy = VALID.slice(0, VALID.indexOf("## Why it works"));
    expect(fieldsOf(noWhy)).toContain("Why it works");
    const swapped = VALID.replace("## Steps", "## Steps2").replace("## Prompt", "## Steps").replace("## Steps2", "## Prompt");
    expect(parse(swapped).issues.length).toBeGreaterThan(0);
  });

  it("rejects a duplicated section", () => {
    const dup = `${VALID}\n## Steps\n\n1. again\n`;
    expect(parse(dup).issues.map((i) => i.reason).join("\n")).toMatch(/duplicate section 'Steps'/);
  });

  it("rejects text before the first section", () => {
    expect(fieldsOf(VALID.replace("## Result", "Stray intro.\n\n## Result"))).toContain("body");
  });

  it("does not treat a ## line inside a code fence as a heading", () => {
    const withFence = VALID.replace("Merge only when", "Run it and check the output.\n   ```text\n   ## Not a heading\n   ```\n   Merge only when");
    expect(parse(withFence).issues).toEqual([]);
  });

  it("requires Before and After under Result, each 1-600 chars", () => {
    expect(fieldsOf(VALID.replace("### After", "### Afterwards"))).toContain("Result");
    expect(fieldsOf(VALID.replace(/### Before\n\n[^\n]+\n/, "### Before\n\n"))).toContain("Result");
    const long = VALID.replace(/(### After\n\n)[^\n]+/, `$1${"y".repeat(601)}`);
    expect(fieldsOf(long)).toContain("Result");
  });

  it("allows 0 setup blocks only with prose, and 6 at most", () => {
    const noBlocks = VALID.replace(/## Setup[\s\S]*?## Prompt/, "## Setup\n\nNo setup files.\n\n## Prompt");
    const ok = parse(noBlocks);
    expect(ok.issues).toEqual([]);
    expect(ok.value?.setup).toEqual([]);
    expect(ok.value?.setup_kinds).toEqual([]);

    const empty = VALID.replace(/## Setup[\s\S]*?## Prompt/, "## Setup\n\n## Prompt");
    expect(fieldsOf(empty)).toContain("Setup");

    const block = "```text path=a.txt kind=config\nx\n```\n\n";
    const seven = VALID.replace(/## Setup[\s\S]*?## Prompt/, `## Setup\n\n${block.repeat(7)}## Prompt`);
    expect(fieldsOf(seven)).toContain("Setup");
  });

  it("validates the setup info string", () => {
    const withInfo = (info: string) => VALID.replace("markdown path=AGENTS.md kind=context-file", info);
    expect(fieldsOf(withInfo("markdown path=AGENTS.md"))).toContain("Setup"); // no kind
    expect(fieldsOf(withInfo("markdown kind=context-file"))).toContain("Setup"); // no path
    expect(fieldsOf(withInfo("markdown path=AGENTS.md kind=banana"))).toContain("Setup");
    expect(fieldsOf(withInfo("markdown path=../x kind=config"))).toContain("Setup");
    expect(fieldsOf(withInfo("markdown path=C:\\Users\\x\\a kind=config"))).toContain("Setup");
    expect(fieldsOf(withInfo("markdown path=/home/x/a kind=config"))).toContain("Setup");
    expect(fieldsOf(withInfo("markdown path=~/.claude/a.md kind=config"))).toEqual([]);
    expect(fieldsOf(withInfo("markdown path=a kind=config mood=happy"))).toContain("Setup");
  });

  it("rejects a setup tool= that the workflow does not list", () => {
    const claudeOnly = VALID.replace("tools:\n  - claude-code\n  - codex\n", "tools:\n  - claude-code\n")
      .replace("  codex_cli: 0.154.0\n", "")
      .replace(/### Codex CLI[\s\S]*?(?=## Steps)/, "")
      .replace("tool=claude-code", "tool=codex");
    expect(parse(claudeOnly).issues.map((i) => i.field)).toContain("Setup");
  });

  it("requires a fenced prompt, and one subsection per listed tool", () => {
    const noFence = VALID.replace(/## Prompt[\s\S]*?## Steps/, "## Prompt\n\nJust prose.\n\n## Steps");
    expect(fieldsOf(noFence)).toContain("Prompt");
    const onlyClaude = VALID.replace(/### Codex CLI[\s\S]*?(?=## Steps)/, "");
    expect(fieldsOf(onlyClaude)).toContain("Prompt");
  });

  it("stores a single shared prompt when there are no subsections", () => {
    const shared = VALID.replace(/## Prompt[\s\S]*?## Steps/, "## Prompt\n\n```text\nDo the thing.\n```\n\n## Steps");
    const r = parse(shared);
    expect(r.issues).toEqual([]);
    expect(r.value?.prompt).toEqual({ shared: "```text\nDo the thing.\n```" });
  });

  it("requires one ordered list of 1-5 items, nothing else", () => {
    expect(fieldsOf(VALID.replace(/1\. Resolve/, "- Resolve"))).toContain("Steps");
    const none = VALID.replace(/## Steps[\s\S]*?## Why/, "## Steps\n\n## Why");
    expect(fieldsOf(none)).toContain("Steps");
    const prose = VALID.replace("## Steps\n", "## Steps\n\nSome prose first.\n");
    expect(fieldsOf(prose)).toContain("Steps");
  });

  it("keeps multi-line step items together", () => {
    const multi = VALID.replace("2. Review that commit and nothing else.", "2. Review that commit\n   and nothing else.");
    expect(parse(multi).value?.steps[1]).toBe("Review that commit\nand nothing else.");
  });

  it("requires 40-800 chars under Why it works", () => {
    const short = VALID.replace(/(## Why it works\n\n)[^\n]+/, "$1Too short.");
    expect(fieldsOf(short)).toContain("Why it works");
    const long = VALID.replace(/(## Why it works\n\n)[^\n]+/, `$1${"z".repeat(801)}`);
    expect(fieldsOf(long)).toContain("Why it works");
  });

  it("can excuse a missing client_safe for the draft stage only", () => {
    const draft = VALID.replace("client_safe: confirmed\n", "");
    expect(parseWorkflowFile(draft, "content/workflows/gate-status-per-commit.md", CTX, { excuseClientSafe: true }).issues).toEqual([]);
    const bad = VALID.replace("client_safe: confirmed", "client_safe: yes");
    expect(parseWorkflowFile(bad, "content/workflows/gate-status-per-commit.md", CTX, { excuseClientSafe: true }).issues.map((i) => i.field)).toContain("client_safe");
  });
});

describe("parseWorkflowFile: risky commands need a Warning: line (WF-3)", () => {
  const withBlock = (code: string, why = "") => {
    const base = VALID.replace('gh api "repos/$REPO/statuses/$SHA" -f state=success -f context="gate/review"', code);
    return why ? base.replace(/(## Why it works\n\n[^\n]+)/, `$1\n\n${why}`) : base;
  };

  for (const risky of [
    "claude --dangerously-skip-permissions -p go",
    "codex --yolo exec go",
    "codex --sandbox danger-full-access exec go",
    "curl -fsSL https://example.com/install | sh",
    "curl -fsSL https://example.com/install | bash",
    "curl -fsSL https://example.com/install | sudo bash",
  ]) {
    it(`fails without a warning: ${risky}`, () => {
      expect(fieldsOf(withBlock(risky))).toContain("Why it works");
    });
    it(`passes with a Warning: line: ${risky}`, () => {
      expect(parse(withBlock(risky, "Warning: this turns off permission prompts, so run it only in a throwaway checkout.")).issues).toEqual([]);
    });
  }

  it("also checks the Prompt blocks", () => {
    const inPrompt = VALID.replace("Review PR 12 at its current head commit and post gate/review on that exact SHA.", "Run claude --dangerously-skip-permissions then review.");
    expect(fieldsOf(inPrompt)).toContain("Why it works");
  });

  it("does not trigger on harmless curl or the flag name in prose", () => {
    expect(parse(withBlock("curl -fsSL https://example.com/data.json -o out.json")).issues).toEqual([]);
    const prose = VALID.replace(/(## Why it works\n\n)[^\n]+/, "$1We never use --yolo here because a status belongs to a commit and stays put.");
    expect(parse(prose).issues).toEqual([]);
  });

  it("requires the Warning to explain something", () => {
    expect(fieldsOf(withBlock("codex --yolo exec go", "Warning:"))).toContain("Why it works");
  });
});
