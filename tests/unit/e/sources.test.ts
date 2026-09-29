// @vitest-environment node
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadSources, parseSources, SourcesConfigError } from "../../../scripts/news/sources";

const REPO_SOURCES = path.resolve(__dirname, "../../../content/news/sources.yaml");

describe("sources.yaml (I-1.1, I-1.2, TC-E-01)", () => {
  it("parses the shipped config", () => {
    const sources = loadSources(REPO_SOURCES);
    const slugs = sources.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of sources) expect(s.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    for (const slug of [
      "anthropic-news",
      "claude-code-releases",
      "codex-cli-releases",
      "openai-news",
      "deepmind-blog",
      "hacker-news",
      "simon-willison",
      "vercel-blog",
      "nextjs-blog",
      "supabase-blog",
      "github-changelog",
    ]) {
      expect(slugs).toContain(slug);
    }
    const hn = sources.find((s) => s.slug === "hacker-news");
    expect(hn?.url).toContain("points=");
    expect((hn?.filters.keywords ?? []).map((k) => k.toLowerCase()).sort()).toEqual(
      ["ai", "llm", "claude", "openai", "gemini", "next.js", "react", "supabase", "postgres", "typescript", "vercel", "security", "agent", "mcp"].sort(),
    );
    expect(sources.find((s) => s.slug === "anthropic-news")?.type).toBe("html");
  });

  const good = "- {name: A, slug: a, url: 'https://a.com/feed', type: rss, enabled: true}\n";
  it.each([
    ["missing url", "- {name: A, slug: a, type: rss, enabled: true}\n", /url/],
    ["bad type", "- {name: A, slug: a, url: 'https://a.com', type: json, enabled: true}\n", /type/],
    ["duplicate slug", good + good, /duplicate/i],
    ["enabled not boolean", "- {name: A, slug: a, url: 'https://a.com', type: rss, enabled: 'yes'}\n", /enabled/],
    ["ftp url", "- {name: A, slug: a, url: 'ftp://x', type: rss, enabled: true}\n", /url/],
    ["not yaml", ": : :", /./],
  ])("rejects %s", (_name, yaml, message) => {
    expect(() => parseSources(yaml, "sources.yaml")).toThrow(SourcesConfigError);
    expect(() => parseSources(yaml, "sources.yaml")).toThrow(message);
    expect(() => parseSources(yaml, "sources.yaml")).toThrow(/sources\.yaml/);
  });

  it("loadSources reports a missing file", () => {
    expect(() => loadSources("/definitely/not/here/sources.yaml")).toThrow(SourcesConfigError);
  });
});
