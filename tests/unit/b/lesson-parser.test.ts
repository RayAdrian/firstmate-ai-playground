import { describe, expect, it } from "vitest";
import { parseLessonFile, parseSections } from "../../../scripts/seed/lib/lesson";

const FM_NOW = new Date("2026-09-30T13:00:00+08:00");

function frontmatter(over: Record<string, string> = {}): string {
  const base: Record<string, string> = {
    slug: "l1-demo",
    level: "1",
    sort: "1",
    title: "Demo",
    objective: "Learn the demo.",
    est_minutes: "20",
    tool_versions: '\n  claude_code: "2.1.0"\n  codex_cli: "0.40.0"',
    last_verified_on: "2026-09-20",
    differences: "\n  - one",
    exercise: "ex-demo",
    ...over,
  };
  return Object.entries(base)
    .filter(([, v]) => v !== "__omit__")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

const BODY = "## Concept\n\nC\n\n## Claude Code\n\nCC\n\n## Codex CLI\n\nCX\n";

function lesson(fm: Record<string, string> = {}, body = BODY, folder = "l1") {
  return parseLessonFile(`---\n${frontmatter(fm)}\n---\n\n${body}`, `content/lessons/${folder}/01-demo.md`, {
    now: FM_NOW,
  });
}

describe("parseSections (TC-B-03)", () => {
  it("maps sections by heading text, not position", () => {
    const { sections, issues } = parseSections("## Codex CLI\nX\n\n## Concept\nC\n\n## Claude Code\nY\n", 1);
    expect(issues).toEqual([]);
    expect(sections).toMatchObject({ codex: "X", concept: "C", claude: "Y" });
  });

  it("keeps ### subheadings and ignores ## lines inside fenced blocks", () => {
    const body = "## Concept\nC\n\n## Claude Code\n### Claude Code tips\n\n```md\n## Codex CLI\n```\n\n## Codex CLI\nX\n";
    const { sections, issues } = parseSections(body, 1);
    expect(issues).toEqual([]);
    expect(sections.claude).toContain("### Claude Code tips");
    expect(sections.claude).toContain("## Codex CLI");
    expect(sections.codex).toBe("X");
  });

  it("rejects unknown sections instead of dropping text", () => {
    const { issues } = parseSections("## Concept\nC\n\n## Notes\nN\n", 1);
    expect(issues[0]?.reason).toMatch(/unknown section 'Notes'/);
    expect(issues[0]?.line).toBe(4);
  });

  it("rejects duplicate sections", () => {
    const { issues } = parseSections("## Concept\nC\n\n## Concept\nD\n", 1);
    expect(issues[0]?.reason).toMatch(/duplicate section 'Concept'/);
  });
});

describe("parseLessonFile", () => {
  it("parses a valid lesson", () => {
    const { value, issues } = lesson();
    expect(issues).toEqual([]);
    expect(value).toMatchObject({
      slug: "l1-demo",
      levelNumber: 1,
      concept_md: "C",
      claude_md: "CC",
      codex_md: "CX",
      claude_no_equivalent: false,
      codex_no_equivalent: false,
      claude_workaround_md: null,
      codex_workaround_md: null,
      last_verified_on: "2026-09-20",
      exerciseSlug: "ex-demo",
    });
    expect(value?.content_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("allows a lesson without an exercise", () => {
    const { value, issues } = lesson({ exercise: "__omit__" });
    expect(issues).toEqual([]);
    expect(value?.exerciseSlug).toBeNull();
  });

  it("requires frontmatter", () => {
    const { issues } = parseLessonFile("## Concept\nx", "content/lessons/l1/a.md", { now: FM_NOW });
    expect(issues[0]).toMatchObject({ file: "content/lessons/l1/a.md", line: 1, field: "frontmatter" });
  });

  it("reports file, line, field and reason for a bad field (TC-B-07)", () => {
    const { issues } = lesson({ est_minutes: '"twenty"' });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ file: "content/lessons/l1/01-demo.md", field: "est_minutes" });
    expect(issues[0]?.line).toBe(7);
    expect(issues[0]?.reason).toMatch(/expected number/i);
  });

  it("reports a missing required field (TC-B-08)", () => {
    const { issues } = lesson({ objective: "__omit__" });
    expect(issues.map((i) => i.field)).toContain("objective");
  });

  it("flags folder / frontmatter level disagreement (TC-B-02)", () => {
    const { issues } = lesson({}, BODY, "l2");
    expect(issues[0]).toMatchObject({ field: "level" });
    expect(issues[0]?.reason).toMatch(/folder .*l2.* frontmatter/i);
  });

  it("differences bounds (TC-B-09)", () => {
    const items = (n: number) => "\n" + Array.from({ length: n }, (_, i) => `  - d${i}`).join("\n");
    expect(lesson({ differences: "[]" }).issues[0]?.field).toBe("differences");
    expect(lesson({ differences: items(1) }).issues).toEqual([]);
    expect(lesson({ differences: items(5) }).issues).toEqual([]);
    expect(lesson({ differences: items(6) }).issues[0]?.field).toBe("differences");
    expect(lesson({ differences: '\n  - ""\n  - ok' }).issues[0]?.field).toBe("differences.0");
    expect(lesson({ differences: '"not an array"' }).issues[0]?.field).toBe("differences");
  });

  it("est_minutes boundaries (TC-B-10)", () => {
    expect(lesson({ est_minutes: "1" }).issues).toEqual([]);
    for (const bad of ["0", "-5", "12.5", '"20"']) {
      expect(lesson({ est_minutes: bad }).issues[0]?.field, bad).toBe("est_minutes");
    }
    expect(lesson({ est_minutes: "__omit__" }).issues[0]?.field).toBe("est_minutes");
  });

  it("last_verified_on validation (TC-B-11)", () => {
    expect(lesson({ last_verified_on: "2026-09-30" }).issues).toEqual([]);
    expect(lesson({ last_verified_on: '"2026-09-30"' }).value?.last_verified_on).toBe("2026-09-30");
    expect(lesson({ last_verified_on: "2026-02-30" }).issues[0]?.reason).toMatch(/not a real calendar date/);
    expect(lesson({ last_verified_on: "30/09/2026" }).issues[0]?.field).toBe("last_verified_on");
    expect(lesson({ last_verified_on: "2026-10-01" }).issues[0]?.reason).toMatch(/in the future/);
    expect(lesson({ last_verified_on: "__omit__" }).issues[0]?.field).toBe("last_verified_on");
  });

  it("tool_versions shape (TC-B-12)", () => {
    const tv = (c: string, x?: string) => `\n  claude_code: ${c}${x ? `\n  codex_cli: ${x}` : ""}`;
    expect(lesson({ tool_versions: tv('"2.1.0"', '"0.40.0"') }).issues).toEqual([]);
    expect(lesson({ tool_versions: tv('"2.1.0"') }).issues[0]?.field).toBe("tool_versions.codex_cli");
    expect(lesson({ tool_versions: tv('"2.1.0"', '"latest"') }).issues[0]?.field).toBe("tool_versions.codex_cli");
    expect(lesson({ tool_versions: tv("2.1", '"0.40.0"') }).issues[0]?.field).toBe("tool_versions.claude_code");
  });

  it("slug format (TC-B-20)", () => {
    expect(lesson({ slug: "l2-context-files" }).issues).toEqual([]);
    for (const bad of ['"L2-Context"', '"l2 context"', '"l2/../x"', '""', `"${"a".repeat(101)}"`]) {
      expect(lesson({ slug: bad }).issues[0]?.field, bad).toBe("slug");
    }
  });

  it("parses YAML safely (TC-B-19)", () => {
    const g = globalThis as Record<string, unknown>;
    const fn = lesson({ title: '!!js/function "function(){ globalThis.pwned = 1 }"' });
    expect(fn.issues.length).toBeGreaterThan(0);
    expect(g.pwned).toBeUndefined();

    const layers = Array.from({ length: 9 }, (_, i) => {
      const prev = `*a${i}`;
      return `&a${i + 1} [${Array(9).fill(prev).join(", ")}]`;
    });
    const bomb = lesson({ objective: "&a0 [x, x, x, x, x, x, x, x, x]", title: layers[8] ?? "x" });
    expect(bomb.issues.length).toBeGreaterThan(0);

    const proto = lesson({ ["__proto__"]: "{ polluted: true }" });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(proto).toBeDefined();
  });

  it("does not throw on an alias (AMB-B10)", () => {
    expect(() => lesson({ objective: "&o x", title: "*o" })).not.toThrow();
  });

  describe("tool sections (S-4)", () => {
    it("fails when a tool section is missing without a marker (TC-B-22)", () => {
      const { issues } = lesson({}, "## Concept\nC\n\n## Claude Code\nCC\n");
      expect(issues[0]?.reason).toMatch(/missing ## Codex CLI section and no no-equivalent marker/);
      const other = lesson({}, "## Concept\nC\n\n## Codex CLI\nCX\n");
      expect(other.issues[0]?.reason).toMatch(/missing ## Claude Code section and no no-equivalent marker/);
    });

    it("treats a heading-only section as missing (TC-B-23)", () => {
      const { issues } = lesson({}, "## Concept\nC\n\n## Claude Code\nCC\n\n## Codex CLI\n   \n\n");
      expect(issues[0]?.reason).toMatch(/missing ## Codex CLI section/);
    });

    it("stores a null body plus the workaround when flagged (TC-B-24)", () => {
      const { value, issues } = lesson(
        { codex_no_equivalent: "true" },
        "## Concept\nC\n\n## Claude Code\nCC\n\n## Codex CLI\nWorkaround: use a sandbox profile\n",
      );
      expect(issues).toEqual([]);
      expect(value).toMatchObject({
        codex_no_equivalent: true,
        codex_md: null,
        codex_workaround_md: "Workaround: use a sandbox profile",
        claude_md: "CC",
      });
    });

    it("requires workaround text when flagged", () => {
      const { issues } = lesson({ codex_no_equivalent: "true" }, "## Concept\nC\n\n## Claude Code\nCC\n");
      expect(issues[0]?.field).toBe("codex_no_equivalent");
      expect(issues[0]?.reason).toMatch(/workaround/);
    });

    it("rejects both tools flagged (TC-B-25)", () => {
      const { issues } = lesson(
        { codex_no_equivalent: "true", claude_no_equivalent: "true" },
        "## Concept\nC\n\n## Claude Code\nW1\n\n## Codex CLI\nW2\n",
      );
      expect(issues.some((i) => /no tool/i.test(i.reason))).toBe(true);
    });

    it("requires a Concept section", () => {
      const { issues } = lesson({}, "## Claude Code\nCC\n\n## Codex CLI\nCX\n");
      expect(issues[0]?.reason).toMatch(/missing ## Concept section/);
    });
  });

  it("stores raw HTML verbatim (TC-B-05)", () => {
    const html = `<script>window.__xss=1</script>\n<img src=x onerror="window.__xss=2">`;
    const { value } = lesson({}, `## Concept\n${html}\n\n## Claude Code\nCC\n\n## Codex CLI\nCX\n`);
    expect(value?.concept_md).toBe(html);
  });

  it("normalises BOM, CRLF and unicode identically (TC-B-06)", () => {
    const title = "Café — 初めての session ✓";
    const lf = `---\n${frontmatter({ title: `"${title}"` })}\n---\n\n${BODY}`;
    const crlf = "﻿" + lf.replace(/\n/g, "\r\n");
    const decomposed = lf.replace("Café", "Café");
    const a = parseLessonFile(lf, "content/lessons/l1/a.md", { now: FM_NOW }).value;
    const b = parseLessonFile(crlf, "content/lessons/l1/a.md", { now: FM_NOW }).value;
    const c = parseLessonFile(decomposed, "content/lessons/l1/a.md", { now: FM_NOW }).value;
    expect(a?.title).toBe(title);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it("warns about shell prompts in bash blocks", () => {
    const { warnings } = lesson({}, "## Concept\n```bash\n$ npm test\n```\n\n## Claude Code\nCC\n\n## Codex CLI\nCX\n");
    expect(warnings[0]?.reason).toMatch(/\$ prompt/);
  });
});
