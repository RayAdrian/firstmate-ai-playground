"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Settings2, X } from "lucide-react";
import { cn } from "./cn";
import { Logo } from "./logo";
import { isNavActive, NAV_ITEMS } from "./nav";

const DESKTOP_QUERY = "(min-width: 1024px)";

function BrandLink() {
  return (
    <Link href="/" className="inline-flex min-h-11 shrink-0 items-center gap-3 rounded-lg">
      <Logo />{" "}
      {/* Below 375px the label is visually hidden so the logo fits; the link keeps its full name. */}
      <span aria-hidden="true" className="h-5 w-px bg-border max-[374px]:sr-only" />
      <span className="text-sm font-bold whitespace-nowrap text-fg-strong max-[374px]:sr-only">AI Playground</span>
    </Link>
  );
}

/** Sticky header with the desktop nav (>= lg: six links need about 1000px in any font) and a disclosure menu (< lg). */
export function SiteHeader() {
  const pathname = usePathname();
  const pathKey = pathname ?? "";
  // The menu is open only for the path it was opened on, so navigating closes it without an effect.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathKey;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  // On open, focus the first link (no focus trap: the panel is a disclosure, not a modal).
  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>("a")?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpenFor(null);
      buttonRef.current?.focus();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setOpenFor(null);
    };
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setOpenFor(null);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    mq.addEventListener("change", onChange);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      mq.removeEventListener("change", onChange);
    };
  }, [open]);

  const primary = NAV_ITEMS.filter((i) => i.href !== "/progress");
  const utility = NAV_ITEMS.filter((i) => i.href === "/progress");

  return (
    <header ref={headerRef} className="sticky top-0 z-40 border-b border-border-subtle bg-canvas">
      <div className="mx-auto flex h-[var(--fm-header-h)] w-full max-w-[var(--fm-container)] items-center justify-between gap-4 px-4 md:px-6 lg:px-8">
        <BrandLink />

        <nav aria-label="Main" className="hidden flex-1 items-stretch justify-between self-stretch lg:flex">
          <ul className="ml-4 flex items-stretch lg:ml-8">
            {primary.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} active={isNavActive(item.href, pathname)} />
            ))}
          </ul>
          <ul className="flex items-stretch">
            {utility.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                active={isNavActive(item.href, pathname)}
                icon={<Settings2 aria-hidden="true" className="size-4" />}
              />
            ))}
          </ul>
        </nav>

        <button
          ref={buttonRef}
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpenFor(open ? null : pathKey)}
          className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-fg-strong hover:bg-surface lg:hidden"
        >
          {open ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
        </button>
      </div>

      <nav
        id="mobile-nav"
        ref={panelRef}
        aria-label="Main"
        hidden={!open}
        className="border-t border-border-subtle bg-surface-raised shadow-sm lg:hidden"
      >
        <ul className="mx-auto max-w-[var(--fm-container)] py-1">
          {NAV_ITEMS.map((item) => {
            const active = isNavActive(item.href, pathname);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpenFor(null)}
                  className={cn(
                    "flex h-12 items-center gap-3 px-4 text-base focus-visible:outline-offset-[-2px] md:px-6",
                    active ? "font-bold text-fg-strong" : "font-medium text-fg",
                  )}
                >
                  {/* Decorative marker (accent-2 never carries meaning; aria-current + bold do). */}
                  <span
                    aria-hidden="true"
                    className={cn("size-1 shrink-0 rounded-full", active ? "bg-accent-2" : "bg-transparent")}
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}

function NavLink({
  href,
  label,
  active,
  icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <li className="flex">
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative inline-flex items-center gap-2 px-3 text-sm transition-colors duration-[var(--fm-duration-fast)] focus-visible:transition-none",
          active ? "font-bold text-fg-strong" : "font-medium text-fg-muted hover:text-fg",
        )}
      >
        {icon}
        {label}
        {active ? <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-0.5 bg-link" /> : null}
      </Link>
    </li>
  );
}
