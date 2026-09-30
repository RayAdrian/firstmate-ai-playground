// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseAnthropicNews } from "../../../scripts/news/anthropic";
import { FeedParseError } from "../../../scripts/news/feed";

const fixture = (name: string) => fs.readFileSync(path.resolve(__dirname, "fixtures", name), "utf8");
const BASE = "https://www.anthropic.com/news";

describe("Anthropic news scraper (R-3.1, TC-E-12/13)", () => {
  it("parses cards from the saved page", () => {
    const items = parseAnthropicNews(fixture("anthropic-news.html"), BASE);
    expect(items).toHaveLength(6);
    for (const i of items) {
      expect(i.link).toMatch(/^https:\/\/www\.anthropic\.com\/news\/[a-z0-9-]+$/);
      expect(i.title?.length).toBeGreaterThan(0);
      expect(i.published).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
    expect(items[0].title).toBe("Claude discovers a novel enzyme system with CRISPR-like repeats");
    expect(items[0].published?.slice(0, 10)).toBe("2026-09-23");
  });

  it("does no network access", () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error("network used");
    }) as typeof fetch;
    try {
      expect(() => parseAnthropicNews(fixture("anthropic-news.html"), BASE)).not.toThrow();
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("treats a layout change (zero cards) as a source failure", () => {
    expect(() => parseAnthropicNews(fixture("anthropic-layout-changed.html"), BASE)).toThrow(FeedParseError);
  });

  it("keeps cards that have no date", () => {
    const items = parseAnthropicNews(fixture("anthropic-partial.html"), BASE);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.published === null)).toBe(true);
  });
});
