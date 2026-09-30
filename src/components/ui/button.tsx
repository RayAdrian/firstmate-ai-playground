"use client";

import { useLayoutEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./button-styles";
import { cn } from "./cn";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optional leading icon (16px). Replaced by a spinner while `loading`. */
  icon?: ReactNode;
  /** Shows a spinner, sets aria-busy and keeps the idle width. */
  loading?: boolean;
};

export function Button({
  children,
  className,
  variant = "secondary",
  size = "md",
  icon,
  loading = false,
  type = "button",
  onClick,
  ...props
}: ButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const idleWidth = useRef(0);

  // Remember the width of the idle button; hold it while loading so the layout does not jump.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (loading) {
      el.style.minWidth = `${idleWidth.current}px`;
    } else {
      el.style.minWidth = "";
      idleWidth.current = el.offsetWidth;
    }
  }, [loading, children, icon]);

  return (
    <button
      ref={ref}
      type={type}
      aria-busy={loading || undefined}
      // aria-disabled stays focusable and activatable by keyboard AND mouse (no pointer-events-none), so callers that
      // guard the action themselves (for example to show a validation message) behave the same for both.
      onClick={loading ? undefined : onClick}
      className={cn(
        buttonClasses(variant, size),
        "aria-disabled:cursor-not-allowed aria-disabled:opacity-50 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {loading ? (
        <>
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
          {children}
          <span aria-hidden="true" className="hidden motion-reduce:inline">
            …
          </span>
        </>
      ) : (
        <>
          {icon ? (
            <span aria-hidden="true" className="inline-flex size-4 items-center justify-center [&>svg]:size-4">
              {icon}
            </span>
          ) : null}
          {children}
        </>
      )}
    </button>
  );
}

/** A Next <Link> styled as a button. Use it for navigation; use <Button> for actions. */
export function ButtonLink({
  href,
  children,
  className,
  variant = "secondary",
  size = "md",
  icon,
  ...props
}: Omit<React.ComponentProps<typeof Link>, "className"> & {
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}) {
  return (
    <Link href={href} className={cn(buttonClasses(variant, size), className)} {...props}>
      {icon ? (
        <span aria-hidden="true" className="inline-flex size-4 items-center justify-center [&>svg]:size-4">
          {icon}
        </span>
      ) : null}
      {children}
    </Link>
  );
}
