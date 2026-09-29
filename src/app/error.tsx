"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Button, CommandLine, Notice } from "@/components/ui";
import {
  DB_UNAVAILABLE_COMMAND,
  DB_UNAVAILABLE_MESSAGE,
  isDbUnavailable,
} from "@/lib/db/errors";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
  /** Next 16.3: re-fetches the segment and re-renders the boundary's children. Preferred over reset(). */
  retry?: () => void;
};

/**
 * Route error boundary (DESIGN.md §6.10). Detection (isDbUnavailable) and copy constants come from M0;
 * this file only presents them. No stack trace or server message is ever rendered: production strips
 * them, and we never print `error.message`. The optional digest is an opaque reference.
 */
export default function ErrorPage({ error, reset, retry }: ErrorPageProps) {
  const [pending, startTransition] = useTransition();

  // reset() alone re-renders the boundary without refetching server data, so prefer retry() when present.
  const tryAgain = () => startTransition(() => (retry ?? reset)());

  const tryAgainButton = (
    <Button variant="secondary" onClick={tryAgain} loading={pending}>
      Try again
    </Button>
  );

  if (isDbUnavailable(error)) {
    return (
      <div className="max-w-[var(--fm-measure)]">
        <h1 className="text-3xl font-bold text-fg-strong md:text-4xl">Database unavailable</h1>
        <p className="mt-4 text-prose text-fg">{DB_UNAVAILABLE_MESSAGE}</p>
        <CommandLine command={DB_UNAVAILABLE_COMMAND} label="Terminal" className="mt-6" />
        <div className="mt-6">{tryAgainButton}</div>
      </div>
    );
  }

  return (
    <div className="max-w-[var(--fm-measure)]">
      <h1 className="text-3xl font-bold text-fg-strong md:text-4xl">Something went wrong</h1>
      <Notice
        tone="danger"
        live="assertive"
        className="mt-6"
        actions={
          <>
            {tryAgainButton}
            <Link href="/curriculum" className="text-base font-medium text-link underline underline-offset-2 hover:decoration-2">
              Back to curriculum
            </Link>
          </>
        }
      >
        <p>This page couldn&apos;t load. Your saved progress is not affected.</p>
      </Notice>
      {error.digest ? <p className="mt-3 text-xs text-fg-muted">Reference: {error.digest}</p> : null}
    </div>
  );
}
