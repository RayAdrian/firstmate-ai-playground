// Server-side syntax highlighting (DESIGN.md §4.5). Imported lazily so the shiki engine and grammars
// stay out of any client bundle that merely imports the ui barrel.
import type { HighlighterGeneric } from "shiki";

export type HighlightToken = { content: string; color?: string };

const LANGS = [
  "bash",
  "shellscript",
  "typescript",
  "tsx",
  "javascript",
  "jsx",
  "json",
  "jsonc",
  "toml",
  "yaml",
  "markdown",
  "python",
  "diff",
  "sql",
  "css",
  "html",
  "ini",
] as const;

const THEME = "github-dark";

/** GitHub-dark comments are 3.71:1 on code-bg; DESIGN.md §2.4 overrides them to 7.09:1. */
const COMMENT_FROM = "#6a737d";
const COMMENT_TO = "#9aa4b2";

let highlighter: Promise<HighlighterGeneric<string, string>> | undefined;

function getHighlighter(): Promise<HighlighterGeneric<string, string>> {
  highlighter ??= (async () => {
    const [{ createHighlighter }, { createJavaScriptRegexEngine }] = await Promise.all([
      import("shiki"),
      import("shiki/engine/javascript"),
    ]);
    return createHighlighter({
      themes: [THEME],
      langs: [...LANGS],
      engine: createJavaScriptRegexEngine(),
    }) as Promise<HighlighterGeneric<string, string>>;
  })();
  return highlighter;
}

/**
 * Tokenise `code` line by line. Returns null when the language is unknown or highlighting fails, so the
 * caller renders plain text (a highlighter problem must never hide a command).
 */
export async function highlightLines(code: string, language: string | undefined): Promise<HighlightToken[][] | null> {
  if (!language) return null;
  try {
    const hl = await getHighlighter();
    const lang = language.toLowerCase();
    if (!hl.getLoadedLanguages().includes(lang)) return null;
    const { tokens } = hl.codeToTokens(code, { lang, theme: THEME });
    return tokens.map((line) =>
      line.map((t) => ({
        content: t.content,
        color: t.color?.toLowerCase() === COMMENT_FROM ? COMMENT_TO : t.color,
      })),
    );
  } catch {
    return null;
  }
}
