import type { ReactNode } from "react";
import { ButtonLink } from "./button";
import Link from "next/link";

/**
 * Branded not-found body (DESIGN.md §6.9). The app 404 uses the defaults; `/lessons/[slug]` renders the
 * lesson variant with its own heading and body (the slug is rendered as escaped text by React).
 */
export function NotFoundView({
  heading = "Page not found",
  children = "The link may be old, or the lesson may have been renamed or archived.",
}: {
  heading?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-xl">
      <p className="text-sm font-bold uppercase tracking-eyebrow text-link">404</p>
      <h1 className="mt-2 text-3xl font-bold text-fg-strong md:text-4xl">{heading}</h1>
      <p className="mt-4 text-prose text-fg">{children}</p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <ButtonLink href="/curriculum" variant="primary">
          Go to curriculum
        </ButtonLink>
        <Link href="/" className="text-base font-medium text-link underline underline-offset-2 hover:decoration-2">
          Home
        </Link>
      </div>
    </div>
  );
}
