import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { ClearFiltersLink } from "./archive-filters";
import { FocusResultsLinks } from "./archive-client";
import { activeFilterCount, archiveHref, type ArchiveParams } from "./archive-params";
import type { ArchivePage } from "./queries";
import { TAG_LABEL } from "./tag-labels";

const chipClass =
  "inline-flex min-h-6 items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-link pointer-coarse:min-h-11 pointer-coarse:px-4";

/** Active filters as removable chips. Each is a link to the current URL minus that param, so it works without JS. */
export function FilterChips({
  params,
  sources,
  hideClear,
}: {
  params: ArchiveParams;
  sources: { slug: string; name: string }[];
  hideClear: boolean;
}) {
  if (activeFilterCount(params) === 0) return null;
  const chips: { key: string; text: string; href: string }[] = [];
  for (const tag of params.tags) {
    chips.push({
      key: `tag-${tag}`,
      text: TAG_LABEL[tag],
      href: archiveHref({ ...params, tags: params.tags.filter((t) => t !== tag), page: 1 }),
    });
  }
  if (params.min > 0) chips.push({ key: "min", text: `Min ${params.min}`, href: archiveHref({ ...params, min: 0, page: 1 }) });
  if (params.source) {
    const name = sources.find((s) => s.slug === params.source)?.name ?? params.source;
    chips.push({ key: "source", text: name, href: archiveHref({ ...params, source: "", page: 1 }) });
  }
  if (params.from) chips.push({ key: "from", text: `From ${params.from}`, href: archiveHref({ ...params, from: null, page: 1 }) });
  if (params.to) chips.push({ key: "to", text: `To ${params.to}`, href: archiveHref({ ...params, to: null, page: 1 }) });

  return (
    <FocusResultsLinks className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <Link key={c.key} href={c.href} prefetch={false} className={chipClass}>
          <span className="sr-only">Remove filter: </span>
          {c.text}
          <X aria-hidden="true" className="size-3" />
        </Link>
      ))}
      {hideClear ? null : <ClearFiltersLink />}
    </FocusResultsLinks>
  );
}

/** Numbers to show: first, last, and the current page with one neighbour each side. */
function pageWindow(page: number, count: number): (number | "gap")[] {
  const keep = new Set([1, count, page - 1, page, page + 1].filter((n) => n >= 1 && n <= count));
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - (sorted[i - 1] ?? n) > 1) out.push("gap");
    out.push(n);
  });
  return out;
}

const pageLink =
  "inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg px-2 text-base font-medium text-link hover:bg-accent-soft pointer-coarse:min-h-11 pointer-coarse:min-w-11";

export function Pagination({ params, result }: { params: ArchiveParams; result: ArchivePage }) {
  if (result.pageCount <= 1) return null;
  const { page, pageCount } = result;
  const href = (n: number) => archiveHref({ ...params, page: n });
  return (
    <FocusResultsLinks as="nav" className="mt-6 flex flex-wrap items-center justify-center gap-1">
      {page > 1 ? (
        <Link href={href(page - 1)} prefetch={false} aria-label="Previous page" className={`${pageLink} gap-1 pr-3`}>
          <ChevronLeft aria-hidden="true" className="size-4" />
          Prev
        </Link>
      ) : null}
      <span className="px-3 text-base text-fg-muted sm:hidden">
        Page {page} of {pageCount}
      </span>
      <span className="hidden items-center gap-1 sm:flex">
        {pageWindow(page, pageCount).map((n, i) =>
          n === "gap" ? (
            <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-fg-muted">
              …
            </span>
          ) : n === page ? (
            <span
              key={n}
              aria-current="page"
              className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg bg-accent-soft px-2 text-base font-bold text-fg-strong"
            >
              {n}
            </span>
          ) : (
            <Link key={n} href={href(n)} prefetch={false} aria-label={`Page ${n}`} className={pageLink}>
              {n}
            </Link>
          ),
        )}
      </span>
      {page < pageCount ? (
        <Link href={href(page + 1)} prefetch={false} aria-label="Next page" className={`${pageLink} gap-1 pl-3`}>
          Next
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
    </FocusResultsLinks>
  );
}
