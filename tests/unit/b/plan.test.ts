import { describe, expect, it } from "vitest";
import { planUnique, type ExistingRow } from "../../../scripts/seed/lib/plan";

const row = (id: string, slug: string, key: number | string, archived = false): ExistingRow<number | string> => ({ id, slug, key, archived });

describe("planUnique (unique-key ordering, B1)", () => {
  it("renames in place when the key is reused (level slug rename)", () => {
    const p = planUnique([row("a", "l2", 2)], [{ slug: "l2-context", key: 2 }], { reuseByKey: true, freeKeys: [1, 2, 3, 4, 5] });
    expect(p.error).toBeUndefined();
    expect(p.matched).toEqual([{ want: { slug: "l2-context", key: 2 }, id: "a" }]);
    expect(p.archive).toEqual([]);
  });

  it("reuses the row holding the key for an exercise swap", () => {
    const p = planUnique([row("e1", "ex-old", "lessonA")], [{ slug: "ex-new", key: "lessonA" }], { reuseByKey: true });
    expect(p.matched[0]?.id).toBe("e1");
    expect(p.archive).toEqual([]);
  });

  it("archives unmatched rows and inserts new ones", () => {
    const p = planUnique([row("a", "gone", 1)], [{ slug: "new", key: 2 }], { reuseByKey: false });
    expect(p.matched).toEqual([{ want: { slug: "new", key: 2 }, id: null }]);
    expect(p.archive).toEqual(["a"]);
  });

  it("moves an archived row off a level number that a live level needs (renumber)", () => {
    const existing = [row("l2", "l2", 2), row("old", "l3-old", 3, true)];
    const p = planUnique(existing, [{ slug: "l2", key: 3 }], { reuseByKey: true, freeKeys: [1, 2, 3, 4, 5] });
    expect(p.error).toBeUndefined();
    expect(p.releases).toEqual([{ id: "old", key: 1 }]);
    expect(p.matched).toEqual([{ want: { slug: "l2", key: 3 }, id: "l2" }]);
  });

  it("orders shifting moves so no step collides", () => {
    const existing = [row("a", "l2", 2), row("b", "l3", 3)];
    const p = planUnique(existing, [{ slug: "l2", key: 3 }, { slug: "l3", key: 4 }], { reuseByKey: true, freeKeys: [1, 2, 3, 4, 5] });
    expect(p.matched.map((m) => m.id)).toEqual(["b", "a"]);
  });

  it("reports a cyclic swap instead of writing", () => {
    const existing = [row("a", "l1", 1), row("b", "l2", 2)];
    const p = planUnique(existing, [{ slug: "l1", key: 2 }, { slug: "l2", key: 1 }], { reuseByKey: true, freeKeys: [1, 2, 3, 4, 5] });
    expect(p.error).toMatch(/swap|cycle/i);
  });

  it("errors when an existing exercise moves onto a lesson held by an archived exercise", () => {
    const existing = [row("x", "ex-a", "L1"), row("y", "ex-b", "L2", true)];
    const p = planUnique(existing, [{ slug: "ex-a", key: "L2" }], { reuseByKey: true });
    expect(p.error).toMatch(/L2/);
  });
});
