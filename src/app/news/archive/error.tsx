"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui";
import { isDbUnavailable } from "@/lib/db/errors";

// Route error boundary for the archive (S9-18). A database outage is not handled here: it is re-thrown
// so the app-wide "can't reach the database" screen takes over. Nothing from `error` is rendered:
// messages and stacks can carry internals.
export default function NewsArchiveError({ error, reset }: { error: Error; reset: () => void }) {
  if (isDbUnavailable(error)) throw error;
  return (
    <>
      <h1 className="text-3xl font-bold text-fg-strong">News archive</h1>
      <div role="alert" className="mt-6 flex max-w-xl gap-3 rounded-lg bg-danger-soft p-4">
        <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-danger" />
        <div>
          <p className="font-bold text-danger">This page couldn&apos;t load.</p>
          <p className="text-base text-fg">The archive hit an error. Retry, and if it keeps happening check the dev server log.</p>
          <Button
            onClick={() => reset()}
            className="mt-3 h-11 rounded-xl bg-accent-subtle px-5 font-medium text-link hover:bg-accent-soft"
          >
            Retry
          </Button>
        </div>
      </div>
    </>
  );
}
