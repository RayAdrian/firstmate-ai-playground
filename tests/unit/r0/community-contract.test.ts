import { describe, expect, it } from "vitest";
import {
  COMMUNITY_MAX_BODY_BYTES,
  COMMUNITY_MAX_SLUGS,
  DISPLAY_NAME_MAX,
  REACTIONS,
  REACTION_KEYS,
  communityRequestSchema,
  normalizeDisplayName,
  reactionKeySchema,
} from "@/lib/contracts";
import vectors from "./name-vectors.json";

const ID = "11111111-2222-4333-8444-555555555555";

describe("reaction set (PRD 18.5)", () => {
  it("has exactly the four keys, with emoji and labels", () => {
    expect(REACTIONS.map((r) => [r.key, r.emoji, r.label])).toEqual([
      ["worked", "🙌", "Worked for me"],
      ["learned", "💡", "Learned something"],
      ["saved_time", "⏱️", "Saved me time"],
      ["game_changer", "🔥", "Game-changer"],
    ]);
    expect(REACTION_KEYS).toEqual(["worked", "learned", "saved_time", "game_changer"]);
    expect(reactionKeySchema.safeParse("clap").success).toBe(false);
  });
});

describe("normalizeDisplayName (CM-4), shared vectors", () => {
  it("has the 40-character limit", () => expect(DISPLAY_NAME_MAX).toBe(40));
  for (const v of vectors) {
    it(v.name, () => {
      const result = normalizeDisplayName(v.input);
      if ("invalid" in v && v.invalid) expect(result).toEqual({ ok: false, reason: "too_long" });
      else expect(result).toEqual({ ok: true, value: v.output });
    });
  }
});

describe("POST /api/community request schema (CM-8)", () => {
  it("has a 2 KB cap and a 100-slug cap", () => {
    expect(COMMUNITY_MAX_BODY_BYTES).toBe(2048);
    expect(COMMUNITY_MAX_SLUGS).toBe(100);
  });

  const valid = [
    { op: "star", clientId: ID, slug: "my-flow", on: true },
    { op: "react", clientId: ID, slug: "my-flow", reaction: "worked", on: false },
    { op: "react", clientId: ID, slug: "my-flow", reaction: "worked", on: true, displayName: "Ana" },
    { op: "react", clientId: ID, slug: "my-flow", reaction: "worked", on: true, displayName: null },
    { op: "name", clientId: ID, displayName: "Ana" },
    { op: "name", clientId: ID, displayName: null },
    { op: "mine", clientId: ID, slugs: ["a", "b-c"] },
    { op: "myStars", clientId: ID },
  ];
  for (const body of valid) {
    it(`accepts ${JSON.stringify(body).slice(0, 60)}`, () => {
      expect(communityRequestSchema.safeParse(body).success).toBe(true);
    });
  }

  const invalid: [string, unknown][] = [
    ["unknown op", { op: "delete", clientId: ID }],
    ["unknown key (strict)", { op: "myStars", clientId: ID, extra: 1 }],
    ["missing clientId", { op: "myStars" }],
    ["non-UUID clientId", { op: "myStars", clientId: "abc" }],
    ["UUID that is not v4", { op: "myStars", clientId: "11111111-2222-1333-8444-555555555555" }],
    ["toggle instead of desired state", { op: "star", clientId: ID, slug: "a", on: "toggle" }],
    ["missing on", { op: "star", clientId: ID, slug: "a" }],
    ["bad slug", { op: "star", clientId: ID, slug: "Not A Slug", on: true }],
    ["slug too long", { op: "star", clientId: ID, slug: "a".repeat(61), on: true }],
    ["bad reaction", { op: "react", clientId: ID, slug: "a", reaction: "clap", on: true }],
    ["name field on a star", { op: "star", clientId: ID, slug: "a", on: true, displayName: "x" }],
    ["101 slugs", { op: "mine", clientId: ID, slugs: Array.from({ length: 101 }, (_, i) => `s${i}`) }],
    ["slugs on myStars", { op: "myStars", clientId: ID, slugs: [] }],
  ];
  for (const [name, body] of invalid) {
    it(`rejects ${name}`, () => {
      expect(communityRequestSchema.safeParse(body).success).toBe(false);
    });
  }
});
