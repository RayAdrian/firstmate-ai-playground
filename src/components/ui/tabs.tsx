"use client";

import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "./cn";

export type TabItem = {
  id: string;
  label: string;
  content: ReactNode;
  /** Decorative 16px icon; the label text always carries the identity. */
  icon?: ReactNode;
};

/**
 * WAI-ARIA tabs (DESIGN.md §4.4): roving tabindex, Left/Right (wrapping), Home/End, automatic activation.
 * Every panel is rendered (inactive ones are `hidden`) so switching needs no fetch.
 * Controlled with `value` + `onValueChange`, or uncontrolled. `onValueChange` fires only on a change.
 *
 * ids follow the selector contract: `tab-{scope}-{id}` and `panel-{scope}-{id}` (`scope` defaults to a stable auto id).
 */
export function Tabs({
  items,
  value,
  onValueChange,
  label = "Tabs",
  scope,
  className,
}: {
  items: TabItem[];
  value?: string;
  onValueChange?: (id: string) => void;
  /** Accessible name of the tablist ("Tool", "Starting prompt"). */
  label?: string;
  scope?: string;
  className?: string;
}) {
  const auto = useId().replace(/:/g, "");
  const idScope = scope ?? auto;
  const [internal, setInternal] = useState(items[0]?.id);
  const requested = value ?? internal;
  // Fall back to the first item if the requested id doesn't exist.
  const active = items.some((t) => t.id === requested) ? requested : items[0]?.id;
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const listRef = useRef<HTMLDivElement>(null);
  // Viewport top of the tablist before a switch, kept only when it was scrolled above the viewport.
  const pendingTop = useRef<number | null>(null);

  // Keep the tablist where the reader left it when panel heights differ (L-2: no shift above the tabs).
  useLayoutEffect(() => {
    if (pendingTop.current === null || !listRef.current) return;
    const delta = listRef.current.getBoundingClientRect().top - pendingTop.current;
    pendingTop.current = null;
    if (delta !== 0) window.scrollBy(0, delta);
  }, [active]);

  const select = (id: string, focus: boolean) => {
    if (id !== active) {
      const top = listRef.current?.getBoundingClientRect().top;
      pendingTop.current = top !== undefined && top < 0 ? top : null;
      if (onValueChange) onValueChange(id);
      else setInternal(id);
    }
    if (focus) tabRefs.current[id]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (items.length === 0) return;
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
    <div className={className}>
      <div
        ref={listRef}
        role="tablist"
        aria-label={label}
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        className="flex border-b border-border"
      >
        {items.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${idScope}-${t.id}`}
              aria-selected={selected}
              aria-controls={`panel-${idScope}-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(t.id, false)}
              // Active: weight + colour + a real 2px bottom border, never colour alone.
              className={cn(
                "-mb-px inline-flex h-11 items-center gap-2 border-b-2 px-4 text-sm transition-colors duration-[var(--fm-duration-fast)] focus-visible:transition-none",
                selected
                  ? "border-link font-bold text-fg-strong"
                  : "border-transparent font-medium text-fg-muted hover:text-fg",
              )}
            >
              {t.icon ? (
                <span aria-hidden="true" className="inline-flex size-4 items-center justify-center [&>svg]:size-4">
                  {t.icon}
                </span>
              ) : null}
              {t.label}
            </button>
          );
        })}
      </div>
      {items.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`panel-${idScope}-${t.id}`}
          aria-labelledby={`tab-${idScope}-${t.id}`}
          tabIndex={0}
          hidden={t.id !== active}
          className="pt-4"
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
