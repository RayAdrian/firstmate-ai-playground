import fs from "node:fs";
import path from "node:path";
import { newsSnapshotSchema, SNAPSHOT_VERSION, type NewsSnapshot } from "@/lib/contracts";
import type { NewsStore } from "./types";

/** Build and validate the snapshot for one digest date (PRD section 14, Q1). Items sorted by canonical_url for stable diffs. */
export async function buildSnapshot(store: NewsStore, digestDate: string, exportedAt: Date): Promise<NewsSnapshot> {
  const { runs, items } = await store.snapshotFor(digestDate);
  return newsSnapshotSchema.parse({
    version: SNAPSHOT_VERSION,
    digest_date: digestDate,
    exported_at: exportedAt.toISOString(),
    runs,
    items: [...items].sort((a, b) => (a.canonical_url < b.canonical_url ? -1 : a.canonical_url > b.canonical_url ? 1 : 0)),
  });
}

export function serializeSnapshot(snapshot: NewsSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

/** AMB-E30: two serialised snapshots are "the same" when only exported_at differs. */
export function sameIgnoringExportedAt(a: string, b: string): boolean {
  try {
    const strip = (s: string) => {
      const o = JSON.parse(s) as Record<string, unknown>;
      delete o.exported_at;
      return JSON.stringify(o);
    };
    return strip(a) === strip(b);
  } catch {
    return false;
  }
}

export interface SnapshotFile {
  digestDate: string;
  relPath: string;
  content: string;
}

export async function buildSnapshotFiles(store: NewsStore, digestDates: readonly string[], exportedAt: Date): Promise<SnapshotFile[]> {
  const files: SnapshotFile[] = [];
  for (const d of [...new Set(digestDates)].sort()) {
    const snap = await buildSnapshot(store, d, exportedAt);
    files.push({ digestDate: d, relPath: `content/news/snapshots/${d}.json`, content: serializeSnapshot(snap) });
  }
  return files;
}

/** Write snapshot files under `baseDir` (local staging copy; never inside the user's checkout by default). */
export function writeSnapshotFiles(baseDir: string, files: readonly SnapshotFile[]): string[] {
  return files.map((f) => {
    const target = path.join(baseDir, `${f.digestDate}.json`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, f.content);
    return target;
  });
}
