import { describe, expect, it } from "vitest";
import {
  daysBetween,
  formatVerifiedDate,
  isOutdated,
  percent,
  verifiedLine,
} from "@/components/lesson/format";
import { manilaDate } from "@/lib/time/now";
import { computePrevNext, orderLessons, type NavLesson } from "@/components/lesson/navigation";
import { parseTool } from "@/components/lesson/tool";

describe("C-5 verified line and outdated badge", () => {
  it("TC-C-15 formats the verified line", () => {
    expect(verifiedLine("2026-09-20", { claude_code: "2.1.0", codex_cli: "0.40.0" })).toBe(
      "Verified 20 Sep 2026 · Claude Code v2.1.0 / Codex v0.40.0",
    );
  });

  it("drops the parts that are unknown", () => {
    expect(verifiedLine(null, { claude_code: "2.1.0" })).toBe("Claude Code v2.1.0");
    expect(verifiedLine("2026-09-20", {})).toBe("Verified 20 Sep 2026");
    expect(verifiedLine(null, {})).toBeNull();
    expect(formatVerifiedDate("nonsense")).toBeNull();
  });

  it("TC-C-16/17 outdated only when strictly more than 60 days", () => {
    expect(daysBetween("2026-07-31", "2026-09-30")).toBe(61);
    expect(isOutdated("2026-07-31", "2026-09-30")).toBe(true);
    expect(daysBetween("2026-08-01", "2026-09-30")).toBe(60);
    expect(isOutdated("2026-08-01", "2026-09-30")).toBe(false);
    expect(isOutdated(null, "2026-09-30")).toBe(false);
  });

  it("TC-C-18 'today' is the Manila calendar date, not the UTC one", () => {
    // 23:30 Manila is still 15:30 UTC on the 29th; 00:30 Manila is 16:30 UTC on the 29th.
    const before = manilaDate(new Date("2026-09-29T23:30:00+08:00"));
    const after = manilaDate(new Date("2026-09-30T00:30:00+08:00"));
    expect(before).toBe("2026-09-29");
    expect(after).toBe("2026-09-30");
    expect(isOutdated("2026-07-31", before)).toBe(false);
    expect(isOutdated("2026-07-31", after)).toBe(true);
  });
});

describe("C-2 percentages", () => {
  it("rounds half up and never divides by zero", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
    expect(percent(1, 2)).toBe(50);
    expect(percent(0, 0)).toBe(0);
    expect(percent(4, 4)).toBe(100);
  });
});

describe("L-2 tool param", () => {
  it("accepts exact lowercase values and takes the first of a repeated param", () => {
    expect(parseTool("codex")).toBe("codex");
    expect(parseTool("claude")).toBe("claude");
    expect(parseTool(["codex", "claude"])).toBe("codex");
    for (const bad of ["cursor", "", "CODEX", "<script>", undefined, null]) {
      expect(parseTool(bad)).toBeNull();
    }
  });
});

function fiveLevels(): NavLesson[] {
  const counts = [3, 3, 4, 4, 4];
  return counts.flatMap((n, li) =>
    Array.from({ length: n }, (_, i) => ({
      slug: `l${li + 1}-s${i + 1}`,
      title: `Lesson ${li + 1}.${i + 1}`,
      level: li + 1,
      sort: i + 1,
    })),
  );
}

describe("L-6 previous and next", () => {
  it("TC-C-49 crosses levels, ends with back-to-curriculum, starts without previous", () => {
    const lessons = fiveLevels();
    for (const n of [1, 2, 3, 4]) {
      const last = lessons.filter((l) => l.level === n).at(-1)!;
      const result = computePrevNext(lessons, last.slug)!;
      expect(result.next).toMatchObject({ slug: `l${n + 1}-s1` });
    }
    const finalLesson = lessons.at(-1)!;
    expect(computePrevNext(lessons, finalLesson.slug)!.next).toEqual({ kind: "back-to-curriculum" });
    expect(computePrevNext(lessons, "l1-s1")!.previous).toBeNull();
    expect(computePrevNext(lessons, "l2-s1")!.previous).toMatchObject({ slug: "l1-s3" });
  });

  it("is independent of input order and returns null for unknown slugs", () => {
    const shuffled = [...fiveLevels()].reverse();
    expect(computePrevNext(shuffled, "l3-s2")!.next).toMatchObject({ slug: "l3-s3" });
    expect(computePrevNext(shuffled, "nope")).toBeNull();
  });

  it("numbers lessons level.position", () => {
    const numbers = orderLessons(fiveLevels()).map((l) => l.number);
    expect(numbers.slice(0, 4)).toEqual(["1.1", "1.2", "1.3", "2.1"]);
  });
});
