import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Badge, EmptyState } from "@/components/ui";
import { getNow } from "@/lib/time/now";
import { formatDigestDay } from "./dates";
import { NewsCard } from "./news-card";
import { getDigest } from "./queries";

const SEE_ALL_CLASS =
  "mt-4 inline-flex min-h-11 items-center font-medium text-link underline underline-offset-2";

/**
 * The home page's news column (N-6, DESIGN 6.1): its own h2, the top 3 of the latest digest as
 * compact cards, and "See all" to /news in every state. Async server component with no props.
 * - none: a compact EmptyState with the PRD string; it never blocks the page.
 * - stale: "Latest · <day>" plus a "Stale" badge (icon and word), never the word "today".
 * - nothing above the bar: the PRD copy and a link to the archive.
 */
export async function DigestTopItems() {
  const digest = await getDigest(await getNow(), { limit: 3 });

  const seeAll = (
    <Link href="/news" className={SEE_ALL_CLASS}>
      See all<span aria-hidden="true">&nbsp;→</span>
    </Link>
  );

  if (digest.kind === "none") {
    return (
      <div>
        <h2 className="text-2xl font-bold text-fg-strong">News</h2>
        <div className="mt-4">
          <EmptyState
            as="h3"
            title={
              <>
                No news yet. Run <code className="font-mono text-base">npm run news:run</code>.
              </>
            }
          />
        </div>
        {seeAll}
      </div>
    );
  }

  const day = formatDigestDay(digest.digestDate);
  const heading = digest.stale ? `Latest · ${day}` : `Today · ${day}`;
  const label = digest.stale ? "Latest digest" : "Today's digest";
  const archiveHref = `/news/archive?from=${digest.digestDate}&to=${digest.digestDate}&min=0`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-2xl font-bold text-fg-strong">{heading}</h2>
        {digest.stale ? (
          <Badge variant="warning" icon={<AlertTriangle />}>
            Stale
          </Badge>
        ) : null}
      </div>
      {digest.ranked.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            as="h3"
            title={digest.stale ? "Nothing above the relevance bar" : "Nothing above the relevance bar today"}
            action={{
              label: digest.stale ? "See the items in the archive" : "See today's items in the archive",
              href: archiveHref,
            }}
          />
        </div>
      ) : (
        <ol aria-label={label} className="mt-4 space-y-3">
          {digest.ranked.map((item) => (
            <li key={item.id}>
              <NewsCard item={item} variant="compact" />
            </li>
          ))}
        </ol>
      )}
      {seeAll}
    </div>
  );
}
