/**
 * Turn a title into a URL slug: lowercase, ASCII letters and digits,
 * words separated by a single hyphen, no leading or trailing hyphen.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-");
}
