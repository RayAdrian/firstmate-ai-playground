"use client";

import { useRouter } from "next/navigation";
import { startTransition } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { isDbUnavailable } from "@/lib/db/errors";

// Route error boundary for the archive (S9-18). A database outage is not handled here: it is re-thrown
// so the app-wide "can't reach the database" screen takes over. Nothing from `error` is rendered:
// messages and stacks can carry internals.
export default function NewsArchiveError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  if (isDbUnavailable(error)) throw error;
  // A server render failed, so re-render the boundary AND re-fetch the route; reset() alone would replay the error.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });
  return (
    <>
      <h1 className="text-3xl font-bold text-fg-strong">News archive</h1>
      <Notice
        tone="danger"
        title="This page couldn't load."
        className="mt-6 max-w-xl"
        actions={<Button onClick={retry}>Retry</Button>}
      >
        <p>The archive hit an error. Retry, and if it keeps happening check the dev server log.</p>
      </Notice>
    </>
  );
}
