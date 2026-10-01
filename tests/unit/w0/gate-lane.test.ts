// @vitest-environment node
import { describe, expect, it } from "vitest";
import { classifyLane } from "../../../scripts/gate-lane";

const lane = (s: string) => {
  const r = classifyLane(s);
  return r.ok ? r.lane : "refuse";
};

describe("classifyLane (PRD §16.7 WF-22)", () => {
  it.each<[string, string, "content" | "code" | "refuse"]>([
    ["only workflows", "A\tcontent/workflows/a.md\nM\tcontent/workflows/b.md", "content"],
    ["a workflow plus a src change", "A\tcontent/workflows/a.md\nM\tsrc/x.ts", "code"],
    ["_taxonomy.yaml", "M\tcontent/workflows/_taxonomy.yaml", "content"],
    ["_takedowns.txt", "M\tcontent/workflows/_takedowns.txt", "content"],
    ["a subfolder", "A\tcontent/workflows/sub/a.md", "code"],
    ["a non-allowlisted extension", "A\tcontent/workflows/a.ts", "code"],
    ["a non-allowlisted underscore file", "A\tcontent/workflows/_other.yaml", "code"],
    ["a sibling folder with the same prefix", "A\tcontent/workflowsX/a.md", "code"],
    ["lessons", "A\tcontent/lessons/l1/a.md", "code"],
    ["rename src into workflows", "R100\tsrc/x.ts\tcontent/workflows/x.md", "code"],
    ["rename workflows out to src", "R100\tcontent/workflows/x.md\tsrc/x.md", "code"],
    ["copy src into workflows", "C90\tsrc/x.ts\tcontent/workflows/x.md", "code"],
    ["delete outside plus add inside", "D\tsrc/x.ts\nA\tcontent/workflows/a.md", "code"],
    ["rename inside workflows", "R100\tcontent/workflows/a.md\tcontent/workflows/b.md", "content"],
    ["delete inside workflows", "D\tcontent/workflows/a.md", "content"],
    ["type change inside workflows", "T\tcontent/workflows/a.md", "content"],
    ["an empty list", "", "refuse"],
    ["blank lines only", "\n\n", "refuse"],
    ["an unmerged entry", "U\tcontent/workflows/a.md", "refuse"],
    ["an unknown status", "X\tcontent/workflows/a.md", "refuse"],
    ["a malformed rename", "R100\tcontent/workflows/a.md", "refuse"],
    ["a quoted (special-char) path", 'A\t"content/workflows/a\\tb.md"', "code"],
    ["path traversal", "A\tcontent/workflows/../../src/x.ts", "code"],
  ])("%s -> %s", (_name, input, expected) => {
    expect(lane(input)).toBe(expected);
  });

  it("flags when a code-lane PR touches content/workflows", () => {
    const r = classifyLane("A\tcontent/workflows/a.md\nM\tsrc/x.ts");
    expect(r).toMatchObject({ ok: true, lane: "code", touchesWorkflows: true });
    expect(classifyLane("M\tsrc/x.ts")).toMatchObject({ touchesWorkflows: false });
  });

  it("counts both old and new paths of a rename", () => {
    const r = classifyLane("R100\tsrc/x.ts\tcontent/workflows/x.md");
    expect(r.ok && r.paths).toEqual(["src/x.ts", "content/workflows/x.md"]);
  });
});
