import { parseAnthropicNews } from "./anthropic";
import { decodeXml, parseFeed, type RawFeedItem } from "./feed";
import { fetchBytes, type FetchOptions } from "./http";
import type { SourceConfig } from "./sources";

/** Fetch and parse one configured source. Throws FetchError / FeedParseError, which the pipeline reports per source. */
export async function fetchSource(source: SourceConfig, options: FetchOptions = {}): Promise<RawFeedItem[]> {
  const { bytes, contentType } = await fetchBytes(source.url, options);
  const text = decodeXml(bytes, contentType);
  // type "html" is the Anthropic newsroom scraper (PRD section 14, Q3).
  return source.type === "html" ? parseAnthropicNews(text, source.url) : parseFeed(text);
}
