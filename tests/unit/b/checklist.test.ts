import { describe, expect, it } from "vitest";
import { parseChecklist } from "../../../scripts/seed/lib/checklist";

const f = "exercises/ex-x/CHECKLIST.md";

describe("parseChecklist (TC-B-17)", () => {
  it("parses explicit ids in file order", () => {
    const { items, issues } = parseChecklist("- [ ] {#c1} Test is green\n- [ ] {#c2} No test files edited\n", f);
    expect(issues).toEqual([]);
    expect(items).toEqual([
      { id: "c1", text: "Test is green" },
      { id: "c2", text: "No test files edited" },
    ]);
  });

  it("accepts trailing {#id} and `id: text` forms", () => {
    const { items, issues } = parseChecklist("- [ ] Tests pass {#c1}\n- [x] m-2: Reviewed diff\n* [ ] {#c_3} Third\n", f);
    expect(issues).toEqual([]);
    expect(items.map((i) => i.id)).toEqual(["c1", "m-2", "c_3"]);
    expect(items[1]?.text).toBe("Reviewed diff");
  });

  it("rejects a duplicate id with its line number", () => {
    const { issues } = parseChecklist("- [ ] {#c1} A\n- [ ] {#c2} B\n- [ ] {#c1} C\n", f);
    expect(issues[0]).toMatchObject({ file: f, line: 3, field: "checklist" });
    expect(issues[0]?.reason).toMatch(/duplicate.*c1/);
  });

  it("rejects an item without an id", () => {
    const { issues } = parseChecklist("- [ ] Tests: green\n", f);
    expect(issues[0]?.line).toBe(1);
    expect(issues[0]?.reason).toMatch(/needs an explicit id/);
  });

  it("validates id characters and length", () => {
    expect(parseChecklist("- [ ] {#c-1} a\n- [ ] {#c_1} b\n", f).issues).toEqual([]);
    expect(parseChecklist("- [ ] {#C 1} a\n", f).issues).toHaveLength(1);
    expect(parseChecklist(`- [ ] {#${"a".repeat(65)}} a\n`, f).issues).toHaveLength(1);
    expect(parseChecklist(`- [ ] {#${"a".repeat(64)}} a\n`, f).issues).toEqual([]);
  });

  it("rejects an empty checklist", () => {
    expect(parseChecklist("# Title\n\nSome prose\n", f).issues[0]?.reason).toMatch(/at least one/);
  });

  it("ignores non-checkbox lines and headings", () => {
    const { items } = parseChecklist("# Checklist\n\nIntro.\n\n- [ ] {#a1} One\n", f);
    expect(items).toHaveLength(1);
  });
});
