import { scoredItemSchema, type ScoredItem } from "@/lib/contracts";

/**
 * Extract every complete top-level `{...}` object from model output, tolerating code fences, prose around the
 * array and a truncated tail. Only balanced objects that `JSON.parse` accepts are returned.
 */
export function extractJsonObjects(text: string): unknown[] {
  const out: unknown[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      if (depth > 0) inString = true;
    } else if (c === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "}" && depth > 0) {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          out.push(JSON.parse(text.slice(start, i + 1)));
        } catch {
          // skip a malformed object, keep scanning
        }
        start = -1;
      }
    }
  }
  return out;
}

export interface ParsedScoring {
  /** Items with a valid result, one per batch id. */
  scored: ScoredItem[];
  /** Batch ids with no valid result (missing, invalid or duplicated). */
  unscored: string[];
  /** True when no JSON object could be read at all. */
  parseError: boolean;
}

/**
 * Validate model output against the scoring contract, per item (I-3.2, I-4.2). Ids outside the batch are
 * ignored; an id returned more than once is invalid (never "last write wins"); tags are de-duplicated.
 */
export function parseScoringOutput(text: string, batchIds: readonly string[]): ParsedScoring {
  const objects = extractJsonObjects(text);
  const inBatch = new Set(batchIds);
  const counts = new Map<string, number>();
  const valid = new Map<string, ScoredItem>();

  for (const obj of objects) {
    const id = typeof (obj as { id?: unknown } | null)?.id === "string" ? (obj as { id: string }).id : null;
    if (id === null || !inBatch.has(id)) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
    const parsed = scoredItemSchema.safeParse(obj);
    // Count code points, not UTF-16 units, for the 280 limit.
    if (parsed.success && Array.from(parsed.data.why).length <= 280) {
      valid.set(id, { ...parsed.data, tags: [...new Set(parsed.data.tags)] });
    }
  }

  const scored: ScoredItem[] = [];
  const unscored: string[] = [];
  for (const id of batchIds) {
    const item = valid.get(id);
    if ((counts.get(id) ?? 0) === 1 && item) scored.push(item);
    else unscored.push(id);
  }
  return { scored, unscored, parseError: objects.length === 0 };
}
