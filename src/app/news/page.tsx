import { AlertTriangle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { applyTestHooks, getNow } from "@/components/news/clock";
import { CopyCommand } from "@/components/news/copy-command";
import { formatDigestDay, formatTime } from "@/components/news/dates";
import { NewsCard } from "@/components/news/news-card";
import { NewsEmpty } from "@/components/news/news-empty";
import { getDigest, RELEVANCE_BAR } from "@/components/news/queries";
import { UnscoredSection } from "@/components/news/unscored-section";

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
          <NewsEmpty
            title={
              <>
                No news yet. Run <code className="font-mono text-base">npm run news:run</code>.
              </>
            }
          >
            <CopyCommand command={RUN_COMMAND} />
          </NewsEmpty>
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
          <div className="mb-4 flex gap-3 rounded-lg bg-warning-soft p-4">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
            <div className="min-w-0">
              <p className="font-bold text-warning">No digest yet today. Showing {day}</p>
              <p className="text-base text-fg">Run the pipeline to fetch today&apos;s news.</p>
              <CopyCommand command={RUN_COMMAND} />
            </div>
          </div>
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
            <NewsEmpty title="Nothing above the relevance bar today">
              <p className="mt-1 text-base text-fg-muted">
                {digest.scoredCount === 0
                  ? "Today's run found no scored items."
                  : `Today's run found ${digest.scoredCount} ${digest.scoredCount === 1 ? "item" : "items"}, all scored below ${RELEVANCE_BAR}.`}
              </p>
              <Link
                href={`/news/archive?from=${digest.digestDate}&to=${digest.digestDate}&min=0`}
                className="mt-3 inline-flex min-h-11 items-center font-medium text-link underline underline-offset-2"
              >
                See today&apos;s items in the archive
              </Link>
            </NewsEmpty>
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
