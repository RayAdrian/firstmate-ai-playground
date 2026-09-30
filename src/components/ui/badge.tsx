import type { ReactNode } from "react";
import { cn } from "./cn";

export type BadgeVariant = "neutral" | "accent" | "success" | "warning" | "danger" | "tag";

const variants: Record<BadgeVariant, string> = {
  neutral: "bg-border-subtle text-fg-muted",
  accent: "bg-accent-soft text-link",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  tag: "bg-canvas border border-border text-fg",
};

/** Non-interactive status label. Status is never colour alone: pair it with an icon and a word. */
export function Badge({
  children,
  className,
  variant = "neutral",
  icon,
  title,
}: {
  children: ReactNode;
  className?: string;
  variant?: BadgeVariant;
  /** 12px leading icon (decorative). */
  icon?: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        variants[variant],
        className,
      )}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex size-3 items-center justify-center [&>svg]:size-3">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
