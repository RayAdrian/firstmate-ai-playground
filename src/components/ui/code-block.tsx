import { CodeBlockView } from "./code-block-view";
import { codeLabel, codeSource } from "./code-source";
import { highlightLines } from "./highlight";

/**
 * Fenced code block with a Copy button (L-4). An async Server Component: syntax highlighting (Shiki,
 * github-dark, AA-checked comment colour) runs on the server and ships as plain spans. Import it from
 * Server Components; from a Client Component use `PlainCodeBlock` (no highlighting) or receive the
 * rendered block as `children`/a prop.
 */
export async function CodeBlock({
  code,
  language,
  title,
  className,
}: {
  code: string;
  language?: string;
  /** Filename shown instead of the language (for example "src/app/page.tsx"). */
  title?: string;
  className?: string;
}) {
  const raw = codeSource(code);
  const lines = await highlightLines(raw, language);
  return (
    <CodeBlockView label={codeLabel({ title, language })} raw={raw} className={className}>
      <code data-language={language}>
        {lines
          ? lines.map((line, i) => (
              <span key={i}>
                {line.map((token, j) => (
                  <span key={j} style={token.color ? { color: token.color } : undefined}>
                    {token.content}
                  </span>
                ))}
                {i < lines.length - 1 ? "\n" : null}
              </span>
            ))
          : raw}
      </code>
    </CodeBlockView>
  );
}
