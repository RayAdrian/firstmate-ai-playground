import Link from "next/link";
import { getNow } from "@/lib/time/now";
import { formatDigestDay } from "./dates";
import { NewsCard } from "./news-card";
import { getDigest } from "./queries";

/**
 * Top 3 of the latest digest for the home page (N-6.1). Async server component with no props: the
 * caller supplies the section heading. Renders a list named "Today's digest" ("Latest digest" when
 * stale) and a "See all" link to /news, or a short empty line.
 */
export async function DigestTopItems() {
  const digest = await getDigest(await getNow(), { limit: 3 });

  if (digest.kind === "none") {
    return (
      <p className="text-base text-fg-muted">
        No news yet. Run <code className="font-mono text-sm">npm run news:run</code>.
      </p>
    );
  }

  const label = digest.stale ? "Latest digest" : "Today's digest";
  return (
    <div>
      {digest.stale ? (
        <p className="mb-3 text-sm text-fg-muted">
          No digest yet today. Showing {formatDigestDay(digest.digestDate)}
        </p>
      ) : null}
      {digest.ranked.length === 0 ? (
        <p className="text-base text-fg-muted">Nothing above the relevance bar today</p>
      ) : (
        <ol aria-label={label} className="space-y-3">
          {digest.ranked.map((item) => (
            <li key={item.id}>
              <NewsCard item={item} variant="compact" />
            </li>
          ))}
        </ol>
      )}
      <Link href="/news" className="mt-4 inline-flex min-h-11 items-center font-medium text-link underline underline-offset-2">
        See all
      </Link>
    </div>
  );
}
