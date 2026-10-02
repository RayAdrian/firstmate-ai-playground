import { Newspaper } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { applyTestHooks } from "@/components/news/clock";
import { formatDigestDay, formatTime } from "@/components/news/dates";
import { NewsCard } from "@/components/news/news-card";
import { ShowToggle } from "@/components/news/show-toggle";
import { DayStepper } from "@/components/news/day-stepper";
import { neighborDates, parseDigestDateParam, parseShowParam, digestDayHref } from "@/components/news/day-nav";
import { getDigest, getDigestDates, RELEVANCE_BAR } from "@/components/news/queries";
import { getNow, manilaDate } from "@/lib/time/now";
import { UnscoredSection } from "@/components/news/unscored-section";
import { CommandLine, EmptyState, Notice } from "@/components/ui";
import { buttonClasses } from "@/components/ui/button-styles";

// Content must show without a rebuild (AGENTS.md): always render on request.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "News · First Mate AI Playground" };

const RUN_COMMAND = "npm run news:run";

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await applyTestHooks("news");
  const now = await getNow();
  const today = manilaDate(now);
  const sp = await searchParams;
  const param = parseDigestDateParam(sp.date, today);
  const show = parseShowParam(sp.show);
  const requested = param.kind === "date" ? param.date : null;
  const [digest, digestDates] = await Promise.all([
    getDigest(now, { withUnscored: true, date: requested ?? undefined }),
    getDigestDates(now),
  ]);
  const badDate = param.kind === "invalid" || param.kind === "future";

  if (requested && digest.kind === "none") {
    const day = formatDigestDay(requested);
    const { prev, next } = neighborDates(digestDates, requested);
    return (
      <>
        <h1 className="text-3xl font-bold text-fg-strong md:text-4xl">
          {requested === today ? "Today's digest" : `Digest for ${day}`}
        </h1>
        <DayStepper current={requested} prev={prev} next={next} show={show} />
        <div className="mt-4">
          <EmptyState icon={<Newspaper />} title={`No digest for ${day}`}>
            There was no successful news run that day. Use the links above to jump to the nearest day with a digest.
          </EmptyState>
        </div>
        <div className="mt-2">
          <Link
            href="/news/archive"
            className="inline-flex min-h-11 items-center font-medium text-link underline underline-offset-2"
          >
            Browse archive
          </Link>
        </div>
      </>
    );
  }

  if (digest.kind === "none") {
    return (
      <>
        <h1 className="text-3xl font-bold text-fg-strong md:text-4xl">Today&apos;s digest</h1>
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

  const isToday = digest.digestDate === today;
  const title = requested
    ? isToday
      ? "Today's digest"
      : `Digest for ${formatDigestDay(digest.digestDate)}`
    : digest.stale
      ? "Latest digest"
      : "Today's digest";
  const day = formatDigestDay(digest.digestDate);
  const { prev, next } = neighborDates(digestDates, digest.digestDate);
  const when = isToday ? "today" : "this day";
  const scoredAll = digest.scoredAll ?? digest.ranked;
  const aboveBar = scoredAll.filter((i) => (i.score ?? 0) >= RELEVANCE_BAR);
  const belowBar = scoredAll.filter((i) => (i.score ?? 0) < RELEVANCE_BAR);
  const shownAbove = show === "all" ? aboveBar : digest.ranked;
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
        {badDate ? (
          <Notice
            tone="warning"
            live={false}
            title={
              param.kind === "future"
                ? "That day hasn't happened yet. Showing the latest digest"
                : "That isn't a valid date. Showing the latest digest"
            }
            className="mb-4"
          >
            <p>Use the day links below to browse earlier digests.</p>
          </Notice>
        ) : null}
        {digest.stale ? (
          <Notice tone="warning" live={false} title={`No digest yet today. Showing ${day}`} className="mb-4">
            <p>Run the pipeline to fetch today&apos;s news.</p>
            <CommandLine command={RUN_COMMAND} className="mt-3" />
          </Notice>
        ) : null}

        <h1 id="digest-title" className="text-3xl font-bold text-fg-strong md:text-4xl">
          {title}
        </h1>
        <p className="mt-1 text-base text-fg-muted">
          <time dateTime={digest.digestDate}>{day}</time> · updated {formatTime(digest.updatedAt)}
          <span className="hidden lg:inline">
            {" "}
            · {digest.ranked.length} {digest.ranked.length === 1 ? "item" : "items"} ≥ {RELEVANCE_BAR}
          </span>
        </p>
        <DayStepper current={digest.digestDate} prev={prev} next={next} show={show} />
        <div className="lg:hidden">{archiveLink}</div>

        <ShowToggle
          date={requested}
          show={show}
          relevantCount={digest.ranked.length}
          allCount={scoredAll.length}
        />

        <h2 className="sr-only">Ranked items</h2>
        {shownAbove.length === 0 && (show === "relevant" || belowBar.length === 0) ? (
          <div className="mt-4">
            <EmptyState
              icon={<Newspaper />}
              title={
                show === "all" ? `No scored items ${when}` : `Nothing above the relevance bar ${when}`
              }
              action={{
                label: `See ${isToday ? "today's" : "this day's"} items in the archive`,
                href: `/news/archive?from=${digest.digestDate}&to=${digest.digestDate}&min=0`,
              }}
            >
              {digest.scoredCount === 0
                ? `${isToday ? "Today's" : "This day's"} run found no scored items.`
                : `${isToday ? "Today's" : "This day's"} run found ${digest.scoredCount} ${digest.scoredCount === 1 ? "item" : "items"}, all scored below ${RELEVANCE_BAR}.`}
              {show === "relevant" && digest.scoredCount > 0 ? (
                <p className="mt-3">
                  <Link
                    href={digestDayHref(requested, "all")}
                    className={buttonClasses("primary", "md")}
                  >
                    Show all ({scoredAll.length})
                  </Link>
                </p>
              ) : null}
            </EmptyState>
          </div>
        ) : null}
        {shownAbove.length > 0 ? (
          <ol aria-label={title} className="mt-4 space-y-3 md:space-y-4">
            {shownAbove.map((item) => (
              <li key={item.id}>
                <NewsCard item={item} />
              </li>
            ))}
          </ol>
        ) : null}
        {show === "all" && belowBar.length > 0 ? (
          <>
            <h3 className="mt-8 border-t border-border pt-4 text-lg font-bold text-fg-strong">
              Below the bar
              <span className="font-normal text-fg-muted">
                {" "}
                · scored under {RELEVANCE_BAR}
              </span>
            </h3>
            <ol aria-label="Below the relevance bar" className="mt-3 space-y-3">
              {belowBar.map((item) => (
                <li key={item.id}>
                  <NewsCard item={item} variant="compact" />
                </li>
              ))}
            </ol>
          </>
        ) : null}

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
            Scored daily at about 07:00 Manila for relevance to First Mate work. Only items scoring{" "}
            {RELEVANCE_BAR} or higher appear in the ranked list.
          </p>
          <div className="mt-2">{archiveLink}</div>
        </div>
      </div>
    </div>
  );
}
