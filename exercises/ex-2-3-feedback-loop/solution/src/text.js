// @ts-check

/** @param {string} input @returns {string} */
export function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Cut text to at most max characters. When it had to cut, the result ends with
 * a single "…" (which counts towards max).
 * @param {string} text
 * @param {number} max
 * @returns {string}
 */
export function truncate(text, max) {
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 1)) + "\u2026";
}
