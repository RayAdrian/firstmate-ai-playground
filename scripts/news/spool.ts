import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Candidate } from "./normalize";

const httpUrl = z.url({ protocol: /^https?$/ });
const spoolLineSchema = z.object({
  source_slug: z.string().min(1),
  guid: z.string().nullable(),
  canonical_url: httpUrl,
  url: httpUrl,
  title: z.string().min(1),
  author: z.string().nullable(),
  published_at: z.string().datetime({ offset: true }),
  first_seen_at: z.string().datetime({ offset: true }),
  digest_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  excerpt: z.string().nullable(),
});

/** Write fetched items to `<dir>/<timestamp>.jsonl`, one JSON object per line (I-4.4). */
export function writeSpool(dir: string, items: readonly Candidate[], at: Date): string {
  fs.mkdirSync(dir, { recursive: true });
  const stamp = at.toISOString().replace(/[:.]/g, "-");
  let file = path.join(dir, `${stamp}.jsonl`);
  for (let n = 1; fs.existsSync(file); n++) file = path.join(dir, `${stamp}-${n}.jsonl`);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, items.map((i) => JSON.stringify(i)).join("\n") + "\n");
  fs.renameSync(tmp, file);
  return file;
}

/** Spool files awaiting replay, oldest first. `.rejected` and `.tmp` files are ignored. */
export function listSpoolFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .sort()
    .map((f) => path.join(dir, f));
}

export interface SpoolRead {
  items: Candidate[];
  bad: Array<{ line: number; reason: string }>;
}

/** Read a spool file, isolating corrupt lines (AMB-E19). Lines are validated, so a tampered spool cannot inject non-http urls. */
export function readSpoolFile(file: string): SpoolRead {
  const items: Candidate[] = [];
  const bad: SpoolRead["bad"] = [];
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.forEach((raw, idx) => {
    if (raw.trim() === "") return;
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      bad.push({ line: idx + 1, reason: "invalid JSON" });
      return;
    }
    const parsed = spoolLineSchema.safeParse(json);
    if (!parsed.success) {
      bad.push({ line: idx + 1, reason: `invalid item (${parsed.error.issues[0]?.path.join(".") ?? "?"})` });
      return;
    }
    items.push(parsed.data);
  });
  return { items, bad };
}

export function removeSpoolFile(file: string): void {
  fs.unlinkSync(file);
}

/** Quarantine a file with bad lines so it is not replayed forever. */
export function rejectSpoolLines(file: string, badLines: readonly number[]): string {
  const rejected = `${file}.rejected`;
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const bad = new Set(badLines);
  fs.appendFileSync(rejected, lines.filter((_, i) => bad.has(i + 1)).join("\n") + "\n");
  return rejected;
}
