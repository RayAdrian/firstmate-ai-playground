import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { progressStateSchema } from "@/lib/contracts";
import {
  addBookmark,
  emptyState,
  markComplete,
  setLastViewed,
  setToolPref,
  toggleBookmark,
  toggleChecklistItem,
  undoComplete,
} from "@/lib/progress";
import { sortedBookmarks, summarize } from "@/lib/progress";

const NEWS_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-30T05:00:00.123Z"));
});
afterEach(() => vi.useRealTimers());

describe("TC-D-01 empty state", () => {
  it("matches the P-1 contract exactly", () => {
    const s = emptyState();
    expect(progressStateSchema.strict().safeParse(s).success).toBe(true);
    expect(Object.keys(s).sort()).toEqual(
      ["bookmarks", "checklists", "lastViewed", "lessons", "prefs", "version"].sort(),
    );
    expect(s).toEqual({
      version: 1,
      lessons: {},
      checklists: {},
      bookmarks: { lessons: {}, news: {} },
      prefs: { tool: "claude" },
      lastViewed: null,
    });
  });
});

describe("TC-D-02/03/04 lesson completion", () => {
  it("writes an ISO-8601 UTC timestamp with milliseconds and stays pure", () => {
    const before = emptyState();
    const snapshot = JSON.stringify(before);
    const after = markComplete(before, "l1-first-session");
    expect(after.lessons["l1-first-session"].completedAt).toBe("2026-09-30T05:00:00.123Z");
    expect(after.lessons["l1-first-session"].completedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("is idempotent and keeps the first timestamp", () => {
    const first = markComplete(emptyState(), "l1-first-session");
    vi.advanceTimersByTime(60_000);
    const again = markComplete(first, "l1-first-session");
    expect(again).toBe(first);
    expect(again.lessons["l1-first-session"].completedAt).toBe("2026-09-30T05:00:00.123Z");
  });

  it("undo deletes the key entirely and is a no-op for unknown slugs", () => {
    let s = markComplete(emptyState(), "l1-first-session");
    s = markComplete(s, "l2-context-files");
    const undone = undoComplete(s, "l1-first-session");
    expect("l1-first-session" in undone.lessons).toBe(false);
    expect(undone.lessons["l2-context-files"]).toBeDefined();
    expect(undoComplete(undone, "l1-first-session")).toEqual(undone);
    expect(undoComplete(undone, "never-completed")).toEqual(undone);
  });

  it("does not treat inherited properties as completed lessons", () => {
    const s = emptyState();
    expect(undoComplete(s, "constructor")).toBe(s);
    expect(markComplete(s, "__proto__")).toBe(s);
  });
});

describe("TC-D-05 checklist", () => {
  it("toggles one item without creating other exercise keys", () => {
    let s = toggleChecklistItem(emptyState(), "ex-fx-auto", "c1", true);
    expect(s.checklists["ex-fx-auto"].c1).toBe(true);
    s = toggleChecklistItem(s, "ex-fx-auto", "c1", true);
    expect(Object.keys(s.checklists["ex-fx-auto"])).toEqual(["c1"]);
    s = toggleChecklistItem(s, "ex-fx-auto", "c1", false);
    expect(progressStateSchema.safeParse(s).success).toBe(true);
    expect(s.checklists["ex-fx-auto"]?.c1).not.toBe(true);
    expect(Object.keys(s.checklists)).not.toContain("other");
  });

  it("keeps orphan item ids when another item changes", () => {
    let s = toggleChecklistItem(emptyState(), "ex-fx-auto", "zzz", true);
    s = toggleChecklistItem(s, "ex-fx-auto", "c1", true);
    s = toggleChecklistItem(s, "ex-fx-auto", "c1", false);
    expect(s.checklists["ex-fx-auto"]).toEqual({ zzz: true });
  });
});

describe("TC-D-06 bookmarks", () => {
  it("keeps lessons and news independent, keyed by id", () => {
    let s = toggleBookmark(emptyState(), "lessons", "l1-first-session");
    s = toggleBookmark(s, "news", NEWS_ID);
    expect(s.bookmarks.lessons).toEqual({ "l1-first-session": "2026-09-30T05:00:00.123Z" });
    expect(Object.keys(s.bookmarks.news)).toEqual([NEWS_ID]);
    s = toggleBookmark(s, "lessons", "l1-first-session");
    expect(s.bookmarks.lessons).toEqual({});
    expect(Object.keys(s.bookmarks.news)).toEqual([NEWS_ID]);
  });

  it("re-adding does not duplicate or bump the timestamp; restore keeps the original", () => {
    const s = addBookmark(emptyState(), "news", NEWS_ID, "2026-09-01T00:00:00.000Z");
    expect(addBookmark(s, "news", NEWS_ID)).toBe(s);
    expect(s.bookmarks.news[NEWS_ID]).toBe("2026-09-01T00:00:00.000Z");
  });

  it("sorts newest first", () => {
    let s = addBookmark(emptyState(), "lessons", "a", "2026-09-29T01:00:00.000Z");
    s = addBookmark(s, "lessons", "b", "2026-09-30T02:00:00.000Z");
    expect(sortedBookmarks(s, "lessons").map((e) => e.id)).toEqual(["b", "a"]);
  });
});

describe("TC-D-07 tool preference", () => {
  it("accepts only claude and codex", () => {
    const s = setToolPref(emptyState(), "codex");
    expect(s.prefs.tool).toBe("codex");
    for (const bad of ["cursor", "", "CODEX"]) {
      expect(setToolPref(s, bad).prefs.tool).toBe("codex");
    }
  });
});

describe("summarize", () => {
  it("counts checked checklist items and can exclude unknown lessons", () => {
    let s = markComplete(emptyState(), "l1");
    s = markComplete(s, "gone");
    s = toggleChecklistItem(s, "ex", "a", true);
    s = toggleChecklistItem(s, "ex", "b", true);
    s = toggleBookmark(s, "lessons", "gone");
    s = toggleBookmark(s, "news", NEWS_ID);
    expect(summarize(s)).toEqual({ lessons: 2, checklistItems: 2, bookmarks: 2 });
    expect(summarize(s, ["l1"])).toEqual({ lessons: 1, checklistItems: 2, bookmarks: 1 });
  });
});

describe("TC-D-08 serializer round-trip", () => {
  // fast-check is not a dependency (package.json is frozen), so use a seeded generator.
  function rng(seed: number) {
    let x = seed;
    return () => {
      x = (x * 1664525 + 1013904223) % 4294967296;
      return x / 4294967296;
    };
  }
  const SLUGS = ["l1-first-session", "l1-ünicode", "l2-context-files", "ex-fx-auto", "a", "c1"];

  it("always re-parses with the schema", () => {
    for (let run = 0; run < 200; run++) {
      const r = rng(run + 1);
      const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
      let s = emptyState();
      const steps = 1 + Math.floor(r() * 50);
      for (let i = 0; i < steps; i++) {
        switch (Math.floor(r() * 6)) {
          case 0:
            s = markComplete(s, pick(SLUGS));
            break;
          case 1:
            s = undoComplete(s, pick(SLUGS));
            break;
          case 2:
            s = toggleChecklistItem(s, pick(SLUGS), pick(SLUGS), r() > 0.5);
            break;
          case 3:
            s = toggleBookmark(s, pick(["lessons", "news"] as const), pick(SLUGS));
            break;
          case 4:
            s = setToolPref(s, pick(["claude", "codex", "vim"]));
            break;
          default:
            s = setLastViewed(s, pick(SLUGS));
        }
      }
      const text = JSON.stringify(s);
      expect(progressStateSchema.safeParse(JSON.parse(text)).success).toBe(true);
      expect(text).not.toContain("undefined");
    }
  });
});
