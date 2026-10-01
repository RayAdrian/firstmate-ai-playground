// @vitest-environment node
import { describe, expect, it } from "vitest";
import { decodeXml, FeedParseError, parseFeed } from "../../../scripts/news/feed";
import { normalizeItems } from "../../../scripts/news/normalize";

const NOW = new Date("2026-09-30T08:00:00+08:00");

const rss = (items: string, channelLink = "https://openai.com/") =>
  `<?xml version="1.0"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>T</title><link>${channelLink}</link>${items}</channel></rss>`;

describe("parseFeed RSS/Atom", () => {
  it("parses RSS items", () => {
    const items = parseFeed(
      rss(`<item><title>Hello &amp; goodbye</title><link>https://openai.com/a</link><guid isPermaLink="false">g-1</guid><pubDate>Mon, 29 Sep 2026 10:00:00 GMT</pubDate><dc:creator>Ann</dc:creator><description>Body text</description></item>`),
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: "Hello & goodbye", link: "https://openai.com/a", guid: "g-1", author: "Ann", excerpt: "Body text" });
    expect(items[0].published).toBe("Mon, 29 Sep 2026 10:00:00 GMT");
  });

  it("parses Atom entries with multiple links and author", () => {
    const xml = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>F</title>
      <entry><title type="html">Release v1</title><id>tag:x,2026:1</id>
      <link rel="alternate" type="text/html" href="https://x.com/r/1"/><link rel="self" href="https://x.com/self"/>
      <published>2026-09-29T01:00:00Z</published><author><name>Bob</name></author><content type="html">&lt;p&gt;Notes&lt;/p&gt;</content></entry></feed>`;
    const items = parseFeed(xml);
    expect(items[0]).toMatchObject({ title: "Release v1", link: "https://x.com/r/1", guid: "tag:x,2026:1", author: "Bob", excerpt: "Notes" });
  });

  it("returns an empty list for a feed with no items", () => {
    expect(parseFeed(rss(""))).toEqual([]);
  });

  it.each([
    ["truncated xml", "<rss><channel><item><title>x"],
    ["html page", "<!doctype html><html><body><h1>Not a feed</h1></body></html>"],
    ["empty body", ""],
  ])("rejects %s as a parse failure", (_n, body) => {
    expect(() => parseFeed(body)).toThrow(FeedParseError);
  });

  it("strips tags from CDATA excerpts and never keeps script content as markup", () => {
    const items = parseFeed(rss(`<item><title>t</title><link>https://a.com/x</link><description><![CDATA[<script>alert(1)</script>Real text]]></description></item>`));
    expect(items[0].excerpt).toBe("Real text");
  });

  it("does not resolve external entities (XXE)", () => {
    const xxe = `<?xml version="1.0"?><!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss><channel><item><title>&x;</title><link>https://a.com/x</link></item></channel></rss>`;
    let out: ReturnType<typeof parseFeed> = [];
    try {
      out = parseFeed(xxe);
    } catch (err) {
      expect(err).toBeInstanceOf(FeedParseError);
    }
    for (const i of out) expect(i.title ?? "").not.toMatch(/root:|\/bin\//);
  });

  it("survives entity expansion bombs quickly", () => {
    const lol = `<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;"><!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;"><!ENTITY d "&c;&c;&c;&c;&c;&c;&c;&c;&c;&c;"><!ENTITY e "&d;&d;&d;&d;&d;&d;&d;&d;&d;&d;"><!ENTITY f "&e;&e;&e;&e;&e;&e;&e;&e;&e;&e;"><!ENTITY g "&f;&f;&f;&f;&f;&f;&f;&f;&f;&f;">]><rss><channel><item><title>&g;</title><link>https://a.com/x</link></item></channel></rss>`;
    const start = Date.now();
    let out: ReturnType<typeof parseFeed> = [];
    try {
      out = parseFeed(lol);
    } catch (err) {
      expect(err).toBeInstanceOf(FeedParseError);
    }
    expect(Date.now() - start).toBeLessThan(1000);
    for (const i of out) expect((i.title ?? "").length).toBeLessThan(10_000);
  });
});

describe("YouTube Atom feeds", () => {
  const yt = (entry: string) =>
    `<?xml version="1.0"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom"><title>Chan</title>${entry}</feed>`;
  const entry = (id: string, desc: string, extra = "") =>
    `<entry><id>yt:video:${id}</id><title>Video ${id}</title><link rel="alternate" href="https://www.youtube.com/watch?v=${id}"/><author><name>Chan</name></author><published>2026-09-29T01:00:00+00:00</published>${extra}<media:group><media:title>Video ${id}</media:title><media:description>${desc}</media:description></media:group></entry>`;

  it("uses media:group > media:description as the excerpt when nothing else is present", () => {
    const items = parseFeed(yt(entry("a1", "Summary line\nhttps://example.com sponsor")));
    expect(items[0]).toMatchObject({ guid: "yt:video:a1", link: "https://www.youtube.com/watch?v=a1", author: "Chan", excerpt: "Summary line https://example.com sponsor" });
  });

  it("prefers a regular summary or content over media:description", () => {
    const items = parseFeed(yt(entry("a2", "media text", "<summary>real summary</summary>")));
    expect(items[0].excerpt).toBe("real summary");
  });

  it("leaves the excerpt null when the media group has no description", () => {
    const xml = yt(`<entry><id>yt:video:a3</id><title>t</title><link rel="alternate" href="https://www.youtube.com/watch?v=a3"/><media:group><media:title>t</media:title></media:group></entry>`);
    expect(parseFeed(xml)[0].excerpt).toBeNull();
  });
});

describe("decodeXml (TC-E-11)", () => {
  it("honours a declared ISO-8859-1 encoding", () => {
    const bytes = Buffer.concat([
      Buffer.from('<?xml version="1.0" encoding="ISO-8859-1"?><rss><channel><item><title>Caf', "ascii"),
      Buffer.from([0xe9]),
      Buffer.from("</title><link>https://a.com/x</link></item></channel></rss>", "ascii"),
    ]);
    const items = parseFeed(decodeXml(bytes, "application/xml"));
    expect(items[0].title).toBe("Café");
  });

  it("falls back to UTF-8", () => {
    expect(decodeXml(Buffer.from("<a>é</a>", "utf8"), undefined)).toBe("<a>é</a>");
  });
});

describe("normalizeItems (I-2.1, TC-E-09)", () => {
  const raw = (over: Partial<Parameters<typeof normalizeItems>[0][number]> = {}) => ({
    guid: null,
    link: "https://openai.com/blog/x",
    title: "Title",
    author: null,
    published: "Tue, 29 Sep 2026 10:00:00 GMT",
    excerpt: null,
    ...over,
  });
  const opts = { sourceSlug: "s", baseUrl: "https://openai.com/", now: NOW };

  it("drops items without a link and reports it", () => {
    const res = normalizeItems([raw({ link: null })], opts);
    expect(res.items).toHaveLength(0);
    expect(res.dropped[0]).toMatch(/missing link/);
  });

  it("uses host+path as the title when missing", () => {
    const res = normalizeItems([raw({ title: null })], opts);
    expect(res.items[0].title).toBe("openai.com/blog/x");
  });

  it("falls back to first_seen_at for missing, unparseable and future dates", () => {
    const res = normalizeItems(
      [
        raw({ link: "https://a.com/1", published: null }),
        raw({ link: "https://a.com/2", published: "not a date" }),
        raw({ link: "https://a.com/3", published: "2027-01-01T00:00:00Z" }),
      ],
      opts,
    );
    for (const i of res.items) expect(i.published_at).toBe(NOW.toISOString());
  });

  it("drops /shorts/ links, from any feed, and keeps the long video with the same title", () => {
    const res = normalizeItems(
      [
        raw({ link: "https://www.youtube.com/watch?v=abc", title: "Introducing X" }),
        raw({ link: "https://www.youtube.com/shorts/xyz", title: "Introducing X" }),
        raw({ link: "https://example.com/blog/shorts-guide", title: "Not a short" }),
      ],
      opts,
    );
    expect(res.items.map((i) => i.url)).toEqual(["https://www.youtube.com/watch?v=abc", "https://example.com/blog/shorts-guide"]);
    expect(res.dropped).toEqual(["s: short-form video https://www.youtube.com/shorts/xyz"]);
  });

  it("resolves relative links against the feed url", () => {
    const res = normalizeItems([raw({ link: "/blog/post-1" })], opts);
    expect(res.items[0].url).toBe("https://openai.com/blog/post-1");
    expect(res.items[0].canonical_url).toBe("https://openai.com/blog/post-1");
  });

  it("truncates long titles and excerpts without splitting a surrogate pair", () => {
    const title = "😀".repeat(400) + "x".repeat(4600);
    const res = normalizeItems([raw({ title, excerpt: "y".repeat(5000) })], opts);
    expect(Array.from(res.items[0].title).length).toBeLessThanOrEqual(500);
    expect(res.items[0].title).not.toMatch(/[\ud800-\udbff]$/);
    expect(Array.from(res.items[0].excerpt ?? "").length).toBeLessThanOrEqual(2000);
  });

  it("rejects non-http(s) links and dedupes by canonical url (first wins)", () => {
    const res = normalizeItems(
      [
        raw({ link: "javascript:alert(1)" }),
        raw({ link: "https://a.com/p?utm_source=x", title: "first" }),
        raw({ link: "https://a.com/p", title: "second" }),
      ],
      opts,
    );
    expect(res.items.map((i) => i.title)).toEqual(["first"]);
    expect(res.dropped.length).toBeGreaterThanOrEqual(1);
  });

  it("stamps first_seen_at and the Manila digest date", () => {
    const res = normalizeItems([raw()], opts);
    expect(res.items[0].first_seen_at).toBe(NOW.toISOString());
    expect(res.items[0].digest_date).toBe("2026-09-30");
    expect(res.items[0].source_slug).toBe("s");
  });
});
