export type NavItem = { href: string; label: string };

/** Main navigation (DESIGN.md §5.1). "Progress" is a utility link and sits apart on the right. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/curriculum", label: "Curriculum" },
  { href: "/exercises", label: "Exercises" },
  { href: "/news", label: "News" },
  { href: "/bookmarks", label: "Bookmarks" },
  { href: "/progress", label: "Progress" },
];

function within(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * Which nav item is current. `/curriculum` also covers `/lessons/*`, `/news` covers `/news/archive`,
 * everything else matches exactly. `/` activates nothing (the logo is home).
 */
export function isNavActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  switch (href) {
    case "/curriculum":
      return within(pathname, "/curriculum") || within(pathname, "/lessons");
    case "/news":
      return within(pathname, "/news");
    default:
      return pathname === href;
  }
}
