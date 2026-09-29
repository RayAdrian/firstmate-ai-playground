/** Capitalise the first letter of every word and lowercase the rest. Collapses whitespace. */
export function titleCase(input) {
  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
