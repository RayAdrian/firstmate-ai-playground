import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  TLDR_CAPS,
  lessonFrontmatterSchema,
  lessonRowSchema,
  lessonTldrSchema,
  mediaManifestSchema,
  type LessonTldr,
} from "@/lib/contracts";
import { tldrSourceHash } from "@/lib/contracts/tldr-hash";
import { hashLesson, lessonTldrColumns, parseLessonFile } from "../../../scripts/seed/lib/lesson";

const all: LessonTldr = {
  points: [
    "An agent is a model in a loop: ask, edit, approve, verify.",
    "Approval prompts are your brake. Learn what triggers them before you speed up.",
    "Commit before you start, so `git` can undo anything the agent did.",
  ],
  try_this: { all: { kind: "command", text: "claude --version && codex --version" } },
};
const perTool: LessonTldr = {
  points: all.points,
  try_this: {
    claude: { kind: "prompt", text: "Use a subagent to run the tests and report only the failures." },
    codex: { kind: "prompt", text: "Run the tests and report only the failures. Do not edit any files." },
  },
};
const tryOk = { kind: "command", text: "ls" };

describe("lessonTldrSchema (TL-1)", () => {
  it("accepts both PRD examples", () => {
    expect(lessonTldrSchema.safeParse(all).success).toBe(true);
    expect(lessonTldrSchema.safeParse(perTool).success).toBe(true);
  });

  it.each<[string, unknown, string]>([
    ["2 points", { ...all, points: all.points.slice(0, 2) }, "points"],
    ["4 points", { ...all, points: [...all.points, "A fourth point here."] }, "points"],
    ["a point under 10 chars", { ...all, points: ["short", all.points[1], all.points[2]] }, "points.0"],
    ["a point over 100 chars", { ...all, points: [all.points[0], "x".repeat(TLDR_CAPS.pointMax + 1), all.points[2]] }, "points.1"],
    ["a duplicate point", { ...all, points: [all.points[0], all.points[0], all.points[2]] }, "points"],
    ["a newline in a point", { ...all, points: [all.points[0], "line one\nline two here", all.points[2]] }, "points.1"],
    ["a newline in try_this", { ...all, try_this: { all: { kind: "command", text: "a\nb" } } }, "try_this"],
    ["try_this over 120 chars", { ...all, try_this: { all: { kind: "command", text: "x".repeat(TLDR_CAPS.tryMax + 1) } } }, "try_this"],
    ["a bad kind", { ...all, try_this: { all: { kind: "script", text: "ls" } } }, "try_this"],
    ["claude only", { ...all, try_this: { claude: tryOk } }, "try_this"],
    ["all plus claude", { ...all, try_this: { all: tryOk, claude: tryOk } }, "try_this"],
    ["an unknown top-level key", { ...all, extra: 1 }, ""],
    ["an unknown try key", { ...all, try_this: { all: { ...tryOk, extra: 1 } } }, "try_this"],
  ])("rejects %s", (_n, value, pathPrefix) => {
    const r = lessonTldrSchema.safeParse(value);
    expect(r.success).toBe(false);
    if (!r.success && pathPrefix) {
      expect(r.error.issues.some((i) => i.path.join(".").startsWith(pathPrefix))).toBe(true);
    }
  });

  it("trims before counting characters", () => {
    const padded = { ...all, points: [`  ${"x".repeat(100)}  `, all.points[1], all.points[2]] };
    expect(lessonTldrSchema.safeParse(padded).success).toBe(true);
  });
});

const fm = {
  slug: "l1-demo",
  level: 1,
  sort: 1,
  title: "Demo",
  objective: "Learn it.",
  est_minutes: 20,
  tool_versions: { claude_code: "2.1.0", codex_cli: "0.40.0" },
  last_verified_on: "2026-09-20",
  differences: ["one"],
  exercise: "ex-demo",
};

describe("lesson frontmatter (TL0: tldr is optional)", () => {
  it("accepts a lesson with no tldr and with a valid tldr", () => {
    expect(lessonFrontmatterSchema.safeParse(fm).success).toBe(true);
    expect(lessonFrontmatterSchema.safeParse({ ...fm, tldr: all }).success).toBe(true);
  });
  it("rejects an invalid tldr", () => {
    const r = lessonFrontmatterSchema.safeParse({ ...fm, tldr: { ...all, points: [] } });
    expect(r.success).toBe(false);
  });
});

describe("lessonRowSchema.tldr", () => {
  const row = {
    id: "00000000-0000-0000-0000-000000000001",
    level_id: "00000000-0000-0000-0000-000000000002",
    slug: "l1-demo",
    sort: 1,
    title: "Demo",
    objective: "o",
    est_minutes: 5,
    concept_md: "c",
    claude_md: "c",
    codex_md: "c",
    claude_no_equivalent: false,
    codex_no_equivalent: false,
    claude_workaround_md: null,
    codex_workaround_md: null,
    differences: ["d"],
    tool_versions: {},
    tldr: null,
    last_verified_on: null,
    content_hash: "h",
    archived_at: null,
    updated_at: "2026-10-01T00:00:00Z",
  };
  it("accepts null and a valid tldr, rejects an invalid one", () => {
    expect(lessonRowSchema.safeParse(row).success).toBe(true);
    expect(lessonRowSchema.safeParse({ ...row, tldr: perTool }).success).toBe(true);
    expect(lessonRowSchema.safeParse({ ...row, tldr: { points: ["x"] } }).success).toBe(false);
  });
});

describe("tldrSourceHash (TL-1)", () => {
  const base = { templateVersion: 1, title: "Demo", tldr: perTool };
  const h = tldrSourceHash(base);

  it("is a sha256 hex string", () => {
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
  it("ignores key order in try_this and in the entries", () => {
    const reordered = {
      ...base,
      tldr: {
        ...perTool,
        try_this: {
          codex: { text: "Run the tests and report only the failures. Do not edit any files.", kind: "prompt" },
          claude: { text: "Use a subagent to run the tests and report only the failures.", kind: "prompt" },
        },
      },
    } as typeof base;
    expect(tldrSourceHash(reordered)).toBe(h);
  });
  it("changes with the title, any point, any try_this field or the template version", () => {
    const pts = (i: number): string[] => perTool.points.map((p, j) => (j === i ? `${p} x` : p));
    const variants = [
      { ...base, title: "Demo 2" },
      { ...base, templateVersion: 2 },
      { ...base, tldr: { ...perTool, points: pts(0) } },
      { ...base, tldr: { ...perTool, points: pts(2) } },
      { ...base, tldr: { ...all } },
      {
        ...base,
        tldr: {
          ...perTool,
          try_this: { ...(perTool.try_this as { claude: typeof tryOk; codex: typeof tryOk }), claude: { kind: "command", text: "ls" } },
        },
      },
    ] as (typeof base)[];
    const hashes = new Set([h, ...variants.map(tldrSourceHash)]);
    expect(hashes.size).toBe(variants.length + 1);
  });
});

const manifest = {
  id: "tldr",
  lesson_slug: "l1-demo",
  kind: "tldr",
  title: "TL;DR: Demo",
  duration_s: 36,
  width: 1280,
  height: 720,
  tool_versions: { claude_code: "2.1.0", codex_cli: "0.40.0" },
  made_on: "2026-10-02",
  model_calls: false,
  source_hash: "abc",
  template_version: 1,
};

describe("mediaManifestSchema kind tldr", () => {
  it("requires an integer template_version for kind tldr", () => {
    expect(mediaManifestSchema.safeParse(manifest).success).toBe(true);
    expect(mediaManifestSchema.safeParse({ ...manifest, template_version: undefined }).success).toBe(false);
    expect(mediaManifestSchema.safeParse({ ...manifest, template_version: 1.5 }).success).toBe(false);
  });
  it("rejects template_version on other kinds", () => {
    expect(mediaManifestSchema.safeParse({ ...manifest, kind: "animation", id: "x" }).success).toBe(false);
    expect(
      mediaManifestSchema.safeParse({ ...manifest, kind: "animation", id: "x", template_version: undefined }).success,
    ).toBe(true);
  });
});

describe("seed: tldr mapping (TL-2, before TL0b)", () => {
  const body = "## Concept\n\nC\n\n## Claude Code\n\nCC\n\n## Codex CLI\n\nCX\n";
  const tldrYaml =
    'tldr:\n  points:\n    - "Point number one is here."\n    - "Point number two is here."\n    - "Point number three is here."\n  try_this:\n    all: { kind: command, text: "ls" }\n';
  const yamlFm = (extra: string, objective = "Learn it.") =>
    `slug: l1-demo\nlevel: 1\nsort: 1\ntitle: Demo\nobjective: ${objective}\nest_minutes: 20\ntool_versions:\n  claude_code: "2.1.0"\n  codex_cli: "0.40.0"\nlast_verified_on: 2026-09-20\ndifferences:\n  - one\n${extra}`;
  const parse = (extra: string) =>
    parseLessonFile(`---\n${yamlFm(extra)}---\n\n${body}`, "content/lessons/l1/01-demo.md", {
      now: new Date("2026-09-30T13:00:00+08:00"),
    });

  it("a lesson without tldr seeds with tldr null", () => {
    const r = parse("");
    expect(r.issues).toEqual([]);
    expect(r.value?.tldr).toBeNull();
  });
  it("a lesson with tldr carries it, and editing only the tldr changes content_hash", () => {
    const a = parse(tldrYaml);
    const b = parse(tldrYaml.replace("Point number one", "Point number uno"));
    expect(a.issues).toEqual([]);
    expect(a.value?.tldr?.points).toHaveLength(3);
    expect(a.value?.content_hash).not.toBe(b.value?.content_hash);
    expect(a.value?.content_hash).not.toBe(parse("").value?.content_hash);
    expect(parse(tldrYaml).value?.content_hash).toBe(a.value?.content_hash);
  });
  it("an invalid tldr fails with the field path", () => {
    const r = parse(tldrYaml.replace('    - "Point number three is here."\n', ""));
    expect(r.value).toBeUndefined();
    expect(r.issues.some((i) => i.field.startsWith("tldr.points"))).toBe(true);
  });
});

describe("seed: backward compatibility without tldr", () => {
  const body = "## Concept\n\nC\n\n## Claude Code\n\nCC\n\n## Codex CLI\n\nCX\n";
  const raw =
    '---\nslug: l1-demo\nlevel: 1\nsort: 1\ntitle: Demo\nobjective: Learn it.\nest_minutes: 20\ntool_versions:\n  claude_code: "2.1.0"\n  codex_cli: "0.40.0"\nlast_verified_on: 2026-09-20\ndifferences:\n  - one\n---\n\n' +
    body;
  const l = parseLessonFile(raw, "content/lessons/l1/01-demo.md", { now: new Date("2026-09-30T13:00:00+08:00") }).value!;

  it("keeps the pre-TL0 content hash for a lesson without tldr", () => {
    // The hash input exactly as it was before TL0 (no tldr element).
    const legacy = createHash("sha256")
      .update(
        JSON.stringify([
          l.slug, l.levelNumber, l.sort, l.title, l.objective, l.est_minutes, l.concept_md, l.claude_md, l.codex_md,
          l.claude_no_equivalent, l.codex_no_equivalent, l.claude_workaround_md, l.codex_workaround_md, l.differences,
          [l.tool_versions.claude_code, l.tool_versions.codex_cli], l.last_verified_on,
        ]),
      )
      .digest("hex");
    expect(l.tldr).toBeNull();
    expect(hashLesson(l)).toBe(legacy);
  });

  it("omits the tldr key from the upsert payload when absent, includes it when present", () => {
    expect("tldr" in lessonTldrColumns(l)).toBe(false);
    expect(lessonTldrColumns({ tldr: all })).toEqual({ tldr: all });
  });
});
