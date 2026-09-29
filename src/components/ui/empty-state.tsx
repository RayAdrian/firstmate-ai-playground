import Link from "next/link";
import { useId, type ReactNode } from "react";
import { cn } from "./cn";
import { CommandLine } from "./command-line";
import { buttonClasses } from "./button-styles";

/**
 * Empty state (DESIGN.md §4.9): what's missing, what fixes it. The title may contain inline code.
 * `command` renders a copyable CommandLine; `action` renders a link styled as a secondary button.
 */
export function EmptyState({
  title,
  children,
  icon,
  command,
  commandLabel = "Terminal",
  action,
  as: Heading = "h2",
  className,
}: {
  title: ReactNode;
  children?: ReactNode;
  /** 20px decorative icon inside the round accent chip. */
  icon?: ReactNode;
  command?: string;
  commandLabel?: string;
  action?: { label: string; href: string };
  as?: "h2" | "h3";
  className?: string;
}) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "max-w-xl rounded-card border border-dashed border-border bg-canvas p-6 md:p-8",
        className,
      )}
    >
      {icon ? (
        <div
          aria-hidden="true"
          className="mb-4 inline-flex size-10 items-center justify-center rounded-full bg-accent-soft text-link [&>svg]:size-5"
        >
          {icon}
        </div>
      ) : null}
      <Heading id={titleId} className="text-lg font-bold text-fg-strong">
        {title}
      </Heading>
      {children ? <div className="mt-2 text-base text-fg-muted">{children}</div> : null}
      {command ? <CommandLine command={command} label={commandLabel} className="mt-4" /> : null}
      {action ? (
        <Link href={action.href} className={cn(buttonClasses("secondary", "md"), "mt-4")}>
          {action.label}
        </Link>
      ) : null}
    </section>
  );
}
