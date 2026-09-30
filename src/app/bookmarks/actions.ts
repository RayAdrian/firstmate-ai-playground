"use server";

import { z } from "zod";
import { dbRead, isConnectionFailure } from "@/lib/db";
import { getReadClient } from "@/lib/db/server";

/** What /bookmarks needs to show a bookmarked news item. */
export type NewsBookmarkItem = {
  id: string;
  title: string;
  /** http(s) only; anything else is dropped so the UI never links to it. */
  url: string | null;
  sourceName: string | null;
  publishedAt: string | null;
};

export type ResolveNewsResult =
  | { status: "ok"; items: NewsBookmarkItem[] }
  | { status: "db-unavailable" }
  | { status: "error" };

const MAX_IDS = 1000;
const CHUNK = 100; // keeps each PostgREST request well under the URL length limit
const idsSchema = z.array(z.string());
const uuidSchema = z.guid();

function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Resolve bookmarked news ids against the DB. Ids that are not found are simply absent from
 * `items` (the UI shows "Item no longer available"). A database outage is reported as
 * `db-unavailable`, never as "not found", so a down DB is not read as deleted items.
 * The ids come from the browser and are untrusted: validated as UUIDs before querying.
 */
export async function resolveNewsBookmarks(ids: string[]): Promise<ResolveNewsResult> {
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { status: "error" };
  // Ids that are not UUIDs (or are excessive) are dropped: they show as "no longer available".
  const valid = [
    ...new Set(parsed.data.slice(0, MAX_IDS).filter((id) => uuidSchema.safeParse(id).success)),
  ];
  if (valid.length === 0) return { status: "ok", items: [] };
  try {
    const db = getReadClient();
    const chunks: string[][] = [];
    for (let i = 0; i < valid.length; i += CHUNK) chunks.push(valid.slice(i, i + CHUNK));
    const rows = (
      await Promise.all(
        chunks.map((chunk) =>
          dbRead(db.from("news_items").select("id,title,url,published_at,source_id").in("id", chunk)),
        ),
      )
    ).flat();
    const sourceIds = [...new Set(rows.map((row) => row.source_id))];
    const sources =
      sourceIds.length === 0
        ? []
        : await dbRead(db.from("news_sources").select("id,name").in("id", sourceIds));
    const sourceName = new Map(sources.map((s) => [s.id, s.name]));
    return {
      status: "ok",
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        url: safeHttpUrl(row.url),
        sourceName: sourceName.get(row.source_id) ?? null,
        publishedAt: row.published_at,
      })),
    };
  } catch (err) {
    return isConnectionFailure(err) ? { status: "db-unavailable" } : { status: "error" };
  }
}
