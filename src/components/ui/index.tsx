// M0 STUB primitives. WS-A replaces these with the real design system.
// Keep the export names and prop names stable: other workstreams import from "@/components/ui".
"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { clsx } from "clsx";

export function Button({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={clsx("rounded border px-3 py-1", className)} {...props}>
      {children}
    </button>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("rounded border p-4", className)}>{children}</div>;
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={clsx("rounded border px-2 text-sm", className)}>{children}</span>;
}

export type TabItem = { id: string; label: string; content: ReactNode };

/** WAI-ARIA tabs: roving tabindex, Left/Right (wrapping), Home/End, automatic activation. */
export function Tabs({
  items,
  value,
  onValueChange,
  label = "Tabs",
}: {
  items: TabItem[];
  value?: string;
  onValueChange?: (id: string) => void;
  label?: string;
}) {
  const base = useId();
  const [internal, setInternal] = useState(items[0]?.id);
  const requested = value ?? internal;
  // Fall back to the first item if the requested id doesn't exist.
  const active = items.some((t) => t.id === requested) ? requested : items[0]?.id;
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const select = (id: string, focus: boolean) => {
    if (onValueChange) onValueChange(id);
    else setInternal(id);
    if (focus) tabRefs.current[id]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((t) => t.id === active);
    let next: number;
    switch (e.key) {
      case "ArrowRight":
        next = (index + 1) % items.length;
        break;
      case "ArrowLeft":
        next = (index - 1 + items.length) % items.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = items.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    select(items[next].id, true);
  };

  return (
    <div>
      <div role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {items.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[t.id] = el;
            }}
            type="button"
            role="tab"
            id={`${base}-${t.id}-tab`}
            aria-selected={t.id === active}
            aria-controls={`${base}-${t.id}-panel`}
            tabIndex={t.id === active ? 0 : -1}
            onClick={() => select(t.id, false)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {items.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`${base}-${t.id}-panel`}
          aria-labelledby={`${base}-${t.id}-tab`}
          hidden={t.id !== active}
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}

export function CodeBlock({ code, language }: { code: string; language?: string }) {
  return (
    <pre className="overflow-x-auto rounded border p-3" data-language={language}>
      <code>{code}</code>
    </pre>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
  id,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
}) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div>
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />{" "}
      <label htmlFor={inputId}>{label}</label>
    </div>
  );
}

export function ProgressBar({
  value,
  max = 100,
  label,
  valueText,
}: {
  value: number;
  max?: number;
  label: string;
  valueText?: string;
}) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={valueText}
      className="h-2 w-full rounded border"
    >
      <div className="h-full bg-current" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={clsx("h-4 animate-pulse rounded bg-neutral-200", className)} />;
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded border p-6 text-center">
      <h2 className="font-medium">{title}</h2>
      {children}
    </div>
  );
}

export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "warning" | "error";
}) {
  return (
    <div role={tone === "error" ? "alert" : "status"} data-tone={tone} className="rounded border p-3">
      {children}
    </div>
  );
}
