"use client";

import { startTransition, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Notice } from "@/components/ui";
import { isDbUnavailable } from "@/lib/db/errors";

/**
 * Route error boundary body for curriculum, lesson and exercises pages (S9-04, S9-07): a danger
 * Notice (icon + word, role=alert) with retry. It never prints the error message, stack or SQL.
 * A "database is down" error is re-thrown so the app-level boundary shows the DB-unavailable view.
 */
export function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  if (isDbUnavailable(error)) throw error;

  return (
    <>
      <h1 className="text-3xl font-bold text-fg-strong md:text-4xl">Something went wrong</h1>
      <Notice
        tone="danger"
        live="assertive"
        title="This page couldn't load."
        className="mt-4 max-w-xl"
        actions={
          <>
            <Button
              variant="secondary"
              loading={retrying}
              onClick={() => {
                setRetrying(true);
                // Server-component errors need a fresh RSC fetch as well as a boundary reset.
                startTransition(() => {
                  router.refresh();
                  reset();
                });
              }}
            >
              Try again
            </Button>
            <Link href="/curriculum" className="text-link underline underline-offset-2">
              Back to curriculum
            </Link>
          </>
        }
      >
        <p>Your saved progress is not affected.</p>
      </Notice>
    </>
  );
}
