import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";
export type ButtonSize = "md" | "sm" | "icon";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap transition-colors duration-[var(--fm-duration-fast)] ease-standard focus-visible:transition-none";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-fg hover:bg-primary-hover font-bold",
  secondary: "bg-accent-subtle text-link hover:bg-accent-soft font-medium",
  ghost: "bg-transparent text-fg hover:bg-surface font-medium",
  // Dark: a soft, bordered fill on purpose (DESIGN.md §8 #8).
  danger:
    "bg-danger text-canvas hover:opacity-90 font-bold dark:bg-danger-soft dark:text-danger dark:border dark:border-danger",
  link: "text-link underline underline-offset-2 hover:decoration-2 p-0 h-auto min-h-6 font-medium",
};

const sizes: Record<ButtonSize, string> = {
  md: "h-11 px-5 text-base rounded-xl",
  sm: "h-9 px-3 text-sm rounded-xl touch:h-11",
  icon: "size-9 rounded-full touch:size-11",
};

/** Class string for things that must look like a button but are not one (for example a Next <Link>). */
export function buttonClasses(variant: ButtonVariant = "secondary", size: ButtonSize = "md"): string {
  return cn(base, variants[variant], variant === "link" ? "" : sizes[size]);
}
