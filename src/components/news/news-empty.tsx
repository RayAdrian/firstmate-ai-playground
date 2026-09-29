import { Inbox } from "lucide-react";
import { useId, type ReactNode } from "react";

/** EmptyState (DESIGN 4.9), local so the title can hold inline code regardless of the shared primitive's shape. */
export function NewsEmpty({
  title,
  children,
  level = 2,
}: {
  title: ReactNode;
  children?: ReactNode;
  level?: 2 | 3;
}) {
  const id = useId();
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <section
      aria-labelledby={id}
      className="max-w-xl rounded-card border border-dashed border-border bg-canvas p-6 md:p-8"
    >
      <span
        aria-hidden="true"
        className="mb-3 flex size-10 items-center justify-center rounded-full bg-accent-soft text-link"
      >
        <Inbox className="size-5" />
      </span>
      <Heading id={id} className="text-lg font-bold text-fg-strong">
        {title}
      </Heading>
      {children}
    </section>
  );
}
