import * as cheerio from "cheerio";
import { FeedParseError, type RawFeedItem } from "./feed";

const NEWS_HREF = /^\/news\/[a-z0-9][a-z0-9-]*\/?$/i;

/**
 * Scrape anthropic.com/news (PRD section 14, Q3). The site ships hashed CSS class names, so the parser keys off
 * stable structure only: anchors to /news/<slug>, a <time> for the date, and a title-ish element inside the anchor.
 * Zero cards means the layout changed, which is reported as a source failure (AMB-E9), never as "0 new items".
 */
export function parseAnthropicNews(html: string, baseUrl: string): RawFeedItem[] {
  const $ = cheerio.load(html);
  const byUrl = new Map<string, RawFeedItem>();

  $("a[href]").each((_, el) => {
    const anchor = $(el);
    let href = anchor.attr("href") ?? "";
    let absolute: URL;
    try {
      absolute = new URL(href, baseUrl);
    } catch {
      return;
    }
    href = absolute.pathname;
    if (absolute.origin !== new URL(baseUrl).origin || !NEWS_HREF.test(href)) return;

    const title = cardTitle($, anchor);
    if (!title) return;
    const link = `${absolute.origin}${href.replace(/\/$/, "")}`;
    if (byUrl.has(link)) return;

    const time = anchor.find("time").first();
    const dateText = time.attr("datetime") ?? time.text();
    const published = parseCardDate(dateText);

    byUrl.set(link, { guid: null, link, title, author: null, published, excerpt: null });
  });

  const items = [...byUrl.values()];
  if (items.length === 0) throw new FeedParseError("no article cards found (page layout may have changed)");
  return items;
}

function cardTitle($: cheerio.CheerioAPI, anchor: cheerio.Cheerio<import("domhandler").Element>): string | null {
  const explicit = anchor.find('[class*="title" i], h1, h2, h3, h4').first().text().replace(/\s+/g, " ").trim();
  if (explicit) return explicit;
  // Fallback: the longest text node-bearing element that is not the date or category.
  let best = "";
  anchor.find("span, p, div").each((_, el) => {
    const node = $(el);
    if (node.find("time").length > 0 || node.is("time")) return;
    if (node.children().length > 0) return;
    const t = node.text().replace(/\s+/g, " ").trim();
    if (t.length > best.length) best = t;
  });
  return best || null;
}

function parseCardDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00Z` : /^[A-Za-z]{3,9} \d{1,2}, \d{4}$/.test(s) ? `${s} 00:00:00 UTC` : s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}
