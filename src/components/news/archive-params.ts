// Pure parsing/serialising of the /news/archive URL state (PRD N-4.1). Bad input degrades to defaults.
import { NEWS_TAGS, type NewsTag } from "@/lib/contracts";
import { isIsoDate } from "./dates";

export const ARCHIVE_PAGE_SIZE = 25;
export const MIN_SCORES = [0, 40, 60, 80] as const;
export type MinScore = (typeof MIN_SCORES)[number];

export type ArchiveParams = {
  tags: NewsTag[];
  min: MinScore;
  /** Source slug, or "" for all sources. */
  source: string;
  /** Valid ISO dates, or null when absent or malformed. Both null when the range is inverted. */
  from: string | null;
  to: string | null;
  page: number;
  /** from and to were both valid but from > to. The dates are then not applied. */
  dateError: boolean;
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

function all(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function first(value: string | string[] | undefined): string {
  return all(value)[0] ?? "";
}

export function parseArchiveParams(raw: RawSearchParams): ArchiveParams {
  const requested = new Set(all(raw.tag));
  // Fixed order, unknown tags dropped.
  const tags = NEWS_TAGS.filter((t) => requested.has(t));

  const minRaw = Number(first(raw.min));
  const min = (MIN_SCORES as readonly number[]).includes(minRaw) ? (minRaw as MinScore) : 0;

  const sourceRaw = first(raw.source);
  const source = SLUG.test(sourceRaw) ? sourceRaw : "";

  const fromRaw = first(raw.from);
  const toRaw = first(raw.to);
  let from = isIsoDate(fromRaw) ? fromRaw : null;
  let to = isIsoDate(toRaw) ? toRaw : null;
  let dateError = false;
  if (from && to && from > to) {
    dateError = true;
    from = null;
    to = null;
  }

  const pageRaw = first(raw.page);
  const pageNum = /^\d{1,6}$/.test(pageRaw) ? Number(pageRaw) : 1;
  const page = pageNum >= 1 ? pageNum : 1;

  return { tags, min, source, from, to, page, dateError };
}

/** Number of filters that narrow the result set (the count in "Filters (3)"). */
export function activeFilterCount(p: ArchiveParams): number {
  return p.tags.length + (p.min > 0 ? 1 : 0) + (p.source ? 1 : 0) + (p.from ? 1 : 0) + (p.to ? 1 : 0);
}

/** URL for the given params, omitting defaults. */
export function archiveHref(p: Partial<ArchiveParams>): string {
  const q = new URLSearchParams();
  for (const t of p.tags ?? []) q.append("tag", t);
  if (p.min) q.set("min", String(p.min));
  if (p.source) q.set("source", p.source);
  if (p.from) q.set("from", p.from);
  if (p.to) q.set("to", p.to);
  if (p.page && p.page > 1) q.set("page", String(p.page));
  const s = q.toString();
  return s ? `/news/archive?${s}` : "/news/archive";
}
