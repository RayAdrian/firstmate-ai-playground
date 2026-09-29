import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "./cn";

/**
 * Removable filter as a link to the current URL minus one param, so it works without JS.
 * Accessible name: "Remove filter: <label>".
 */
export function FilterChip({ label, href, className }: { label: string; href: string; className?: string }) {
  return (
    <Link
      href={href}
      aria-label={`Remove filter: ${label}`}
      className={cn(
        "inline-flex min-h-6 items-center gap-1 rounded-full bg-accent-soft px-2.5 text-xs font-medium text-link touch:min-h-11 touch:px-4",
        className,
      )}
    >
      {label}
      <X aria-hidden="true" className="size-3" />
    </Link>
  );
}
