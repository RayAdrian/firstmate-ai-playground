import * as cheerio from "cheerio";
import { XMLParser, XMLValidator } from "fast-xml-parser";

export class FeedParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedParseError";
  }
}

/** One item as found in the feed, before normalisation. */
export interface RawFeedItem {
  guid: string | null;
  link: string | null;
  title: string | null;
  author: string | null;
  /** Raw date string as published; parsed in normalize. */
  published: string | null;
  /** Plain text (tags stripped), not yet length-capped. */
  excerpt: string | null;
}

/** Decode feed bytes honouring the XML prolog / Content-Type charset; UTF-8 by default. */
export function decodeXml(bytes: Uint8Array, contentType: string | undefined): string {
  const head = Buffer.from(bytes.subarray(0, 200)).toString("latin1");
  const declared = /<\?xml[^>]*encoding=["']([A-Za-z0-9_.:-]+)["']/i.exec(head)?.[1];
  const header = contentType ? /charset=["']?([A-Za-z0-9_.:-]+)/i.exec(contentType)?.[1] : undefined;
  for (const label of [declared, header]) {
    if (!label) continue;
    try {
      return new TextDecoder(label).decode(bytes);
    } catch {
      // unknown label: try the next one
    }
  }
  return new TextDecoder("utf-8").decode(bytes);
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => name === "item" || name === "entry" || name === "link",
});

type XmlNode = string | number | { "#text"?: unknown; [key: string]: unknown } | undefined | null;

function text(node: XmlNode): string | null {
  if (node === undefined || node === null) return null;
  if (typeof node === "string" || typeof node === "number") return String(node).trim() || null;
  const inner = node["#text"];
  return typeof inner === "string" || typeof inner === "number" ? String(inner).trim() || null : null;
}

/** Strip markup to plain text. Script and style content is dropped, never kept. */
export function htmlToText(html: string): string {
  const $ = cheerio.load(`<div>${html}</div>`, undefined, false);
  $("script, style, noscript, template").remove();
  return $.root().text().replace(/\s+/g, " ").trim();
}

function linkOf(links: unknown): string | null {
  const list = Array.isArray(links) ? (links as XmlNode[]) : links === undefined ? [] : [links as XmlNode];
  let fallback: string | null = null;
  for (const l of list) {
    if (typeof l === "string") {
      // RSS: <link>url</link>
      return l.trim() || null;
    }
    if (l && typeof l === "object") {
      const href = typeof l["@_href"] === "string" ? (l["@_href"] as string) : null;
      const rel = typeof l["@_rel"] === "string" ? (l["@_rel"] as string) : "alternate";
      if (href && rel === "alternate") return href;
      if (href && !fallback && rel !== "self") fallback = href;
      const t = text(l);
      if (t && !href) return t;
    }
  }
  return fallback;
}

function authorOf(item: Record<string, unknown>): string | null {
  const dc = text(item["dc:creator"] as XmlNode);
  if (dc) return dc;
  const author = item["author"] as XmlNode | { name?: XmlNode };
  if (author && typeof author === "object" && "name" in author) return text((author as { name?: XmlNode }).name ?? null);
  return text(author as XmlNode);
}

/** Parse an RSS 2.0, RSS 1.0 (RDF) or Atom document. Throws FeedParseError for anything else. */
export function parseFeed(xml: string): RawFeedItem[] {
  if (xml.trim().length === 0) throw new FeedParseError("empty response body");
  if (/<!ENTITY/i.test(xml)) throw new FeedParseError("entity declarations are not allowed");
  const valid = XMLValidator.validate(xml);
  if (valid !== true) throw new FeedParseError(`invalid XML: ${valid.err.msg}`);

  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch {
    throw new FeedParseError("XML parse error");
  }

  let entries: Array<Record<string, unknown>>;
  const rss = doc["rss"] as { channel?: { item?: unknown } } | undefined;
  const rdf = doc["rdf:RDF"] as { item?: unknown } | undefined;
  const atom = doc["feed"] as { entry?: unknown } | undefined;
  if (rss && typeof rss === "object") {
    entries = toObjects((rss.channel as { item?: unknown } | undefined)?.item);
  } else if (rdf && typeof rdf === "object") {
    entries = toObjects(rdf.item);
  } else if (atom && typeof atom === "object") {
    entries = toObjects(atom.entry);
  } else {
    throw new FeedParseError("not an RSS or Atom feed");
  }

  return entries.map((e) => {
    const body = text(e["content:encoded"] as XmlNode) ?? text(e["description"] as XmlNode) ?? text(e["summary"] as XmlNode) ?? text(e["content"] as XmlNode);
    const guidNode = (e["guid"] ?? e["id"]) as XmlNode;
    return {
      guid: text(guidNode),
      link: linkOf(e["link"]),
      title: cleanTitle(text(e["title"] as XmlNode)),
      author: authorOf(e),
      published: text((e["pubDate"] ?? e["published"] ?? e["updated"] ?? e["dc:date"]) as XmlNode),
      excerpt: body ? htmlToText(body) || null : null,
    };
  });
}

function cleanTitle(title: string | null): string | null {
  if (!title) return null;
  return htmlToText(title) || null;
}

function toObjects(v: unknown): Array<Record<string, unknown>> {
  if (v === undefined || v === null) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null);
}
