import { Newspaper } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { applyTestHooks, getNow } from "@/components/news/clock";
import { formatDigestDay, formatTime } from "@/components/news/dates";
import { NewsCard } from "@/components/news/news-card";
import { getDigest, RELEVANCE_BAR } from "@/components/news/queries";
import { UnscoredSection } from "@/components/news/unscored-section";
import { CommandLine, EmptyState, Notice } from "@/components/ui";

// Content must show without a rebuild (AGENTS.md): always render on request.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "News · First Mate AI Playground" };

const RUN_COMMAND = "npm run news:run";

export default async function NewsPage() {
  await applyTestHooks("news");
  const digest = await getDigest(await getNow(), { withUnscored: true });

  if (digest.kind === "none") {
    return (
      <>
        <h1 className="text-3xl font-bold text-fg-strong">Today&apos;s digest</h1>
        <div className="mt-6">
          <EmptyState
            icon={<Newspaper />}
            title={
              <>
                No news yet. Run <code className="font-mono text-base">npm run news:run</code>.
              </>
            }
            command={RUN_COMMAND}
          />
        </div>
      </>
    );
  }

  const title = digest.stale ? "Latest digest" : "Today's digest";
  const day = formatDigestDay(digest.digestDate);
  const archiveLink = (
    <Link
      href="/news/archive"
      className="inline-flex min-h-11 items-center font-medium text-link underline underline-offset-2"
    >
      Browse archive
    </Link>
  );

  return (
    <div className="lg:grid lg:grid-cols-12 lg:gap-8">
      <section aria-labelledby="digest-title" className="min-w-0 lg:col-span-8">
        {digest.stale ? (
          <Notice tone="warning" live={false} title={`No digest yet today. Showing ${day}`} className="mb-4">
            <p>Run the pipeline to fetch today&apos;s news.</p>
            <CommandLine command={RUN_COMMAND} className="mt-3" />
          </Notice>
        ) : null}

        <h1 id="digest-title" className="text-3xl font-bold text-fg-strong">
          {title}
        </h1>
        <p className="mt-1 text-base text-fg-muted">
          <time dateTime={digest.digestDate}>{day}</time> · updated {formatTime(digest.updatedAt)}
          <span className="hidden lg:inline">
            {" "}
            · {digest.ranked.length} {digest.ranked.length === 1 ? "item" : "items"} ≥ {RELEVANCE_BAR}
          </span>
        </p>
        <div className="lg:hidden">{archiveLink}</div>

        <h2 className="sr-only">Ranked items</h2>
        {digest.ranked.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={<Newspaper />}
              title="Nothing above the relevance bar today"
              action={{
                label: "See today's items in the archive",
                href: `/news/archive?from=${digest.digestDate}&to=${digest.digestDate}&min=0`,
              }}
            >
              {digest.scoredCount === 0
                ? "Today's run found no scored items."
                : `Today's run found ${digest.scoredCount} ${digest.scoredCount === 1 ? "item" : "items"}, all scored below ${RELEVANCE_BAR}.`}
            </EmptyState>
          </div>
        ) : (
          <ol aria-label={title} className="mt-4 space-y-3 md:space-y-4">
            {digest.ranked.map((item) => (
              <li key={item.id}>
                <NewsCard item={item} />
              </li>
            ))}
          </ol>
        )}

        {digest.unscored.length > 0 ? (
          <UnscoredSection count={digest.unscored.length}>
            <ul className="space-y-3">
              {digest.unscored.map((item) => (
                <li key={item.id}>
                  <NewsCard item={item} variant="unscored" />
                </li>
              ))}
            </ul>
          </UnscoredSection>
        ) : null}
      </section>

      <div className="mt-8 hidden lg:col-span-4 lg:mt-0 lg:block">
        <div className="rounded-card bg-surface p-6">
          <p className="text-xs font-bold uppercase tracking-eyebrow text-fg-muted">About the digest</p>
          <p className="mt-2 text-base text-fg">
            Scored daily at about 08:00 Manila for relevance to First Mate work. Only items scoring{" "}
            {RELEVANCE_BAR} or higher appear in the ranked list.
          </p>
          <div className="mt-2">{archiveLink}</div>
        </div>
      </div>
    </div>
  );
}
