function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * HN keyword prefilter (AMB-E5): whole-word, case-insensitive, over title + excerpt.
 * An optional plural "s" is allowed so "MCPs" matches "MCP", but "Reactor" does not match "React".
 * No keywords configured means keep everything.
 */
export function matchesKeywords(item: { title: string; excerpt: string | null }, keywords: readonly string[]): boolean {
  if (keywords.length === 0) return true;
  const text = `${item.title}\n${item.excerpt ?? ""}`;
  return keywords.some((kw) => {
    const re = new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(kw)}s?(?![A-Za-z0-9])`, "i");
    return re.test(text);
  });
}
