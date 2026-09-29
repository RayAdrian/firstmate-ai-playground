"use client";

// Disclosure for unscored items (N-2.1, APG accordion header: h2 > button). Client boundary: open/closed state.
// The list itself is rendered on the server and passed in as children.
import { ChevronRight } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

export function UnscoredSection({ count, children }: { count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="mt-8">
      <h2 className="text-lg font-bold text-fg-strong">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg py-2 pr-3 text-lg font-bold text-fg-strong"
        >
          <ChevronRight
            aria-hidden="true"
            className={`size-4 transition-transform motion-reduce:transition-none ${open ? "rotate-90" : ""}`}
          />
          Unscored ({count})
        </button>
      </h2>
      <div id={panelId} hidden={!open} className="mt-2">
        <p className="mb-3 text-base text-fg-muted">
          These items haven&apos;t been scored yet, or scoring failed. They are not ranked.
        </p>
        {children}
      </div>
    </div>
  );
}
