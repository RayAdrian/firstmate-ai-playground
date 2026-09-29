import { Newspaper, SearchX } from "lucide-react";
import type { Metadata } from "next";
import { ResultsHeading } from "@/components/news/archive-client";
import { ArchiveFilters, ClearFiltersLink } from "@/components/news/archive-filters";
import { activeFilterCount, archiveHref, parseArchiveParams, type RawSearchParams } from "@/components/news/archive-params";
import { FilterChips, Pagination } from "@/components/news/archive-results";
import { applyTestHooks } from "@/components/news/clock";
import { NewsCard } from "@/components/news/news-card";
import { getArchive } from "@/components/news/queries";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "News archive · First Mate AI Playground" };

export default async function NewsArchivePage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  await applyTestHooks("news-archive");
  const params = parseArchiveParams(await searchParams);
  const { sources, result } = await getArchive(params);
  const filtered = activeFilterCount(params) > 0 || params.page > 1;
  const resultKey = archiveHref(params);

  const count =
    result.total === 0
      ? "0 items"
      : `${result.total} ${result.total === 1 ? "item" : "items"} · page ${Math.min(result.page, result.pageCount)} of ${result.pageCount}`;

  return (
    <>
      <h1 className="text-3xl font-bold text-fg-strong">News archive</h1>
      <div className="mt-6 lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-3">
          <ArchiveFilters params={params} sources={sources} />
        </div>

        <div className="mt-6 min-w-0 lg:col-span-9 lg:mt-0">
          <p className="text-base text-fg-muted">{count}</p>
          <div className="mt-2">
            <FilterChips params={params} sources={sources} hideClear={result.items.length === 0} />
          </div>

          <div className="mt-4">
            <ResultsHeading key={resultKey}>Results</ResultsHeading>
          </div>

          {result.items.length === 0 ? (
            <div className="mt-3">
              {filtered ? (
                <EmptyState icon={<SearchX />} title="No items match these filters">
                  <p>Try removing a filter or widening the date range.</p>
                  <ClearFiltersLink />
                </EmptyState>
              ) : (
                <EmptyState
                  icon={<Newspaper />}
                  title={
                    <>
                      No news yet. Run <code className="font-mono text-base">npm run news:run</code>.
                    </>
                  }
                  command="npm run news:run"
                />
              )}
            </div>
          ) : (
            <ol className="mt-3 space-y-3 md:space-y-4">
              {result.items.map((item) => (
                <li key={item.id}>
                  <NewsCard
                    item={item}
                    variant={item.status === "scored" && item.score !== null ? "scored" : "unscored"}
                    dateStyle="full"
                  />
                </li>
              ))}
            </ol>
          )}

          <Pagination params={params} result={result} />
        </div>
      </div>
    </>
  );
}
