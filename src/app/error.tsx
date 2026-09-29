"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DB_UNAVAILABLE_COMMAND,
  DB_UNAVAILABLE_MESSAGE,
  isDbUnavailable,
} from "@/lib/db/errors";

// M0 stub. WS-A owns this file and restyles it.
export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  const [copied, setCopied] = useState(false);

  if (isDbUnavailable(error)) {
    return (
      <>
        <h1>Database unavailable</h1>
        <p>{DB_UNAVAILABLE_MESSAGE}</p>
        <pre>
          <code>{DB_UNAVAILABLE_COMMAND}</code>
        </pre>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard
              ?.writeText(DB_UNAVAILABLE_COMMAND)
              .then(() => setCopied(true))
              .catch(() => setCopied(false));
          }}
        >
          Copy command
        </button>
        <span role="status" aria-live="polite">
          {copied ? " Copied" : ""}
        </span>{" "}
        <button type="button" onClick={() => reset()}>
          Try again
        </button>
      </>
    );
  }

  return (
    <>
      <h1>Something went wrong</h1>
      <p>An unexpected error occurred.</p>
      <button type="button" onClick={() => reset()}>
        Try again
      </button>{" "}
      <Link href="/curriculum">Back to curriculum</Link>
    </>
  );
}
