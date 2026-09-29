"use client";

// Small client islands for /news/archive. The filters are a real GET form, so URL params are the
// only state (N-4); these add focus handoff and the mobile disclosure, nothing else.
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";

const FOCUS_FLAG = "fm-news-focus-results";

function setFocusFlag(): void {
  try {
    window.sessionStorage.setItem(FOCUS_FLAG, "1");
  } catch {
    // sessionStorage blocked: focus handoff is a nicety, skip it.
  }
}

/** GET form. On submit: leave empty/default fields out of the URL and ask the results to take focus. */
export function ArchiveForm({ children }: { children: ReactNode }) {
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    setFocusFlag();
    const skipped: HTMLInputElement[] = [];
    const form = e.currentTarget;
    for (const el of Array.from(form.elements)) {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) continue;
      const empty = el.type !== "checkbox" && (el.value === "" || (el.name === "min" && el.value === "0"));
      if (empty && !el.disabled) {
        el.disabled = true;
        skipped.push(el as HTMLInputElement);
      }
    }
    // Disabled controls are left out of the submission; restore them right after (bfcache-safe).
    setTimeout(() => skipped.forEach((el) => (el.disabled = false)), 0);
  };
  return (
    <form method="get" action="/news/archive" aria-label="Filters" autoComplete="off" onSubmit={onSubmit}>
      {children}
    </form>
  );
}

/** Wraps links (filter chips, pagination): activating one hands focus to the results heading. */
export function FocusResultsLinks({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "nav";
}) {
  const onClick = (e: MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("a")) setFocusFlag();
  };
  return Tag === "nav" ? (
    <nav aria-label="Pagination" className={className} onClick={onClick}>
      {children}
    </nav>
  ) : (
    <div className={className} onClick={onClick}>
      {children}
    </div>
  );
}

/** Results h2. Mounted fresh per result set (keyed by the URL), it takes focus when a flag says the user just filtered or paged. */
export function ResultsHeading({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(FOCUS_FLAG)) {
        window.sessionStorage.removeItem(FOCUS_FLAG);
        ref.current?.focus();
      }
    } catch {
      // ignore
    }
  }, []);
  return (
    <h2 ref={ref} tabIndex={-1} className="text-xl font-bold text-fg-strong focus:outline-none">
      {children}
    </h2>
  );
}

/** Below lg the filter form sits behind a disclosure; from lg up it is always visible. */
export function FiltersDisclosure({
  activeCount,
  defaultOpen,
  children,
}: {
  activeCount: number;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-control-border px-4 text-base font-medium text-fg lg:hidden"
      >
        Filters ({activeCount})
        <ChevronDown
          aria-hidden="true"
          className={`size-4 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div id={panelId} className={`${open ? "block" : "hidden"} mt-3 lg:mt-0 lg:block`}>
        {children}
      </div>
    </div>
  );
}
