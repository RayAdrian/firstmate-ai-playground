import { ArrowUpRight, ShieldAlert } from "lucide-react";
import { useId } from "react";
import { Badge } from "@/components/ui";
import { BookmarkButton } from "./bookmark-button";
import { formatFullStamp, formatShortStamp } from "./dates";
import styles from "./news-card.module.css";
import type { NewsCardItem } from "./queries";
import { TAG_LABEL, TAG_ORDER } from "./tag-labels";

export type NewsCardVariant = "scored" | "unscored" | "compact";

/**
 * One news item. Server component: only the bookmark toggle is a client island.
 * Title and why-it-matters are feed content, rendered as text nodes only (PRD section 13).
 */
export function NewsCard({
  item,
  variant = "scored",
  dateStyle = "short",
}: {
  item: NewsCardItem;
  variant?: NewsCardVariant;
  /** "short" = Wed 30 Sep, 06:10. "full" (archive) adds the year. */
  dateStyle?: "short" | "full";
}) {
  const titleId = useId();
  const showTile = variant !== "unscored" && item.score !== null;
  const showBody = variant === "scored";
  const stamp = item.publishedAt
    ? (dateStyle === "full" ? formatFullStamp : formatShortStamp)(item.publishedAt)
    : null;
  const tags = TAG_ORDER.filter((t) => item.tags.includes(t));
  const tileSize = variant === "compact" ? "size-12" : "size-12 md:size-14";
  const layout = showTile ? (variant === "compact" ? styles.compact : "") : styles.unscored;

  return (
    <article
      aria-labelledby={titleId}
      className={`${styles.card} ${layout} gap-x-3 gap-y-2 rounded-card bg-surface p-4 md:gap-x-4 ${
        variant === "compact" ? "md:p-4" : "md:p-6"
      }`}
    >
      {showTile ? (
        <div
          className={`flex ${tileSize} flex-col items-center justify-center self-start rounded-xl border border-border bg-canvas [grid-area:tile]`}
        >
          <span className="text-lg font-bold leading-none text-link tabular-nums md:text-xl">
            <span className="sr-only">Relevance score </span>
            {item.score}
            <span className="sr-only"> out of 100</span>
          </span>
          <span aria-hidden="true" className="text-xs text-fg-muted">
            /100
          </span>
        </div>
      ) : null}

      <h3 className="min-w-0 text-lg font-bold text-fg-strong md:text-xl [grid-area:title] [overflow-wrap:anywhere]">
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-link hover:underline"
          >
            <span id={titleId}>{item.title}</span>
            <ArrowUpRight aria-hidden="true" className="ml-1 inline size-3.5 align-baseline" />
            <span className="sr-only"> (opens in new tab)</span>
          </a>
        ) : (
          <span id={titleId}>{item.title}</span>
        )}
      </h3>

      <p className="min-w-0 self-center text-sm text-fg-muted [grid-area:meta] [overflow-wrap:anywhere]">
        {item.sourceName}
        {stamp && item.publishedAt ? (
          <>
            {" · "}
            <time dateTime={item.publishedAt} className="whitespace-nowrap">{stamp}</time>
          </>
        ) : null}
        {variant === "unscored" ? (
          <Badge variant="neutral" className="ml-2">
            {item.status === "failed" ? "Scoring failed" : "Unscored"}
          </Badge>
        ) : null}
      </p>

      <BookmarkButton id={item.id} title={item.title} />

      {showBody && tags.length > 0 ? (
        <ul aria-label="Tags" className="flex flex-wrap gap-2 [grid-area:tags]">
          {tags.map((tag) =>
            tag === "security" ? (
              <li key={tag}>
                <Badge variant="danger" icon={<ShieldAlert />}>
                  {TAG_LABEL[tag]}
                </Badge>
              </li>
            ) : (
              <li key={tag}>
                <Badge variant="tag">{TAG_LABEL[tag]}</Badge>
              </li>
            ),
          )}
        </ul>
      ) : null}

      {showBody && item.why ? (
        <div className="min-w-0 [grid-area:why]">
          <p className="text-xs font-bold uppercase tracking-eyebrow text-fg-muted">Why it matters</p>
          <p className="mt-1 text-base text-fg [overflow-wrap:anywhere]">{item.why}</p>
        </div>
      ) : null}
    </article>
  );
}
