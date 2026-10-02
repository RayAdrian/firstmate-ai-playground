import Link from "next/link";
import { formatDigestDay } from "./dates";
import { digestDayHref, type ShowMode } from "./day-nav";

const stepLink =
  "inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-2 text-base font-medium text-link hover:bg-accent-soft";

/** Previous/next digest day links around the current day label. Prev/next are digest days, so empty days are skipped. */
export function DayStepper({
  current,
  prev,
  next,
  show = "relevant",
}: {
  current: string;
  prev: string | null;
  next: string | null;
  show?: ShowMode;
}) {
  return (
    <nav aria-label="Digest day" className="-mx-2 mt-2 flex items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1">
        {prev ? (
          <Link href={digestDayHref(prev, show)} prefetch={false} rel="prev" className={stepLink}>
            <span aria-hidden="true">←&nbsp;</span>Previous day
          </Link>
        ) : null}
      </div>
      <span className="text-base font-medium text-fg-muted">{formatDigestDay(current)}</span>
      <div className="flex min-w-0 flex-1 justify-end">
        {next ? (
          <Link href={digestDayHref(next, show)} prefetch={false} rel="next" className={stepLink}>
            Next day<span aria-hidden="true">&nbsp;→</span>
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
