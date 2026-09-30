"use client";

import { useState, type ReactNode } from "react";
import { CircleCheck, CircleX, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "./cn";

export type NoticeTone = "info" | "neutral" | "success" | "warning" | "danger" | "error";
export type NoticeLive = "polite" | "assertive" | false;

const styles: Record<Exclude<NoticeTone, "error">, { box: string; icon: string; title: string }> = {
  info: { box: "bg-accent-soft", icon: "text-link", title: "text-fg-strong" },
  neutral: { box: "bg-surface border border-border", icon: "text-fg-muted", title: "text-fg-strong" },
  success: { box: "bg-success-soft", icon: "text-success", title: "text-success" },
  warning: { box: "bg-warning-soft", icon: "text-warning", title: "text-warning" },
  danger: { box: "bg-danger-soft", icon: "text-danger", title: "text-danger" },
};

const icons = {
  info: Info,
  neutral: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleX,
} as const;

/** role for a live setting: polite = status, assertive = alert, false = none (server-rendered content). */
function roleFor(live: NoticeLive): "status" | "alert" | undefined {
  if (live === "assertive") return "alert";
  if (live === "polite") return "status";
  return undefined;
}

function focusMainHeading(): void {
  const target = document.querySelector<HTMLElement>("main h1") ?? document.querySelector<HTMLElement>("main");
  if (!target) return;
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus();
}

/**
 * Inline message (DESIGN.md §4.10).
 * `tone="error"` is kept as an alias of `danger`.
 * `live` defaults to "polite" (role=status) and to "assertive" (role=alert) for danger; pass `live={false}`
 * for a Notice that is part of the server HTML, which is content rather than an announcement.
 */
export function Notice({
  children,
  tone = "info",
  title,
  live,
  dismissible = false,
  onDismiss,
  actions,
  className,
}: {
  children: ReactNode;
  tone?: NoticeTone;
  /** Optional bold heading, coloured by tone. */
  title?: ReactNode;
  live?: NoticeLive;
  dismissible?: boolean;
  onDismiss?: () => void;
  /** Buttons or links rendered under the body. */
  actions?: ReactNode;
  className?: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  const resolved = tone === "error" ? "danger" : tone;
  const effectiveLive: NoticeLive = live ?? (resolved === "danger" ? "assertive" : "polite");
  const style = styles[resolved];
  const Icon = icons[resolved];

  if (dismissed) return null;

  return (
    <div
      role={roleFor(effectiveLive)}
      data-tone={resolved}
      className={cn("flex gap-3 rounded-lg p-4 text-fg", style.box, className)}
    >
      <Icon aria-hidden="true" className={cn("mt-0.5 size-5 shrink-0", style.icon)} />
      <div className="min-w-0 flex-1 text-base">
        {title ? <p className={cn("font-bold", style.title)}>{title}</p> : null}
        {children}
        {actions ? <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {dismissible ? (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            setDismissed(true);
            onDismiss?.();
            focusMainHeading();
          }}
          className="-mr-1 -mt-1 inline-flex size-9 shrink-0 items-center justify-center self-start rounded-full text-fg hover:bg-black/5 touch:size-11 dark:hover:bg-white/10"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
