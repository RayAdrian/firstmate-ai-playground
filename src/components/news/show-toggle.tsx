import { digestDayHref, type ShowMode } from "./day-nav";
import Link from "next/link";

const segment =
  "inline-flex min-h-11 items-center justify-center px-4 text-base font-medium text-link hover:bg-accent-soft aria-[current=page]:bg-accent-soft aria-[current=page]:font-bold aria-[current=page]:text-fg-strong";

/**
 * Top / All toggle for /news. Real links (works without JS, keyboard and screen readers get
 * native link behaviour), the active one carries aria-current. State lives in `?show=`.
 */
export function ShowToggle({
  date,
  show,
  topCount,
  allCount,
}: {
  /** The day being shown, kept in both links. */
  date: string | null;
  show: ShowMode;
  topCount: number;
  allCount: number;
}) {
  return (
    <nav aria-label="Items to show" className="mt-4">
      <ul className="inline-flex divide-x divide-border rounded-lg border border-border">
        <li className="flex first:*:rounded-l-lg">
          <Link
            href={digestDayHref(date, "relevant")}
            prefetch={false}
            aria-current={show === "relevant" ? "page" : undefined}
            className={segment}
          >
            Top {topCount}
          </Link>
        </li>
        <li className="flex last:*:rounded-r-lg">
          <Link
            href={digestDayHref(date, "all")}
            prefetch={false}
            aria-current={show === "all" ? "page" : undefined}
            className={segment}
          >
            All ({allCount})
          </Link>
        </li>
      </ul>
    </nav>
  );
}
