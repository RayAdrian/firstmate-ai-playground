// @vitest-environment node
import { describe, expect, it } from "vitest";
import { matchesKeywords } from "../../../scripts/news/prefilter";

const KEYWORDS = ["AI", "LLM", "Claude", "OpenAI", "Gemini", "Next.js", "React", "Supabase", "Postgres", "TypeScript", "Vercel", "security", "agent", "MCP"];

describe("HN keyword prefilter (TC-E-05)", () => {
  it.each([
    ["Claude 5 released", true],
    ["claude code tips", true],
    ["Postgres 19 beta", true],
    ["MCPs in practice", true],
    ["Next.js 17 ships", true],
    ["Reactor pattern in Java", false],
    ["Show HN: my garden", false],
    ["Typescriptish rant", false],
  ])("%s -> %s", (title, kept) => {
    expect(matchesKeywords({ title, excerpt: null }, KEYWORDS)).toBe(kept);
  });

  it("also matches on the excerpt", () => {
    expect(matchesKeywords({ title: "Show HN: my garden", excerpt: "built with Supabase" }, KEYWORDS)).toBe(true);
  });

  it("keeps everything when no keywords are configured", () => {
    expect(matchesKeywords({ title: "anything", excerpt: null }, [])).toBe(true);
  });
});
