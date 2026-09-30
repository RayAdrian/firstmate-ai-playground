import Link from "next/link";
import type { ComponentProps, ElementType, ReactNode } from "react";
import { cn } from "./cn";

type CardProps = {
  children: ReactNode;
  className?: string;
  /** Element to render. Use "section"/"article" when the card is a landmark or a list item. */
  as?: "div" | "section" | "article" | "li";
  /** A card with a single destination (stretched link): hover elevation and a focus ring on the card. */
  interactive?: boolean;
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">;

function CardRoot({ children, className, as = "div", interactive = false, ...rest }: CardProps) {
  const Tag: ElementType = as;
  return (
    <Tag
      className={cn(
        "rounded-card bg-surface p-5 md:p-6 dark:border dark:border-border",
        interactive &&
          "relative [&_a:focus-visible]:outline-none [&_a:focus-visible]:after:outline-none transition-shadow duration-[var(--fm-duration-fast)] hover:shadow-md dark:hover:border-link has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-solid has-[a:focus-visible]:outline-focus has-[a:focus-visible]:outline-offset-2",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

function CardHeader({
  eyebrow,
  title,
  as: Heading = "h2",
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Heading level the page outline needs. */
  as?: "h2" | "h3" | "h4";
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="text-sm font-bold uppercase tracking-eyebrow text-link">{eyebrow}</p> : null}
        <Heading className="text-lg font-bold text-fg-strong md:text-xl [overflow-wrap:anywhere]">{title}</Heading>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mt-3", className)}>{children}</div>;
}

function CardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mt-4 flex flex-wrap items-center gap-2", className)}>{children}</div>;
}

/** Stretched link for an interactive Card: the whole card is the hit area. */
function CardLink({ className, children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        // Own focus ring on the stretched area, so a link inside a non-interactive Card is still visibly focused.
        "after:absolute after:inset-0 after:rounded-card hover:underline focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-solid focus-visible:after:outline-focus focus-visible:after:outline-offset-2",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Body: CardBody,
  Footer: CardFooter,
  Link: CardLink,
});
