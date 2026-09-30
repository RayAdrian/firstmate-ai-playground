import type { ReactNode } from "react";

/** Class for inline code: long unbreakable tokens (env vars, paths) must wrap instead of scrolling the page. */
export const INLINE_CODE_CLASS =
  "rounded bg-surface px-1.5 py-0.5 font-mono text-[0.9em] text-fg-strong [overflow-wrap:anywhere]";

/**
 * Plain text with `backtick` spans rendered as <code>. Nothing else is interpreted and no HTML is
 * ever parsed, so authored strings (differences, checklist items) stay safe.
 */
export function InlineText({ text }: { text: string }) {
  const parts = text.split("`");
  // An odd number of backticks leaves the last one unmatched: show it literally.
  const balanced = parts.length % 2 === 1;
  const nodes: ReactNode[] = parts.map((part, i) => {
    const isCode = i % 2 === 1 && (balanced || i < parts.length - 1);
    if (isCode && part.length > 0) {
      return (
        <code key={i} className={INLINE_CODE_CLASS}>
          {part}
        </code>
      );
    }
    return i % 2 === 1 && !isCode ? `\`${part}` : part;
  });
  return <>{nodes}</>;
}

/** Eyebrow label style shared by "Lesson 2.1", "Level n", "Exercise" and rail headings (DESIGN 3.1). */
export const EYEBROW_CLASS = "text-sm font-bold uppercase tracking-eyebrow text-link";

/** " · First Mate AI Playground" document title suffix (DESIGN 5.3). */
export const TITLE_SUFFIX = "First Mate AI Playground";
