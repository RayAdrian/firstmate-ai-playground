"use client";

import { CodeBlockView } from "./code-block-view";
import { codeLabel, codeSource } from "./code-source";

/**
 * Single-command variant of CodeBlock for setup/verify commands and empty states (DESIGN.md §4.5).
 * Same chrome and copy behaviour; the label is explicit ("Setup", "Verify", "Prompt", "Terminal").
 * Client-safe: usable from Server and Client Components.
 */
export function CommandLine({
  command,
  label = "Terminal",
  className,
}: {
  command: string;
  label?: string;
  className?: string;
}) {
  const raw = codeSource(command);
  return (
    <CodeBlockView label={label} raw={raw} className={className}>
      <code>{raw}</code>
    </CodeBlockView>
  );
}

/**
 * Multi-line code without highlighting, for Client Components (which cannot render the async,
 * server-highlighted CodeBlock). Same chrome, label rule and copy behaviour.
 */
export function PlainCodeBlock({
  code,
  language,
  title,
  className,
}: {
  code: string;
  language?: string;
  title?: string;
  className?: string;
}) {
  const raw = codeSource(code);
  return (
    <CodeBlockView label={codeLabel({ title, language })} raw={raw} className={className}>
      <code data-language={language}>{raw}</code>
    </CodeBlockView>
  );
}
