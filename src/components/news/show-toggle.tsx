import { digestDayHref, type ShowMode } from "./day-nav";
import Link from "next/link";

const segment =
  "inline-flex min-h-11 items-center justify-center px-4 text-base font-medium text-link first:rounded-l-lg last:rounded-r-lg hover:bg-accent-soft aria-[current=true]:bg-accent-soft aria-[current=true]:font-bold aria-[current=true]:text-fg-strong";

/**
 * Relevant / All toggle for /news. Real links (works without JS, keyboard and screen readers get
 * native link behaviour), the active one carries aria-current. State lives in `?show=`.
 */
export function ShowToggle({
  date,
  show,
  relevantCount,
  allCount,
}: {
  /** The day being shown, kept in both links. */
  date: string | null;
  show: ShowMode;
  relevantCount: number;
  allCount: number;
}) {
  return (
    <nav aria-label="Items to show" className="mt-4">
      <ul className="inline-flex divide-x divide-border overflow-hidden rounded-lg border border-border">
        <li className="flex">
          <Link
            href={digestDayHref(date, "relevant")}
            prefetch={false}
            aria-current={show === "relevant" ? "true" : undefined}
            className={segment}
          >
            Relevant ({relevantCount})
          </Link>
        </li>
        <li className="flex">
          <Link
            href={digestDayHref(date, "all")}
            prefetch={false}
            aria-current={show === "all" ? "true" : undefined}
            className={segment}
          >
            All ({allCount})
          </Link>
        </li>
      </ul>
    </nav>
  );
}
