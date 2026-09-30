"use client";

import { startTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isDbUnavailable } from "@/lib/db/errors";

/**
 * Route error boundary body for curriculum and lesson pages (S9-04, S9-07): a `role="alert"`
 * notice with retry. It never prints the error message, stack or SQL. A "database is down" error
 * is re-thrown so the app-level boundary can show the dedicated DB-unavailable view.
 */
export function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  if (isDbUnavailable(error)) throw error;

  return (
    <>
      <h1 className="text-3xl font-bold text-fg-strong">Something went wrong</h1>
      <div role="alert" className="mt-4 flex gap-3 rounded-lg bg-danger-soft p-4">
        <div>
          <p className="font-bold text-danger">This page couldn&apos;t load.</p>
          <p className="text-base text-fg">Try again, or go back to the curriculum.</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          type="button"
          className="inline-flex h-11 items-center rounded-xl bg-accent-subtle px-5 text-base font-medium text-link hover:bg-accent-soft"
          onClick={() => {
            // Server-component errors need a fresh RSC fetch as well as a boundary reset.
            startTransition(() => {
              router.refresh();
              reset();
            });
          }}
        >
          Try again
        </button>
        <Link href="/curriculum" className="text-link underline underline-offset-2">
          Back to curriculum
        </Link>
      </div>
    </>
  );
}
