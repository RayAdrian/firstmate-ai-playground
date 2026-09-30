import { canonicalize, InvalidUrlError } from "./canonical";
import type { RawFeedItem } from "./feed";
import { digestDate } from "./time";

export const TITLE_MAX = 500;
export const EXCERPT_MAX = 2000;

/** A fetched, normalised item ready to store (snake_case to match the DB and snapshot contract). */
export interface Candidate {
  source_slug: string;
  guid: string | null;
  canonical_url: string;
  url: string;
  title: string;
  author: string | null;
  published_at: string;
  first_seen_at: string;
  digest_date: string;
  excerpt: string | null;
}

/** Truncate to `max` code points (never splits a surrogate pair). */
export function truncateCodePoints(s: string, max: number): string {
  const chars = Array.from(s);
  return chars.length <= max ? s : chars.slice(0, max).join("");
}

function stripControl(s: string): string {
  return s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
}

export interface NormalizeOptions {
  sourceSlug: string;
  /** Base for resolving relative links (the feed url). */
  baseUrl: string;
  now: Date;
}

/**
 * Normalise raw feed items (AMB-E7): missing link drops the item; missing title falls back to host+path;
 * missing, unparseable or future dates become first_seen_at; text is length-capped. Duplicates by canonical
 * url within the feed keep the first.
 */
export function normalizeItems(raw: RawFeedItem[], opts: NormalizeOptions): { items: Candidate[]; dropped: string[] } {
  const firstSeen = opts.now.toISOString();
  const seen = new Set<string>();
  const items: Candidate[] = [];
  const dropped: string[] = [];

  for (const r of raw) {
    if (!r.link) {
      dropped.push(`${opts.sourceSlug}: missing link`);
      continue;
    }
    let absolute: string;
    let canonical: string;
    try {
      absolute = new URL(r.link, opts.baseUrl).toString();
      canonical = canonicalize(absolute);
    } catch (err) {
      dropped.push(`${opts.sourceSlug}: ${err instanceof InvalidUrlError ? "invalid link" : "unresolvable link"}`);
      continue;
    }
    if (seen.has(canonical)) {
      dropped.push(`${opts.sourceSlug}: duplicate ${canonical}`);
      continue;
    }
    seen.add(canonical);

    const parsedUrl = new URL(canonical);
    const title = stripControl(r.title ?? "") || `${parsedUrl.host}${parsedUrl.pathname}`;

    let publishedAt = firstSeen;
    if (r.published) {
      const t = new Date(r.published).getTime();
      if (!Number.isNaN(t) && t <= opts.now.getTime()) publishedAt = new Date(t).toISOString();
    }

    const excerpt = r.excerpt ? stripControl(r.excerpt) : "";
    items.push({
      source_slug: opts.sourceSlug,
      guid: r.guid ? truncateCodePoints(r.guid, 1000) : null,
      canonical_url: canonical,
      url: absolute,
      title: truncateCodePoints(title, TITLE_MAX),
      author: r.author ? truncateCodePoints(stripControl(r.author), 200) || null : null,
      published_at: publishedAt,
      first_seen_at: firstSeen,
      digest_date: digestDate(opts.now),
      excerpt: excerpt ? truncateCodePoints(excerpt, EXCERPT_MAX) : null,
    });
  }
  return { items, dropped };
}
