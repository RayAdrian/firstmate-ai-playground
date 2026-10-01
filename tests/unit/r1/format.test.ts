import { describe, expect, it } from "vitest";
import { REACTIONS } from "@/lib/contracts";
import {
  compactCounts,
  formatReactors,
  reactionSentence,
  reactorParts,
  REACTION_SHORT,
  starsLabel,
  ZERO_COUNTS,
} from "@/lib/community/format";

describe("CM-3 formatReactors", () => {
  it("is empty for no reactions", () => {
    expect(formatReactors([], 0)).toBe("");
    expect(formatReactors(["Rafael"], 0)).toBe("");
  });

  it("covers totals 1, 2 and 3 with and without names", () => {
    expect(formatReactors([], 1)).toBe("1 person");
    expect(formatReactors([], 2)).toBe("2 people");
    expect(formatReactors([], 4)).toBe("4 people");
    expect(formatReactors(["Rafael"], 1)).toBe("Rafael");
    expect(formatReactors(["Rafael", "Ana"], 2)).toBe("Rafael and Ana");
    expect(formatReactors(["Rafael"], 2)).toBe("Rafael and 1 other");
    expect(formatReactors(["Rafael"], 3)).toBe("Rafael and 2 others");
    expect(formatReactors(["Rafael", "Ana"], 3)).toBe("Rafael, Ana and 1 other");
    expect(formatReactors(["Rafael", "Ana"], 5)).toBe("Rafael, Ana and 3 others");
  });

  it("counts names beyond the 2 most recent as others, and never shows more names than reactions", () => {
    expect(formatReactors(["A", "B", "C"], 6)).toBe("A, B and 4 others");
    expect(formatReactors(["A", "B"], 1)).toBe("A");
  });

  it("returns names as separate parts so the page can render them as plain text nodes", () => {
    expect(reactorParts(["<b>x</b>", "Ana"], 4)).toEqual([
      { kind: "name", text: "<b>x</b>" },
      { kind: "text", text: ", " },
      { kind: "name", text: "Ana" },
      { kind: "text", text: " and 2 others" },
    ]);
  });
});

describe("CM-2 card counts", () => {
  it("reads as one sentence in the fixed order, zeros omitted", () => {
    expect(reactionSentence({ ...ZERO_COUNTS, worked: 4, game_changer: 2 })).toBe("4 worked for me, 2 game-changer");
    expect(reactionSentence({ worked: 3, learned: 2, saved_time: 1, game_changer: 2 })).toBe(
      "3 worked for me, 2 learned something, 1 saved me time, 2 game-changer",
    );
    expect(reactionSentence(ZERO_COUNTS)).toBe("");
  });

  it("has a compact visible form", () => {
    expect(compactCounts({ ...ZERO_COUNTS, worked: 4, game_changer: 2 })).toBe("🙌 4 · 🔥 2");
    expect(compactCounts(ZERO_COUNTS)).toBe("");
  });

  it("labels the star count", () => {
    expect(starsLabel(0)).toBe("0 stars");
    expect(starsLabel(1)).toBe("1 star");
    expect(starsLabel(12)).toBe("12 stars");
  });
});

describe("DESIGN 4.13.2 label in name", () => {
  it("every compact label is a prefix of its full label", () => {
    for (const r of REACTIONS) {
      expect(r.label.startsWith(REACTION_SHORT[r.key])).toBe(true);
    }
    expect(Object.values(REACTION_SHORT)).toEqual(["Worked", "Learned", "Saved", "Game-changer"]);
  });
});
