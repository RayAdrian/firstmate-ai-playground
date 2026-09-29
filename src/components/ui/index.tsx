// M0 STUB primitives. WS-A replaces these with the real design system.
// Keep the export names and prop names stable: other workstreams import from "@/components/ui".
"use client";

import { useId, useState, type ReactNode } from "react";
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
  const active = value ?? internal;
  return (
    <div>
      <div role="tablist" aria-label={label}>
        {items.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`${base}-${t.id}-tab`}
            aria-selected={t.id === active}
            aria-controls={`${base}-${t.id}-panel`}
            tabIndex={t.id === active ? 0 : -1}
            onClick={() => (onValueChange ? onValueChange(t.id) : setInternal(t.id))}
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
}: {
  value: number;
  max?: number;
  label: string;
}) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
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
      <p className="font-medium">{title}</p>
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
