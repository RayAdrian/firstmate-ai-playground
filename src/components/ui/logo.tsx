import { cn } from "./cn";

/**
 * First Mate logo (DESIGN.md §1.5). The navy wordmark is ~1.1:1 on the dark canvas, so a dark-scheme
 * variant is swapped in with <picture>. Never recoloured or stretched.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <picture>
      <source srcSet="/brand/firstmate-logo-dark.svg" media="(prefers-color-scheme: dark)" />
      <img
        src="/brand/firstmate-logo.svg"
        alt="First Mate"
        width={825}
        height={169}
        className={cn("h-8 w-auto md:h-9", className)}
      />
    </picture>
  );
}
