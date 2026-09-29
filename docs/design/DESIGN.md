# DESIGN: First Mate AI Playground

| | |
|---|---|
| Status | v1.0. Gates WS-A (design system and shell), and constrains WS-C, WS-D and WS-F UI. |
| Owner | UI/UX (Opus). Changes go through a PR that edits this file. |
| Date | 2026-09-30 |
| Implements | PRD §5 Epic D (D-1 to D-5), §8 routes, §9 states, §13 brand-contrast risk |
| Companion file | [`tokens.css`](./tokens.css): import it into `src/app/globals.css` (see §2.6) |

Read this doc in order the first time. After that, §4 (components), §6 (pages) and §9 (rubric) are the reference sections.

**Precedence.** If this doc conflicts with the PRD's acceptance criteria, the PRD wins and this doc gets fixed. If it conflicts with an implementer's taste, this doc wins.

---

## 0. Design principles

1. **The terminal is the product. The app is the map.** Learners do the work in their own CLI. The app's job is to get a command into their clipboard quickly and show them where they are. Copy buttons, commands and progress get visual priority over decoration.
2. **One idea, then two tools.** The concept is explained once, above the tabs. Tabs never hide the differences (L-1, L-3).
3. **Honest state.** Never show "not started" before we know (P-5). Never show an unscored item as ranked (N-2). Never show a stale digest as today's (N-3). An empty state always tells you the command that fixes it.
4. **Quiet brand.** Use firstmate.tech's palette, Satoshi and generous radii, at app density. There is one accent colour, and it marks what you can act on.

---

## 1. Brand extraction: what the live site actually uses

Fetched on 2026-09-30 from `https://www.firstmate.tech/` (HTML) and its compiled stylesheet `/_next/static/chunks/3oxqqn0tgxhzo.css`. The site is Next.js with Tailwind v4, so theme values appear as `--color-*` custom properties in `@layer theme`. The chunk hash changes on every deploy, so re-find the CSS from the `<link rel="stylesheet">` in the HTML.

### 1.1 Colours

| Value | Site name | Where it was found | Verdict |
|---|---|---|---|
| `#282943` | `--color-ink` | CSS `@layer theme`; `body{color:var(--color-ink)}` | Matches PRD. Body text. |
| `#131313` | `--color-black-ink` | CSS `@layer theme` | Matches PRD. Headings. |
| `#424bd1` | `--color-accent` | CSS `@layer theme`; primary CTA `bg-accent`; eyebrow `text-accent`; `focus-visible:ring-accent` | Matches PRD. Links, primary buttons, focus. |
| `#ec612a` | `--color-accent-2` | CSS `@layer theme`; used by the site as `text-sm text-accent-2` form error text | Matches PRD. **The site's own usage fails AA** (3.33:1). Decorative only here. |
| `#f9f9f9` | `--color-muted` | CSS; feature cards `rounded-[18px] bg-muted p-8` | Matches PRD. |
| `#f0f0f0` / `#e4e4e4` | `--color-stroke` / `--color-line` | CSS; header `border-b border-stroke` | Matches PRD. |
| `#8e8e8f` | `--color-date` | CSS | Matches PRD. Fails AA as text. Re-roled (see §2.3). |
| `#5f606c` | (arbitrary) `text-[#5f606c]` | CSS utility class | **New find.** The site already has an AA-passing grey (6.22:1). It becomes our metadata text colour. |
| `#1a7f3c` on `#e8f5ec` | arbitrary `text-[#1a7f3c]`, `bg-[#e8f5ec]` | CSS utility classes | Success pair. 4.51:1 is too close to the line, so the text is darkened. |
| `#b8731b` on `#fff4e5` | arbitrary | CSS utility classes | Warning pair. **3.51:1 fails.** Text darkened. |
| `#fdece7` | arbitrary `bg-[#fdece7]` | CSS utility class | Danger soft background. |
| `#e6edf3` on `#0f1729` | `.resource-body pre` | CSS (blog/resource code blocks, `border-radius:12px`) | Code block colours. Adopted as-is. |
| `#222`, `#333`, `#6f6f6f` | `--color-nav`, `--color-field`, `--color-scroll` | CSS | Not adopted. Covered by ink and muted. |
| `#002151`, `#1A74E0`, gradient `#00D9F2 → #2255DA` | logo fills | `/images/firstmate-logo.svg` | Logo only. Never used as UI colours. |

### 1.2 Typography

| Value | Source | Verdict |
|---|---|---|
| **Satoshi** 400, 400 italic, 500, 700 | `<link rel="preload">` for `Satoshi_Regular`, `Satoshi_Italic`, `Satoshi_Medium`, `Satoshi_Bold` `.woff2`; CSS `@font-face{font-family:satoshi;…font-display:swap}`; `--font-satoshi:"satoshi","satoshi Fallback"` | **Verified: the PRD is correct.** The site also ships **Italic 400**, which the PRD omits. We add it (§3.1). |
| Fallback `satoshi Fallback` = `local(Arial)` with `size-adjust:98.8%; ascent-override:102.23%; descent-override:24.29%; line-gap-override:10.12%` | CSS | This is next/font's `adjustFontFallback`. We get the same behaviour from `next/font/local`, which keeps CLS under 0.05 (D-4). |
| Mono: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace` | `--font-mono` | Adopted. |
| Weights used: 400 / 500 / 700 (600 is declared in the Tailwind theme but has no font file) | CSS | **Never use `font-semibold`.** It snaps to 700 in some browsers and is synthesised in others. |
| Body `16px/1.4`; content body `1.0625rem` (17px); dominant `leading-[1.6]` (117 uses) | CSS `body{…}`, HTML classes | Prose uses 17px/28px. UI uses 16px/24px. |
| Section H2 `text-[36px] font-bold leading-[1.3] text-ink` | HTML | Our page H1 at desktop is 36px. |
| Eyebrow `text-sm font-bold uppercase tracking-[0.12em] text-accent` | HTML | Adopted as the `Eyebrow` text style. |
| Hero H1 86px → 54px → 11vw | HTML | Marketing only. Not used in the app. |

**Licence.** Satoshi is by Indian Type Foundry and distributed through Fontshare under the ITF Free Font License, which allows commercial use and self-hosting. Download from `https://www.fontshare.com/fonts/satoshi`; don't hotlink the marketing site's hashed files. Put `Satoshi-Regular.woff2`, `Satoshi-Italic.woff2`, `Satoshi-Medium.woff2` and `Satoshi-Bold.woff2` in `public/fonts/` (owned by WS-A).

### 1.3 Shape, spacing, elevation, motion

| Value | Source | Verdict |
|---|---|---|
| Spacing base `--spacing: .25rem` (4px) | CSS | Tailwind default 4px scale. |
| Cards `rounded-[18px] bg-muted p-8` (65 uses) | HTML | `rounded-card` (18px). App cards use `p-5 md:p-6` because they are denser than marketing cards. |
| Buttons `rounded-xl` (12px) | HTML | Adopted. |
| Pills `rounded-full` (36 uses) | HTML | Badges and chips. |
| `--radius-md .375rem`, `--radius-lg .5rem`, `--radius-xl .75rem` | CSS | Tailwind defaults. Kept. |
| Code `pre` radius 12px | CSS | `rounded-xl`. |
| Shadow `0 1px 20px #8787871a`; `shadow-sm` | CSS | `shadow-md` and `shadow-sm`. Used sparingly. |
| Header `fixed … h-[60px] border-b border-stroke bg-white` | HTML | Sticky, 60px. |
| Containers `max-w-[1348px]` outer, `max-w-[1180px]` content, `max-w-[700px]` prose | HTML | 1180px content container. 700px reading measure. |
| Transitions: default `150ms cubic-bezier(.4,0,.2,1)`; `ease-out cubic-bezier(0,0,.2,1)`; durations 200 and 300ms | CSS | Motion tokens (§3.5). |
| `prefers-reduced-motion` | CSS (1 rule) | We go further (§3.5). |

### 1.4 Buttons on the site

| Site button | Classes (verbatim) | Our variant |
|---|---|---|
| Primary CTA | `h-[52px] rounded-xl bg-accent px-7 text-base font-bold text-white hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2` | `primary` (app size: 44px, see §4.1) |
| Header CTA | `h-11 rounded-xl bg-accent/5 px-5 text-sm font-medium text-accent hover:bg-accent/20` | `secondary` |
| On-dark ghost | `h-[52px] rounded-xl border border-white/40 px-7 font-bold text-white hover:bg-white/10` | Not needed. There are no dark bands in the app. |

### 1.5 Logo

- File: `https://www.firstmate.tech/images/firstmate-logo.svg` (825×169 viewBox). Header use: `<img alt="First Mate Technologies" class="h-9 w-auto">`, 36px tall.
- Fills: wordmark `#002151` (navy), secondary shapes `#1A74E0`, mark gradient `#00D9F2 → #2255DA`.
- **Dark mode problem:** the navy wordmark is about 1.1:1 on our dark canvas. WS-A ships two files, `public/brand/firstmate-logo.svg` (original) and `public/brand/firstmate-logo-dark.svg` (every `#002151` replaced with `#FFFFFF`; the blues and gradient are kept, and `#1A74E0` is 4.06:1 on dark, which is fine for graphics). Swap them with `<picture><source srcset="…-dark.svg" media="(prefers-color-scheme: dark)"><img …></picture>`.
- Usage rules: height 32px below `md` and 36px at `md` and up. Never recolour, stretch or add effects. Keep clear space of at least half the logo height on all sides. The logo is always followed by the product label "AI Playground" (see §5.1). It is never used inside content.

---

## 2. Colour tokens

All tokens are in [`tokens.css`](./tokens.css). Components use **semantic utilities only**: `bg-canvas`, `bg-surface`, `text-fg`, `text-fg-muted`, `border-border`, `text-link`, `bg-primary` and so on. Tailwind's default palette is removed (`--color-*: initial`), so `bg-blue-500` does not compile. Arbitrary colours such as `text-[#…]` still compile, and the rubric blocks them (§9, B-3).

### 2.1 Token table

| Token (utility) | Light | Dark | Role |
|---|---|---|---|
| `canvas` | `#ffffff` | `#12131f` | Page background |
| `surface` | `#f9f9f9` | `#1b1c2b` | Cards, sections, sidebars |
| `surface-raised` | `#ffffff` | `#242538` | Card on a surface, popovers, menu panel |
| `fg` | `#282943` | `#ededf3` | Body text |
| `fg-strong` | `#131313` | `#ffffff` | Headings |
| `fg-muted` | `#5f606c` | `#a4a6ba` | Metadata, helper text, dates, captions |
| `border` | `#e4e4e4` | `#2d2f45` | Card and section borders (decorative) |
| `border-subtle` | `#f0f0f0` | `#23243a` | Header bottom border, row separators |
| `divider` | `#e8e8e8` | `#2d2f45` | `<hr>` |
| `control-border` | `#8e8e8f` | `#7c7f96` | Boundary of inputs, selects, checkboxes, the file input (3:1 non-text) |
| `link` | `#424bd1` | `#9fa5ff` | Links, active nav, active tab indicator, eyebrow, score number |
| `primary` / `primary-hover` / `primary-fg` | `#424bd1` / `#353cb0` / `#fff` | `#424bd1` / `#5a62e0` / `#fff` | Primary button |
| `accent-soft` | `#ecedfa` | `#1d1f3d` | Selected or active fills, info notice, Key differences callout |
| `accent-subtle` | `#f5f6fd` | `#181a33` | Secondary button fill, hover rows |
| `accent-2` | `#ec612a` | `#f58a5c` | **Decorative only**: small shapes and illustrations, or text of at least 24px regular / 18.66px bold |
| `accent-2-strong` | `#a93d17` | `#ff9a7a` | If orange text is ever needed at small sizes |
| `success` / `success-soft` | `#16703a` / `#e8f5ec` | `#6fd39a` / `#16281f` | Completed, Exercise complete |
| `warning` / `warning-soft` | `#8a5410` / `#fff4e5` | `#f2b766` / `#2a2216` | May be outdated, stale digest, storage banner |
| `danger` / `danger-soft` | `#a93d17` / `#fdece7` | `#ff9a7a` / `#2c1c19` | Errors, reset confirmation |
| `focus` | `#424bd1` | `#9fa5ff` | Focus ring |
| `code-focus` | `#9fa5ff` | `#9fa5ff` | Focus ring **inside** code block chrome |
| `code-bg` / `code-header` / `code-fg` / `code-muted` / `code-border` | `#0f1729` / `#16203a` / `#e6edf3` / `#9aa4b2` / `#0f1729` | `#0b0f1c` / `#131a2e` / `#e6edf3` / `#9aa4b2` / `#2d3548` | Code blocks (dark in both themes, matching the site) |
| `progress-track` / `progress-fill` | `#e4e4e4` / `#424bd1` | `#2d2f45` / `#9fa5ff` | ProgressBar |
| `skeleton` | `#f0f0f0` | `#242538` | Skeleton blocks |

### 2.2 Usage rules

- **Headings** use `text-fg-strong`. **Body** uses `text-fg`. **Metadata** (dates, minutes, source names, "Verified …", counts) uses `text-fg-muted`. Nothing else is allowed for text.
- **`accent-2` never carries meaning** and never appears as text below 24px. In v1 its only sanctioned use is the 4px dot that marks the active nav item in the mobile menu (§5.1) and any illustration in empty states. If in doubt, don't use it.
- **Status is never colour alone.** Every success, warning and danger treatment carries an icon **and** a word: "Completed", "May be outdated", "Unscored".
- **Links in prose** are `text-link underline underline-offset-2 decoration-1`, with `hover:decoration-2`. Underlines are required in body text (1.4.1). Nav and card-title links may drop the underline because their position identifies them, and they underline on hover and focus.

### 2.3 Where the brand fails AA and what we changed

| Brand value | Problem | Change | Where it applies |
|---|---|---|---|
| `accent-2 #ec612a` | 3.33:1 on white. Fails for normal text. The site uses it for error text. | Decorative-only token. Added `accent-2-strong #a93d17` (6.24:1). Error text uses `danger`. | Everywhere. Rubric B-4. |
| `date #8e8e8f` | 3.27:1. Fails for text. | Moved to `control-border` (non-text, 3:1 is enough). Metadata text uses `fg-muted #5f606c` (6.22:1), a grey the site already uses. | Every date, source name and meta line. |
| Warning `#b8731b` on `#fff4e5` | 3.51:1. Fails. | `warning #8a5410` (5.76:1). | "May be outdated" badge, stale digest notice, storage banner. |
| Success `#1a7f3c` on `#e8f5ec` | 4.51:1. Passes by 0.01 and breaks on any tint drift. | `success #16703a` (5.48:1). | Completed badge, Exercise complete. |
| Error text `#ec612a` on `#fdece7` | 2.90:1. Fails. | `danger #a93d17` (5.44:1). | Error notices, reset field errors. |
| `accent #424bd1` in dark mode | 2.77:1 on the dark canvas. | Dark `link`/`focus` = `#9fa5ff` (8.17:1). Primary button keeps `#424bd1` (white label 6.65:1). | All dark-mode links, tabs, focus. |
| `accent` as progress fill in dark | 1.97:1 against the dark track. | Dark `progress-fill` = `#9fa5ff` (5.80:1). | ProgressBar. |
| `accent` focus ring on code blocks | 2.69:1 on `#0f1729`. | `code-focus #9fa5ff` inside `[data-code-chrome]`. | CodeBlock copy button. |
| GitHub-dark syntax comments `#6a737d` | 3.71:1 on `code-bg`. | Override the comment token to `#9aa4b2` (7.09:1). | CodeBlock highlighter theme (§4.5). |
| Logo navy `#002151` in dark | About 1.1:1. | Dark logo variant (§1.5). | Header, 404. |

### 2.4 Contrast ledger (WCAG 2.2 AA)

Ratios were computed with the WCAG relative-luminance formula. The requirement is 4.5:1 for text, 3:1 for large text (≥24px, or ≥18.66px bold) and for non-text UI boundaries and focus indicators. **Every pair passes.** Pairs not listed here are not allowed. Add a row, with its ratio, in the PR that introduces a new pair.

**Light**

| Foreground | Background | Ratio | Need | Used for |
|---|---|---|---|---|
| fg `#282943` | canvas `#ffffff` | 14.11 | 4.5 | Body |
| fg `#282943` | surface `#f9f9f9` | 13.40 | 4.5 | Card body |
| fg `#282943` | accent-soft `#ecedfa` | 12.13 | 4.5 | Callout body, active tab label |
| fg-strong `#131313` | canvas `#ffffff` | 18.58 | 4.5 | Headings |
| fg-muted `#5f606c` | canvas `#ffffff` | 6.22 | 4.5 | Metadata |
| fg-muted `#5f606c` | surface `#f9f9f9` | 5.91 | 4.5 | Metadata in cards |
| fg-muted `#5f606c` | accent-soft `#ecedfa` | 5.35 | 4.5 | Metadata in callouts |
| fg-muted `#5f606c` | skeleton/stroke `#f0f0f0` | 5.46 | 4.5 | Neutral badge |
| link `#424bd1` | canvas `#ffffff` | 6.65 | 4.5 | Links, nav active |
| link `#424bd1` | surface `#f9f9f9` | 6.31 | 4.5 | Links in cards |
| link `#424bd1` | accent-soft `#ecedfa` | 5.72 | 4.5 | Accent badge, active nav pill |
| link `#424bd1` | accent-subtle `#f5f6fd` | 6.17 | 4.5 | Secondary button |
| primary-fg `#ffffff` | primary `#424bd1` | 6.65 | 4.5 | Primary button |
| primary-fg `#ffffff` | primary-hover `#353cb0` | 8.66 | 4.5 | Primary button hover |
| canvas `#ffffff` | danger `#a93d17` | 6.24 | 4.5 | Danger button label |
| success `#16703a` | success-soft `#e8f5ec` | 5.48 | 4.5 | Success badge and notice |
| success `#16703a` | surface `#f9f9f9` | 5.84 | 4.5 | "Completed" text in rows |
| warning `#8a5410` | warning-soft `#fff4e5` | 5.76 | 4.5 | Warning badge and notice |
| danger `#a93d17` | danger-soft `#fdece7` | 5.44 | 4.5 | Danger notice |
| danger `#a93d17` | canvas `#ffffff` | 6.24 | 4.5 | Field error text |
| accent-2 `#ec612a` | canvas `#ffffff` | 3.33 | 3.0 | Decorative / ≥24px only |
| code-fg `#e6edf3` | code-bg `#0f1729` | 15.13 | 4.5 | Code |
| code-muted `#9aa4b2` | code-bg `#0f1729` | 7.09 | 4.5 | Code comments |
| code-muted / code-fg | code-header `#16203a` | 6.40 / 13.65 | 4.5 | Code label / Copy button, clipboard hint |
| control-border `#8e8e8f` | canvas / surface | 3.27 / 3.11 | 3.0 | Input and checkbox boundaries |
| focus `#424bd1` | canvas / surface | 6.65 / 6.31 | 3.0 | Focus ring |
| code-focus `#9fa5ff` | code-bg / code-header | 8.46 / 7.14 | 3.0 | Focus inside code chrome |
| progress-fill `#424bd1` | progress-track `#e4e4e4` | 5.23 | 3.0 | Progress fill |

**Dark**

| Foreground | Background | Ratio | Need | Used for |
|---|---|---|---|---|
| fg `#ededf3` | canvas `#12131f` | 15.82 | 4.5 | Body |
| fg `#ededf3` | surface `#1b1c2b` | 14.43 | 4.5 | Card body |
| fg `#ededf3` | surface-raised `#242538` | 12.89 | 4.5 | Menu panel |
| fg `#ededf3` | accent-soft `#1d1f3d` | 13.69 | 4.5 | Callout body |
| fg-strong `#ffffff` | canvas `#12131f` | 18.44 | 4.5 | Headings |
| fg-muted `#a4a6ba` | canvas / surface / raised | 7.68 / 7.01 / 6.26 | 4.5 | Metadata |
| fg-muted `#a4a6ba` | accent-soft `#1d1f3d` | 6.64 | 4.5 | Metadata in callouts |
| link `#9fa5ff` | canvas / surface / raised | 8.17 / 7.45 / 6.66 | 4.5 | Links |
| link `#9fa5ff` | accent-soft `#1d1f3d` | 7.07 | 4.5 | Accent badge |
| primary-fg `#ffffff` | primary `#424bd1` | 6.65 | 4.5 | Primary button |
| primary-fg `#ffffff` | primary-hover `#5a62e0` | 4.93 | 4.5 | Primary hover |
| success `#6fd39a` | success-soft `#16281f` | 8.44 | 4.5 | Success |
| success `#6fd39a` | surface `#1b1c2b` | 9.19 | 4.5 | "Completed" in rows |
| warning `#f2b766` | warning-soft `#2a2216` | 8.77 | 4.5 | Warning |
| danger `#ff9a7a` | danger-soft `#2c1c19` | 7.89 | 4.5 | Danger |
| danger `#ff9a7a` | canvas `#12131f` | 8.92 | 4.5 | Field error |
| accent-2 `#f58a5c` | canvas `#12131f` | 7.62 | 3.0 | Decorative |
| code-fg `#e6edf3` | code-bg `#0b0f1c` | 16.17 | 4.5 | Code |
| code-muted `#9aa4b2` | code-bg `#0b0f1c` | 7.57 | 4.5 | Code comments |
| code-muted / code-fg | code-header `#131a2e` | 6.85 / 14.63 | 4.5 | Code label / Copy button, clipboard hint |
| code-focus `#9fa5ff` | code-header `#131a2e` | 7.66 | 3.0 | Copy button focus |
| link `#9fa5ff` | accent-subtle `#181a33` | 7.53 | 4.5 | Secondary button |
| fg-muted `#a4a6ba` | border-subtle `#23243a` | 6.31 | 4.5 | Neutral badge |
| danger `#ff9a7a` | danger-soft `#2c1c19` | 7.89 | 4.5 | Danger button (soft, bordered) |
| control-border `#7c7f96` | canvas / surface / raised | 4.68 / 4.27 / 3.82 | 3.0 | Input boundaries |
| focus `#9fa5ff` | canvas / surface / raised | 8.17 / 7.45 / 6.66 | 3.0 | Focus ring |
| progress-fill `#9fa5ff` | progress-track `#2d2f45` | 5.80 | 3.0 | Progress fill |

**Syntax colours** (GitHub Dark theme with the comment override) on `code-bg`, light / dark: keyword `#f97583` 6.72 / 7.19, string `#9ecbff` 10.59 / 11.32, function `#b392f0` 7.05 / 7.54, constant `#79b8ff` 8.61 / 9.20, text `#e1e4e8` 14.01 / 14.98, parameter `#ffab70` 9.63 / 10.29, tag `#85e89d` 11.94 / 12.76, comment **`#9aa4b2`** 7.09 / 7.57.

> **Recommendation for WS-A:** add a Vitest test that parses `tokens.css` and asserts every pair in this ledger. That turns the ledger into a regression gate.

### 2.5 Dark mode

- The theme comes only from `prefers-color-scheme` (D-5). There is no toggle and no `data-theme`. Playwright covers it with `page.emulateMedia({ colorScheme: 'dark' })`.
- Shadows become 1px borders in dark mode (tokens already do this).
- Code blocks stay dark in both themes. In dark mode they get a `code-border` 1px border to separate from the canvas.
- The logo swaps to the dark variant (§1.5).

### 2.6 Wiring (WS-A)

```css
/* src/app/globals.css */
@import "tailwindcss";
@import "./tokens.css"; /* copy of docs/design/tokens.css; keep them identical (CI can diff them) */
```

```ts
// src/app/layout.tsx
import localFont from "next/font/local";
const satoshi = localFont({
  src: [
    { path: "../../public/fonts/Satoshi-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/Satoshi-Italic.woff2",  weight: "400", style: "italic" },
    { path: "../../public/fonts/Satoshi-Medium.woff2",  weight: "500", style: "normal" },
    { path: "../../public/fonts/Satoshi-Bold.woff2",    weight: "700", style: "normal" },
  ],
  variable: "--font-satoshi",
  display: "swap",
  adjustFontFallback: "Arial",
});
// <html lang="en" className={satoshi.variable}>
```

The tokens were compile-tested against Tailwind v4.3: semantic utilities generate and `bg-blue-500` does not. If M0 lands Tailwind v3 instead, keep the `:root` blocks and move the `@theme` mapping into `tailwind.config.ts` `theme.extend` with the palette replaced.

---

## 3. Type, spacing, radii, elevation, motion

### 3.1 Type scale (Satoshi; weights 400/500/700 only)

| Style | Utility | Size / line | Weight | Colour | Use |
|---|---|---|---|---|---|
| Page title | `text-3xl md:text-4xl font-bold` | 30/38 → 36/44 | 700 | fg-strong | One `<h1>` per page |
| Section title | `text-2xl font-bold` | 24/32 | 700 | fg-strong | `<h2>`: level sections, "Today's digest", lesson sections |
| Card title | `text-lg md:text-xl font-bold` | 18/28 → 20/24 | 700 | fg-strong | `<h3>`: news titles, level cards, exercise title |
| Eyebrow | `text-sm font-bold uppercase tracking-eyebrow text-link` | 14/20 | 700 | link | "Level 2", "Continue", "Today" |
| Prose | `text-prose` | 17/28 | 400 | fg | Lesson concept, tab panels, why-it-matters |
| UI body | `text-base` | 16/24 | 400 | fg | Forms, rows, notices |
| UI label | `text-sm font-medium` | 14/20 | 500 | fg | Buttons (sm), tabs, badges, filter labels |
| Meta | `text-sm` | 14/20 | 400 | fg-muted | Dates, source, minutes, Verified line |
| Micro | `text-xs font-medium` | 12/16 | 500 | fg-muted | Code block language label, badge (sm) |
| Code | `font-mono text-[0.875rem] leading-6` | 14/24 | 400 | code-fg | Blocks and inline code |

- Inline code: `font-mono text-[0.9em] bg-surface border border-border rounded-md px-1.5 py-0.5` in `text-fg`. No colour shift.
- Italic 400 is loaded so markdown `*emphasis*` is not synthesised. Bold-italic is synthesised; this is accepted because it is rare in lessons.
- Prose measure is at most 700px (`max-w-[var(--fm-measure)]`, about 75 characters at 17px).
- Numerals in scores and progress counts use `tabular-nums`.

### 3.2 Spacing

A 4px base using Tailwind's default scale. These rhythm rules are the ones reviewers check:

| Relationship | Value |
|---|---|
| Page gutter | `px-4` (<md), `px-6` (md), `px-8` (lg+) |
| Header → page title | `pt-8 md:pt-12` |
| Page title → first section | `mt-6 md:mt-8` |
| Between sections | `mt-12 md:mt-16` |
| Section title → content | `mt-4` |
| Card padding | `p-5 md:p-6` (marketing uses `p-8`; the app is denser) |
| Stack inside a card | `gap-3` |
| List rows | `py-3` with an `border-subtle` separator |
| Inline groups (badges, buttons) | `gap-2` |

### 3.3 Radii

| Token | Value | Use |
|---|---|---|
| `rounded-md` | 6px | Inline code, small inputs |
| `rounded-lg` | 8px | Inputs, selects, notices, skeleton rows |
| `rounded-xl` | 12px | Buttons, code blocks, tabs container |
| `rounded-card` | 18px | Cards (site signature) |
| `rounded-full` | pill | Badges, tag chips, progress bars, icon buttons |

### 3.4 Elevation

The app is flat. `shadow-sm` is for the open mobile menu panel and the sticky header once scrolled past 8px (optional). `shadow-md` is for card hover on clickable cards only. Dark mode turns both into borders. Nothing else gets a shadow.

### 3.5 Motion

| Token | Value | Use |
|---|---|---|
| `--fm-duration-fast` | 150ms | Colour and background transitions on hover and focus |
| `--fm-duration-base` | 200ms | Disclosure open/close, menu panel |
| `--fm-duration-slow` | 300ms | Not used in v1. Reserved. |
| `--fm-ease-standard` | cubic-bezier(.4,0,.2,1) | Default |
| `--fm-ease-out` | cubic-bezier(0,0,.2,1) | Entering elements |

- **No motion on**: tab switching (it's instant; L-2 caps scroll shift), route changes, list rendering, scroll reveals (content must never start at `opacity:0`), or the "Copied" state change (text and icon swap only).
- **Skeleton pulse**: `animate-pulse` at the default 2s. Under reduced motion it is static.
- **Reduced motion** (`tokens.css` §4): durations go to 0, animations are clamped, and smooth scrolling is off. `scrollIntoView` calls must pass `behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'`, or just `'auto'`.

---

## 4. Component specs

Everything lives in `src/components/ui/` (WS-A). WS-C, WS-D and WS-F compose these and don't restyle them. Class strings are the intended output, not a mandate on internal structure.

### 4.0 Shared rules

- **Focus**: the global `:focus-visible` rule in `tokens.css` draws a 2px ring with 2px offset. **Don't add `outline-none`.** In Tailwind v4, `outline-none` sets `--tw-outline-style:none`, and a later `focus-visible:outline-2` then renders nothing unless you also add `focus-visible:outline-solid`. Leave focus to the global rule.
- **Hit targets**: at least 24×24px everywhere, and at least 44×44px when `(pointer: coarse)`. Implement with `min-h-11 min-w-11` inside `@media (pointer: coarse)`, via a `touch:` custom variant (`@custom-variant touch (@media (pointer: coarse));`), or by padding.
- **Icons**: lucide-react, 16px in UI and 20px in empty states, `aria-hidden="true"`. They are always paired with text, or the control has an `aria-label`.
- **Disabled**: use `aria-disabled="true"` plus explicit styling (`opacity-50 cursor-not-allowed`) on buttons that must stay focusable to explain why. Use native `disabled` only when there is nothing to explain.
- **One live region per page**: the shell renders `<div id="fm-live" aria-live="polite" class="sr-only">` once. Components announce with a small `announce(text)` helper that clears the region and sets the text on the next frame. Don't create per-component live regions. The exception is `Notice` with `role="status"` (§4.10).

### 4.1 Button

| Variant | Classes (light and dark via tokens) | Use |
|---|---|---|
| `primary` | `bg-primary text-primary-fg hover:bg-primary-hover font-bold` | The single main action on a surface: "Continue", "Mark complete", "Replace my progress" |
| `secondary` | `bg-accent-subtle text-link hover:bg-accent-soft font-medium` | Secondary actions: "Export", "Retry", "See all" as a button |
| `ghost` | `bg-transparent text-fg hover:bg-surface font-medium` | Toolbars, icon buttons, "Undo" |
| `danger` | `bg-danger text-canvas hover:opacity-90 font-bold`, light only. Dark: `bg-danger-soft text-danger border border-danger` | "Reset all progress" only |
| `link` | `text-link underline underline-offset-2 p-0 h-auto` | Inline actions inside text |

Sizes: `md` = `h-11 px-5 text-base rounded-xl` (default; 44px meets the touch target). `sm` = `h-9 px-3 text-sm rounded-xl` (desktop toolbars; grows to 44px on coarse pointers). `icon` = `size-9 rounded-full`, or `size-11` on coarse pointers.

- Content: an optional leading icon 16px and a label, with `gap-2`. A loading state keeps the width (use `min-w` set to the idle width), shows a 16px spinner in place of the leading icon, and sets `aria-busy="true"`. Under reduced motion the spinner doesn't spin and shows "…" after the label.
- Links that look like buttons stay `<a>` (Next `<Link>`). Actions are `<button type="button">`.
- Dark `danger` contrast: `#ff9a7a` on `#2c1c19` is 7.89:1. Light `danger` label: canvas `#fff` on `#a93d17` is 6.24:1.
- Only **one `primary`** per visible region (header card, exercise panel, page).

### 4.2 Card

- Base: `rounded-card bg-surface p-5 md:p-6`. In dark mode it adds `border border-border`. In light mode there is no border, matching the site's `bg-muted` cards.
- `Card.Header` holds an eyebrow, title (`h2`/`h3` as the page outline requires; the component takes an `as` prop) and optional actions on the right. `Card.Body` and `Card.Footer` follow.
- **Clickable card**: only when the card has a single destination (level card, bookmark lesson card). Use the "stretched link" pattern: the title `<a>` gets `after:absolute after:inset-0`, and the card is `relative`. Hover is `shadow-md` in light and `border-link` in dark. Focus shows the ring on the card through `:has(a:focus-visible)` (`has-[a:focus-visible]:outline-2 outline-solid outline-focus outline-offset-2`). Secondary interactive elements inside get `relative z-10`.
- **Never nest interactive elements** inside a stretched card except with `relative z-10`. News cards are **not** stretched (§4.12).

### 4.3 Badge

`inline-flex items-center gap-1 rounded-full h-6 px-2.5 text-xs font-medium`, with an optional 12px leading icon.

| Variant | Colours | Canonical uses (icon + text) |
|---|---|---|
| `neutral` | `bg-border-subtle text-fg-muted` (5.46:1) | Est. minutes ("12 min"), "Manual verification", "Unscored" |
| `accent` | `bg-accent-soft text-link` | Level ("L3"), active filter count |
| `success` | `bg-success-soft text-success` | `Check` "Completed", `Check` "Exercise complete" |
| `warning` | `bg-warning-soft text-warning` | `AlertTriangle` "May be outdated" |
| `danger` | `bg-danger-soft text-danger` | `ShieldAlert` "Security" tag only (§4.12) |
| `tag` | `bg-canvas border border-border text-fg` | News tags (except security) |

Badges are not interactive. Filter chips with a remove button are a separate `FilterChip`: a badge plus a `button` with `aria-label="Remove filter: tooling"`, 24px min, and 44px on coarse pointers.

### 4.4 Tabs: Claude Code | Codex CLI (L-2, E-1)

**Anatomy**

```
┌───────────────────────────────────────────────┐
│ [✱ Claude Code]  [▢ Codex CLI]                │ ← role=tablist, border-b border-border
│ ━━━━━━━━━━━━━━                                │ ← 2px link-coloured bar under the active tab
├───────────────────────────────────────────────┤
│ tab panel (prose + code blocks)               │ ← role=tabpanel, tabindex=0
└───────────────────────────────────────────────┘
```

- Tab: `h-11 px-4 inline-flex items-center gap-2 text-sm font-medium` with a 16px icon and a text label. Inactive: `text-fg-muted hover:text-fg`. **Active: `text-fg-strong font-bold`, plus a 2px bottom bar in `link`, plus `aria-selected="true"`.** The active state differs by weight, colour and bar, never by colour alone (D-1).
- Icons: monochrome, `currentColor`. Claude Code uses the lucide `Asterisk` glyph; Codex CLI uses lucide `Hexagon`. These are neutral stand-ins; swap them for the vendors' official monochrome marks once someone has checked the trademark guidance. The label text is always present.
- Tablist fills the width of the content column. On 360px, the two tabs are side by side (each label is under 12 characters). No accordion (D-3).

**ARIA (APG tabs, automatic activation)**

- `div[role=tablist][aria-label="Tool instructions"]`. The exercise panel's instance uses `aria-label="Starting prompt"` so screen-reader users can tell the two tablists apart.
- Each tab: `button[role=tab][id=tab-{scope}-{tool}][aria-controls=panel-{scope}-{tool}][aria-selected]`, with `tabindex=0` on the active tab and `-1` on the other (roving tabindex).
- Each panel: `div[role=tabpanel][id=panel-{scope}-{tool}][aria-labelledby=tab-{scope}-{tool}][tabindex=0]`. The inactive panel has the `hidden` attribute. **Both panels are server-rendered**, so switching needs no fetch.

**Keyboard**

| Key | Action |
|---|---|
| Left / Right | Move focus to the previous or next tab **and activate it** (wraps around) |
| Home / End | First / last tab, activated |
| Tab | From the active tab into the panel (the panel is focusable) |
| Enter / Space | No-op on an already active tab (automatic activation makes it redundant; harmless) |

Automatic activation is right here because both panels are already in the DOM.

**URL and preference sync**

1. **Server render.** The page reads `searchParams.tool`. `claude` or `codex` selects that tab. Anything else, including a missing or invalid value, renders **Claude Code**. The server never reads prefs (P-5).
2. **On mount, with no `?tool` param**: read `prefs.tool`. If it is `codex`, switch to Codex without animation and write `?tool=codex` into the URL with `history.replaceState`. If it is `claude` or missing, do nothing and leave the URL clean.
3. **On mount, with a valid `?tool`**: the URL wins. **Don't overwrite `prefs.tool`** just because a shared link was opened; the preference records choices, not visits.
4. **On user activation** (click or key): update both tab sets on the page (lesson tabs and starter-prompt tabs share state through one client context), set `prefs.tool`, and call `window.history.replaceState(null, "", url)`, where `url` is the current URL with `tool` set and the hash kept.
   - **Use `history.replaceState`, not `router.replace` or `router.push`.** Lesson routes are dynamic (S-3), so `router.replace` refetches the RSC payload, costs a round trip and can move scroll. Next 15 syncs native `replaceState` into `useSearchParams`.
   - `replace`, not `push`: flipping tabs must not fill Back history.
5. **Scroll**: nothing scrolls. Panel heights differ, so a switch can move content **below** the tabs; content **above** them doesn't move. If the tablist has been scrolled above the viewport top when a tab is activated (possible with the exercise tabs), keep the tablist's viewport offset constant: measure `getBoundingClientRect().top` before switching and `scrollBy` the difference after. This keeps L-2's 50px rule true.
6. **Storage unavailable (P-3)**: tabs still work, and the URL still updates. The preference just isn't saved.

**States**

- Pre-hydration: the server-selected tab shows. The pref-driven switch in step 2 happens once, immediately after mount. It is acceptable because it happens at page top before the user interacts. Don't hide the tabs while waiting.
- No native equivalent: the panel shows a `Notice` (variant `neutral`, icon `Info`, title "No native equivalent in Codex CLI (as of v0.x.y)"), followed by `h4` "Closest workaround" and prose. The panel is never empty (L-3).

### 4.5 CodeBlock with copy (L-4)

**Anatomy**

```
┌─ code-header ─────────────────────────────────┐
│ bash                                [⧉ Copy]  │ ← data-code-chrome; label = filename or language
├─ code-bg ─────────────────────────────────────┤
│ cp -r exercises/ex-1-1/starter ~/fm-ex/… && … │ ← <pre tabindex=0>, scrolls horizontally
└───────────────────────────────────────────────┘
```

- Wrapper: `<figure data-code-chrome class="rounded-xl overflow-hidden border border-code-border bg-code-bg">`.
- Header: `flex items-center justify-between h-10 px-3 bg-code-header`. Label: `<figcaption class="text-xs font-medium text-code-muted font-mono">`, showing the fence's filename if given (` ```ts title="src/app/page.tsx" `), otherwise the language (`bash`, `ts`, `json`, `toml`). A fence with no language gets the label "text".
- Body: `<pre tabindex="0" aria-label="Code: {label}" class="overflow-x-auto p-4 text-[0.875rem] leading-6 text-code-fg">`. **No wrapping.** Long lines scroll inside the block (D-3). The `pre` is focusable so keyboard users can scroll it (axe `scrollable-region-focusable`).
- Highlighting: Shiki, run on the server, theme `github-dark` with the background overridden to `var(--fm-code-bg)` and the comment colour to `#9aa4b2` (§2.4). No client-side highlighter.
- Copy button: `ghost`-style, sized `sm` (`h-8 px-2.5`, and 44px on coarse pointers), `text-code-fg hover:bg-white/10`, with icon `Copy` and the visible label "Copy". Accessible name: "Copy code" plus the label, for example "Copy code: bash". The focus ring uses `code-focus` automatically (tokens.css `[data-code-chrome]`).

**Behaviour**

1. Click → `navigator.clipboard.writeText(raw)`, where `raw` is the fence's **source text** (not `innerText` of the highlighted DOM), with only the final trailing newline trimmed.
2. Success → the icon becomes `Check`, the label becomes "Copied", and the button's accessible name becomes "Copied". Call `announce("Copied")` into the page's polite live region. After 2000ms, revert. Repeated clicks restart the timer. Focus stays on the button.
3. **Clipboard denied or unavailable** (the promise rejects, or `navigator.clipboard` is undefined on a non-secure origin):
   - Select the code: `Range.selectNodeContents(codeEl)` → `getSelection().addRange`.
   - Move focus to the `<pre>` so the selection is live for the keyboard shortcut.
   - Show an inline hint directly under the header, inside the figure: `<p class="px-3 py-2 text-sm bg-code-header text-code-fg border-t border-code-border">Press ⌘C to copy</p>`. Use "Ctrl+C" when not on macOS (`navigator.userAgentData?.platform ?? navigator.platform`).
   - `announce("Copy blocked. Code selected. Press ⌘C to copy.")`.
   - The hint stays until the next click anywhere outside the block or 8s, whichever is later. The button label reads "Copy" again (not "Failed").
4. Shell blocks never include a `$ ` prompt. If authors add one, the seed validation should flag it (a WS-B note).

**Variants**: `CodeBlock` (fenced, above) and `CommandLine`, a single-line variant for setup and verify commands in the exercise panel and in empty states. `CommandLine` has the same chrome with the label as an explicit prop ("Setup", "Verify", "Terminal").

### 4.6 Checkbox (E-2)

- **Native `<input type="checkbox">`**, `size-5`, `accent-color: var(--fm-primary)`, `rounded` via the UA. Use the native control; don't restyle it with a custom box. It stays accessible and matches D-2 without custom ARIA.
- Row: `<label class="flex items-start gap-3 py-2.5 min-h-11 cursor-pointer">`, containing the checkbox (`mt-0.5`) and `<span class="text-base text-fg">`. The whole row is the hit target (44px).
- Checked: the text is **not** struck through (legibility). The native check is the signal, and the list's count updates.
- The checklist header: "Checklist" (h4) plus a meta line reading "3 of 5 done", with a `ProgressBar` size `sm`. When everything is checked, the header's meta is replaced by a success Badge `Check` "Exercise complete", and `announce("Exercise complete")` fires once on the transition, not on page load.
- Pre-hydration: checkboxes render **unchecked and disabled** with `aria-busy` on the list, then enable after mount. Don't render a checked state from the server (P-5). Keeping them disabled for the few ms before hydration prevents a lost click.

### 4.7 ProgressBar (C-2)

- `div[role=progressbar][aria-valuemin=0][aria-valuemax=100][aria-valuenow={pct}][aria-label="Level 3 progress"]`, with `aria-valuetext="2 of 4 lessons complete"`.
- Track: `h-1.5 rounded-full bg-progress-track`. Fill: `bg-progress-fill rounded-full` with its width as a percentage and `transition-[width] duration-[var(--fm-duration-base)]`.
- Always paired with a visible text count ("2 / 4") next to or above the bar, in `text-sm text-fg-muted tabular-nums`. The bar is supplementary; the text carries the meaning.
- Sizes: `sm` (h-1.5) for rows and checklists, `md` (h-2) for level headers and home level cards.
- **Pre-hydration:** render a `Skeleton` with the exact track dimensions and a text placeholder `Skeleton` 3ch wide. **No `role=progressbar` until mounted**, so tests and assistive tech never see a false 0. After mount, swap in the real bar (same box, so no CLS).
- Edge: 0 lessons in a level shows the track with "0 / 0" and `aria-valuenow=0`. That can't happen with seeded content, but must not throw.

### 4.8 Skeleton

- `div[aria-hidden=true] class="bg-skeleton rounded-lg animate-pulse"`. Reduced motion makes it static (global rule).
- **Skeletons match the final layout box for box.** Each page's `loading.tsx` composes skeletons shaped like its real rows and cards (§6), with the same heights, gaps and grid. Measure CLS in the Playwright check.
- The container of a skeleton region carries `aria-busy="true"` plus a single `<span class="sr-only" role="status">Loading curriculum…</span>`.
- Presets: `Skeleton.Text` (h-4, widths 100%, 90%, 60%), `Skeleton.Title` (h-7 w-2/3), `Skeleton.Badge` (h-6 w-16 rounded-full), `Skeleton.Row` (a lesson row), `Skeleton.NewsCard`.

### 4.9 EmptyState

- `section class="rounded-card border border-dashed border-border bg-canvas p-6 md:p-8"`, left-aligned, `max-w-xl`.
- Content: a 20px icon in a `size-10 rounded-full bg-accent-soft text-link` circle (decorative); title `h2`/`h3` `text-lg font-bold`; body `text-base text-fg-muted` (1–2 sentences); then **either** a `CommandLine` (when the fix is a terminal command) **or** an action (`Link` as secondary button or text link), or both. Maximum one primary action.
- Copy pattern: "\<what's missing\>. \<what fixes it\>." Never "Oops". Examples are in §7.

### 4.10 Notice

The inline message primitive for banners and callouts.

| Variant | Colours | Icon | Use |
|---|---|---|---|
| `info` | `bg-accent-soft text-fg`, icon `text-link` | `Info` | "Key differences" is *not* a Notice (see §6.3); used for "Compare with reference" hints |
| `neutral` | `bg-surface text-fg border border-border` | `Info` | "No native equivalent" inside a tab |
| `success` | `bg-success-soft`, title `text-success` | `CheckCircle2` | Import succeeded |
| `warning` | `bg-warning-soft`, title `text-warning` | `AlertTriangle` | Stale digest, storage unavailable, corrupted state reset, "May be outdated" explanation |
| `danger` | `bg-danger-soft`, title `text-danger` | `XCircle` | DB unreachable, import failed, route errors |

- Layout: `flex gap-3 rounded-lg p-4`, containing the icon (20px, `mt-0.5`), then a content column: title `font-bold`, body `text-base`, an optional `CommandLine` and optional actions. Body text is `text-fg` in every variant; only the title and icon take the status colour.
- Dismissible: an icon button (`X`, `aria-label="Dismiss notice"`) at top-right. After dismissal, focus moves to the `<main>` heading (h1), which is `tabindex=-1`.
- **Live-region rule**: a Notice **rendered after mount because of an event** (corrupted-state reset, storage-blocked detection, import result) gets `role="status"`. A Notice present in the server HTML (stale digest, DB-down page) gets **no** live role, because it's just content. **Never use `role="alert"`**. Nothing in this app is urgent enough to interrupt.

### 4.11 Global banners (P-2, P-3)

These live in a `GlobalNotices` slot directly under the header, inside the container, above `<main>`'s h1. They are client-only and appear after mount.

- **Storage unavailable (P-3)**: `warning` Notice, compact single line. Title "Progress can't be saved in this browser." Body: "Everything still works for this visit. Private windows and blocked site data prevent saving." Not dismissible, because the condition persists. `role="status"`.
- **Corrupted state (P-2)**: `warning` Notice, dismissible. Title "Saved progress was unreadable and has been reset." Body: "If you exported a backup, you can import it on the Progress page." with a link to `/progress`. `role="status"`. Dismissal is session-only.
- If both would show, show only the storage banner. Corruption can't be persisted anyway.

### 4.12 News card (N-1, N-2, N-5)

**Anatomy (scored)**

```
┌──────────────────────────────────────────────────────────────┐
│ ┌────┐  Anthropic ships Claude Opus 5.5 with 1M context   ↗ [🔖]│  ← h3 link (external) + bookmark toggle
│ │ 87 │  Anthropic news · Tue 30 Sep, 06:10                    │  ← meta: source · <time>
│ │/100│  [New model] [Tooling]                                 │  ← tag badges
│ └────┘  WHY IT MATTERS                                        │  ← eyebrow (fg-muted, not link colour)
│         Client MVPs on Opus can drop the chunking layer in…  │  ← plain text, 1–2 sentences
└──────────────────────────────────────────────────────────────┘
```

- Container: `<article class="rounded-card bg-surface p-5 md:p-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">`, with `aria-labelledby` pointing at the title id.
- **Score tile**: `size-14 rounded-xl bg-canvas border border-border flex flex-col items-center justify-center`. The number is `text-xl font-bold text-link tabular-nums`, with a `text-xs text-fg-muted` "/100" under it. Accessible text: `<span class="sr-only">Relevance score</span> 87 <span class="sr-only">out of 100</span>`. **No traffic-light colouring by score.** The score is a ranking signal, not a status. At 360px the tile shrinks to `size-12`.
- **Title**: `h3 > a`, `text-lg font-bold text-fg-strong hover:text-link hover:underline`, `href` = source URL, `target="_blank" rel="noopener noreferrer"`, followed by a 14px `ArrowUpRight` icon and `<span class="sr-only">(opens in new tab)</span>`. The titles come from feeds; render them as text and never as HTML.
- **Meta line**: `text-sm text-fg-muted`: source name, then ` · `, then `<time datetime="{published_at ISO}">Tue 30 Sep, 06:10</time>`. Times are shown in Asia/Manila with the `en-PH` format "EEE d MMM, HH:mm". The digest header carries the date, so on `/news` the meta shows only the time when the item is from the digest date.
- **Tags**: `Badge` variant `tag`, with labels mapped from the enum: `new-model` → "New model", `tooling` → "Tooling", `framework` → "Framework", `business` → "Business", and `security` → **variant `danger`** with a `ShieldAlert` icon, "Security". Order is fixed as listed so the security chip is always last.
- **Why it matters**: eyebrow "Why it matters" (`text-xs font-bold uppercase tracking-eyebrow text-fg-muted`, not the link colour, to keep link colour for things you can act on), then `<p class="text-prose">`. **Plain text only** (PRD §13 injection). The field is capped at 280 characters by the pipeline, so there's no truncation in the UI.
- **Bookmark**: icon button `Bookmark` / `BookmarkCheck`, `aria-pressed`, `aria-label="Bookmark: {title}"`, in the grid's top-right corner. Pre-hydration it renders unpressed and `aria-disabled`, then enables after mount.
- **Card is not a stretched link.** It has two interactive elements.

**Variants**

- `unscored` (N-2): no score tile, and the grid collapses to one column. The meta line gets a `neutral` badge "Unscored" (or "Scoring failed" when `scoring_status=failed`). No tags, no why-it-matters. The title link stays.
- `compact` (home top 3): no why-it-matters text and no tags. The score tile is `size-12`. Title, source and time only.
- `unavailable` (N-5, bookmarks): `bg-surface border border-dashed border-border`, text "Item no longer available" in `text-fg-muted`, with a "Remove bookmark" ghost button. No link.

---

## 5. Layout and navigation shell

### 5.1 Shell regions

```
<body>
  [Skip to content]                   ← first focusable, sr-only until focused
  <header>  sticky top-0 h-[60px] bg-canvas border-b border-border-subtle z-40
  <GlobalNotices/>                    ← §4.11
  <main id="main" tabindex="-1">      ← container: mx-auto max-w-[1180px] px-4 md:px-6 lg:px-8
  <footer>                            ← border-t border-border-subtle, text-sm text-fg-muted
  <div id="fm-live" aria-live="polite" class="sr-only"/>
</body>
```

**Header (≥ md, 768px+)**

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│ [FM logo] AI Playground     Curriculum  Exercises  News  Bookmarks      Progress │
│                             ━━━━━━━━━━                                            │
└───────────────────────────────────────────────────────────────────────────────────┘
```

- Left: `<a href="/">` containing the logo `<img alt="First Mate">` (h-9) and `<span class="text-sm font-bold text-fg-strong">AI Playground</span>`, with `gap-3` and a 1px `border-l border-border h-5` divider between them. Accessible name: "First Mate AI Playground, home".
- Nav: `<nav aria-label="Main">` holding a `<ul>` of links `h-[60px] inline-flex items-center px-3 text-sm font-medium text-fg-muted hover:text-fg`. **Active: `text-fg-strong font-bold` plus a 2px `link` bar pinned to the header's bottom edge, plus `aria-current="page"`.**
- Active matching: `/curriculum` is active for `/curriculum` and `/lessons/*`. `/exercises` is active for `/exercises`. `/news` is active for `/news` **and** `/news/archive`. `/bookmarks` and `/progress` match exactly. `/` activates nothing (the logo is home).
- "Progress" sits alone on the right with a lucide `Settings2` icon plus text, because it is utility rather than content.
- At md (768–1023px) all 5 links still fit: about 470px of links plus about 220px of brand fits in 720px. Verify at 768px; if they don't fit, drop the "AI Playground" label below lg first.

**Header (< md)**

```
┌──────────────────────────────────────┐
│ [FM logo] AI Playground        [☰]  │
└──────────────────────────────────────┘
  open:
┌──────────────────────────────────────┐
│ [FM logo] AI Playground        [✕]  │
├──────────────────────────────────────┤
│ • Curriculum                         │ ← 4px accent-2 dot marks the current page (decorative) + aria-current + bold
│   Exercises                          │
│   News                               │
│   Bookmarks                          │
│   Progress                           │
└──────────────────────────────────────┘
```

- Menu button: `button[aria-expanded][aria-controls="mobile-nav"]` at `size-11`, with icon `Menu` or `X` and `aria-label` "Open menu" / "Close menu".
- The panel is a **disclosure, not a modal**: `nav#mobile-nav[aria-label="Main"]` directly under the header, `bg-surface-raised shadow-sm`, full-width links `h-12 px-4 text-base`. It pushes content down; it is not an overlay. There's no focus trap.
- Behaviour: on open, focus stays on the button; the next Tab reaches the first link. **Esc** closes and returns focus to the button. Choosing a link navigates and closes (close on `pathname` change). The panel closes if the viewport grows to md or wider.
- Render the desktop `<nav>` and the mobile `<nav>` so that only one is exposed at a time (`hidden md:flex` / `md:hidden`). Two visible "Main" landmarks fail axe.

**Skip link**: `<a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 bg-canvas text-link px-4 py-2 rounded-lg">Skip to content</a>`. Activating it focuses `<main tabindex=-1>`.

**Footer**: `py-8 text-sm text-fg-muted`: "First Mate AI Playground · internal, runs locally", and on the right, "Content verified per lesson · News updates daily ~08:00 Manila". There are no links except `/progress`.

### 5.2 Grid and breakpoints

| Breakpoint | Width | Content columns | Notes |
|---|---|---|---|
| base | 360–767 | 1 | `px-4`. Everything stacks. |
| md | 768–1023 | 1 (level/news grids go to 2) | `px-6`. Desktop header. |
| lg | 1024–1279 | 12-col grid, `gap-8` | `px-8`. Lesson right rail appears. Archive filter sidebar appears. |
| xl | ≥1280 | same, capped at 1180px | Centred. 1440 has about 130px margins. |

- **No horizontal page scroll** at 360, 768, 1024 or 1440 (D-3). Only `pre` and wide tables scroll, inside their own `overflow-x-auto` wrappers. Any flex row holding text uses `min-w-0` on its text child so long titles and URLs wrap (`break-words`).
- Long unbroken strings (URLs in news titles, file paths) use `[overflow-wrap:anywhere]` in meta and title text.

### 5.3 Page title and document title

- Every page has exactly one `h1` and sets `metadata.title` to "\<Page\> · First Mate AI Playground". Lesson pages use "\<Lesson title\> · L\<n\> · First Mate AI Playground".
- Heading levels never skip.

---

## 6. Page wireframes

Wireframes are at **360px** (about 38 characters wide) and **1440px** (container 1180px). `▒` means skeleton. `[ ]` is a control. The hierarchy list under each page is the order of visual weight, and the order reviewers check.

### 6.1 `/` Home

**Hierarchy**: 1. Continue (resume in one click, C-4). 2. Where I am (level progress). 3. Today's top 3 news (N-6). 4. Links to the full curriculum and news.

```
360                                         1440 (container 1180)
┌──────────────────────────────────────┐    ┌────────────────────────────────────────────────────────────────────────────────┐
│ header                          [☰] │    │ header                                                                         │
├──────────────────────────────────────┤    ├────────────────────────────────────────────────────────────────────────────────┤
│ Learn Claude Code and Codex CLI,     │    │ Learn Claude Code and Codex CLI, basics to orchestration          (h1, 36px)   │
│ basics to orchestration      (h1 30) │    │ 18 hands-on lessons. Pick up where you left off.                  (fg-muted)   │
│ 18 hands-on lessons…      (fg-muted) │    │                                                                                │
│                                      │    │ ┌─ col-span-7 ─────────────────────────────┐ ┌─ col-span-5 ─────────────────┐ │
│ ┌─ Continue card (accent-soft) ────┐ │    │ │ CONTINUE                        eyebrow  │ │ TODAY · Tue 30 Sep     eyebrow│ │
│ │ CONTINUE                         │ │    │ │ Project instructions: CLAUDE.md vs       │ │ ┌87┐ Anthropic ships Opus…  ↗ │ │
│ │ Project instructions: CLAUDE.md  │ │    │ │ AGENTS.md                         (h2)   │ │ └──┘ Anthropic news · 06:10   │ │
│ │ vs AGENTS.md               (h2)  │ │    │ │ L2 · Context engineering · 15 min        │ │ ┌74┐ Next.js 16.2 changes…  ↗ │ │
│ │ L2 · 15 min            (meta)    │ │    │ │ [ Continue lesson → ]  (primary)         │ │ └──┘ Vercel blog · 05:02      │ │
│ │ [ Continue lesson → ]  primary   │ │    │ └──────────────────────────────────────────┘ │ ┌66┐ Supabase advisory…     ↗ │ │
│ └──────────────────────────────────┘ │    │                                              │ └──┘ Supabase blog · 01:40    │ │
│                                      │    │                                              │ See today's digest →   (link) │ │
│ Your levels                    (h2)  │    │                                              └───────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │    │ Your levels                                                        (h2)        │
│ │ L1 Foundations         3 / 3  ✓  │ │    │ ┌ L1 ────────┐┌ L2 ────────┐┌ L3 ────────┐┌ L4 ────────┐┌ L5 ────────┐          │
│ │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │ │    │ │Foundations ││Context eng.││Agentic     ││Parallelism ││Orchestrat. │          │
│ ├──────────────────────────────────┤ │    │ │3 / 3 ✓Done ││1 / 3       ││0 / 4       ││0 / 4       ││0 / 4       │          │
│ │ L2 Context engineering  1 / 3    │ │    │ │━━━━━━━━━━━ ││━━━───────  ││─────────── ││─────────── ││─────────── │          │
│ │ ━━━━━━━━━━───────────────────── │ │    │ └────────────┘└────────────┘└────────────┘└────────────┘└────────────┘          │
│ ├ … L3, L4, L5 rows ───────────────┤ │    │   (grid-cols-5, stretched-link cards → /curriculum#level-2)                     │
│ └──────────────────────────────────┘ │    │ View full curriculum →                                                          │
│ View full curriculum →               │    └────────────────────────────────────────────────────────────────────────────────┘
│                                      │
│ Today · Tue 30 Sep             (h2)  │
│ [87] Anthropic ships Opus… ↗         │
│ [74] Next.js 16.2 changes… ↗         │
│ [66] Supabase advisory…    ↗         │
│ See today's digest →                 │
└──────────────────────────────────────┘
```

- At 360, Continue comes first, then levels as a compact list (not 5 cards), then news. At md, levels become `grid-cols-2`; at lg, `grid-cols-5`.
- The Continue card is `bg-accent-soft rounded-card`. It is the only accent-filled surface on the page.
- **States**
  - Pre-hydration: the Continue card renders with a `Skeleton.Title` in place of the lesson title and the button **disabled with the label "Continue"** (no lesson name). Level progress uses skeletons (§4.7). No "0 / 3" flash.
  - No history (C-4): the eyebrow reads "START HERE", the title is the first L1 lesson, and the button reads "Start lesson 1.1".
  - Last-viewed lesson no longer exists (P-4): fall back to the "Start here" state silently.
  - No curriculum seeded: the whole levels area and the Continue card are replaced by one EmptyState: "No lessons seeded yet. Run `npm run seed`." (§7).
  - News: no digest → the news column shows a compact EmptyState "No news yet" plus `npm run news:run` and does **not** block the page. Stale → the header reads "Latest · Mon 29 Sep" with a warning Badge "Not today". Nothing ≥60 → "Nothing above the relevance bar today" plus a link to the archive.
  - DB down → the app-wide error page (§6.10).
  - Loading: `loading.tsx` shows skeletons matching the Continue card, the 5 level cards and 3 compact news rows.

### 6.2 `/curriculum`

**Hierarchy**: 1. Level sections in order with progress (C-1, C-2). 2. Lesson rows: title, objective, completion. 3. Meta: minutes and verified info (C-5).

```
360                                         1440
┌──────────────────────────────────────┐    ┌────────────────────────────────────────────────────────────────────────────────┐
│ Curriculum                     (h1)  │    │ Curriculum                                                         (h1)        │
│ 5 levels · 18 lessons · jump in      │    │ 5 levels · 18 lessons. No lesson is locked; start wherever fits.  (fg-muted)   │
│ anywhere                  (muted)    │    │                                                                                │
│ [L1][L2][L3][L4][L5]  ← jump links   │    │ ┌─ lg:col-span-3 sticky ─┐ ┌─ lg:col-span-9 ───────────────────────────────────┐ │
│                                      │    │ │ On this page           │ │ LEVEL 1                                eyebrow    │ │
│ LEVEL 1                      eyebrow │    │ │ L1 Foundations   3/3 ✓ │ │ Foundations: prompting and tool basics  (h2)      │ │
│ Foundations: prompting and    (h2)   │    │ │ L2 Context eng.  1/3   │ │ First sessions, precise prompts, safe permissions. │ │
│ tool basics                          │    │ │ L3 Agentic       0/4   │ │ 3 / 3  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ✓ Completed │ │
│ One-line summary…        (muted)     │    │ │ L4 Parallelism   0/4   │ │ ┌───────────────────────────────────────────────┐ │ │
│ 3 / 3 ━━━━━━━━━━━━━━━━━━━━━  ✓Done   │    │ │ L5 Orchestration 0/4   │ │ │ 1.1 Your first agent session       [✓Completed]│ │ │
│ ┌──────────────────────────────────┐ │    │ └────────────────────────┘ │ │ Install and authenticate both CLIs…            │ │ │
│ │ 1.1 Your first agent session     │ │    │                            │ │ 15 min · Verified 12 Sep · CC 2.3 / Codex 0.9  │ │ │
│ │ Install and authenticate both…   │ │    │                            │ ├───────────────────────────────────────────────┤ │ │
│ │ [✓ Completed]  15 min            │ │    │                            │ │ 1.2 Prompting for code       [⚠ May be outd.] │ │ │
│ │ Verified 12 Sep · CC 2.3 / Cx 0.9│ │    │                            │ │ …                                              │ │ │
│ ├──────────────────────────────────┤ │    │                            │ └───────────────────────────────────────────────┘ │ │
│ │ 1.2 Prompting for code           │ │    │                            │ LEVEL 2 …                                         │ │
│ │ …  [⚠ May be outdated]           │ │    │                            └───────────────────────────────────────────────────┘ │
│ └──────────────────────────────────┘ │    └────────────────────────────────────────────────────────────────────────────────┘
│ LEVEL 2 …                            │
└──────────────────────────────────────┘
```

- Level section: `section[aria-labelledby=level-n-title][id=level-n]`, with the eyebrow "Level n", the `h2` title, the summary in `text-fg-muted`, and a progress row showing "2 / 4" text, a `ProgressBar md` and, when complete, a success Badge "Completed".
- Lesson list: `<ol>` inside a `Card` (`bg-surface`, rows separated by `border-subtle`). Each row is a stretched link: `h3 > a` (`text-lg font-bold`), then the objective (`text-base text-fg`, clamped to 2 lines at 360 with `line-clamp-2`, and full at lg), then a meta row (`text-sm text-fg-muted`: "15 min · Verified 12 Sep 2026 · Claude Code v2.3 / Codex v0.9", wrapping allowed). The state badge sits top-right at lg and in the meta row at 360.
- Completion state per row: `success` Badge "Completed" or **nothing** for not started. Don't show a "Not started" badge; its absence is the state, and it avoids visual noise across 18 rows. The number prefix ("1.1") is in `text-fg-muted tabular-nums`.
- "May be outdated" (C-5): `warning` Badge, shown when `last_verified_on` is more than 60 days before today. It has a `title` attribute plus visible text, and the meta line keeps the actual date so the badge is explained.
- Jump links at 360: a horizontal row of 5 `accent` badges-as-links (`h-11` touch). At lg this becomes the sticky left rail "On this page" with per-level counts.
- **States**
  - Empty: EmptyState "No lessons seeded yet. Run `npm run seed`." with `CommandLine npm run seed`.
  - Loading: 2 level sections of skeletons (eyebrow, title, bar, 3 rows each) at the real heights.
  - Error: route `error.tsx` (§6.10), with "Retry".
  - Pre-hydration: badges and counts are skeletons; row links work immediately.

### 6.3 `/lessons/[slug]` (`?tool=claude|codex`)

**Hierarchy** (fixed order, L-1): 1. Header: title, objective, minutes, verified, bookmark. 2. Concept. 3. Tool tabs. 4. Key differences. 5. Exercise panel. 6. Mark complete + previous/next.

```
360                                         1440
┌──────────────────────────────────────┐    ┌────────────────────────────────────────────────────────────────────────────────┐
│ ← Curriculum / Level 2    (breadcr.) │    │ Curriculum / Level 2: Context engineering                    (breadcrumb)     │
│ LESSON 2.1                   eyebrow │    │ ┌─ lg:col-span-8 (measure ≤ 700px prose) ───────────┐ ┌─ lg:col-span-4 ────┐ │
│ Project instructions:         (h1)   │    │ │ LESSON 2.1                                        │ │ ON THIS LESSON     │ │
│ CLAUDE.md vs AGENTS.md               │    │ │ Project instructions: CLAUDE.md vs AGENTS.md (h1) │ │ Concept            │ │
│ Write effective instruction files…   │    │ │ Write effective instruction files: scope, …       │ │ Claude Code/Codex  │ │
│ 15 min · Verified 12 Sep     [🔖]    │    │ │ 15 min · Verified 12 Sep 2026 · CC v2.3 / Cx v0.9 │ │ Key differences    │ │
│ CC v2.3 / Codex v0.9                 │    │ │ [✓ Completed]                    [🔖 Bookmark]     │ │ Exercise           │ │
│                                      │    │ │ ─────────────────────────────────────────────     │ │ ────────────────── │ │
│ Concept                        (h2)  │    │ │ Concept                                     (h2)  │ │ (sticky top-[76px])│ │
│ prose 17/28…                         │    │ │ prose…                                            │ │                    │ │
│                                      │    │ │                                                   │ └────────────────────┘ │
│ [✱ Claude Code] [▢ Codex CLI]        │    │ │ In your tool                                (h2)  │                        │
│ ━━━━━━━━━━━━━                        │    │ │ [✱ Claude Code] [▢ Codex CLI]                     │                        │
│ prose…                               │    │ │ ━━━━━━━━━━━━━                                     │                        │
│ ┌ bash ─────────────────── [Copy] ┐  │    │ │ prose + ┌ bash ────────────────────── [⧉ Copy] ┐ │                        │
│ │ claude /init                    │  │    │ │         │ claude /init                        │ │                        │
│ └─────────────────────────────────┘  │    │ │         └─────────────────────────────────────┘ │                        │
│                                      │    │ │ ┌ Key differences (accent-soft, border-l-4) ──┐ │                        │
│ ┌ Key differences ─────────────────┐ │    │ │ │ • Claude Code reads CLAUDE.md; Codex reads… │ │                        │
│ │ • …  • …                         │ │    │ │ │ • …                                         │ │                        │
│ └──────────────────────────────────┘ │    │ │ └─────────────────────────────────────────────┘ │                        │
│                                      │    │ │ Exercise (h2) — see §6.3.1                       │                        │
│ Exercise                       (h2)  │    │ │ ┌───────────────────────────────────────────────┐│                        │
│ … (§6.3.1)                           │    │ │ └───────────────────────────────────────────────┘│                        │
│                                      │    │ │ ┌ Done with this lesson? ───── [ Mark complete ]┐│                        │
│ ┌ Done with this lesson?           ┐ │    │ │ └───────────────────────────────────────────────┘│                        │
│ │ [ Mark complete ]  primary, full │ │    │ │ ← 1.3 Permissions…            2.2 Memory… →      │                        │
│ └──────────────────────────────────┘ │    │ └──────────────────────────────────────────────────┘                        │
│ ← Previous: 1.3 Permissions…         │    └────────────────────────────────────────────────────────────────────────────────┘
│ Next: 2.2 Memory and context →       │
└──────────────────────────────────────┘
```

- **Header**: breadcrumb `nav[aria-label=Breadcrumb]`; eyebrow "Lesson 2.1"; `h1`; objective `text-lg text-fg`; meta line; then the status and actions row, with the completion Badge (after mount) and the bookmark toggle button (`ghost sm`, `aria-pressed`, label "Bookmark" / "Bookmarked", L-8). "May be outdated" appears here too (C-5).
- **Section headings**: "Concept" (`h2 id=concept`), "In your tool" (`h2 id=tools`, which gives the tabs a heading), "Key differences" (`h2 id=differences`, rendered inside the callout), "Exercise" (`h2 id=exercise`).
- **Key differences callout** (L-3): `aside[aria-labelledby=differences]`, `rounded-card bg-accent-soft border-l-4 border-link p-5`, with an `h2` at `text-xl` and a `<ul>` of 1–5 items (`text-prose`). It sits **outside and after** the tabs and is always visible.
- **Right rail** (lg+): "On this lesson" anchor list, sticky at `top-[76px]`. It links to the four `h2` ids and highlights nothing (no scroll-spy in v1). Hidden below lg.
- **Mark complete block** (L-5): `Card` with the text "Done with this lesson?" and a `primary` button "Mark complete". After clicking, the block becomes a success Badge "Completed ✓" plus the text "Completed 30 Sep", a `ghost` button "Undo", and `announce("Lesson marked complete")`. Undo reverts and announces "Marked not complete". Focus stays on whichever button replaces the clicked one (manage it explicitly, because the clicked node unmounts). Pre-hydration, the button is disabled and labelled "Mark complete", with no state claimed.
- **Prev/next** (L-6): `nav[aria-label="Lesson navigation"]`, two `Link`s showing the direction label plus the lesson number and title. At 360 they stack full-width (44px+). At the last L5 lesson, "Next" becomes "Back to curriculum →".
- **Markdown** (L-7): raw HTML escaped; external links open in a new tab with `rel="noopener noreferrer"` and the ↗ icon plus "(opens in new tab)" sr text. Headings inside lesson markdown are shifted to start at `h3`.
- **States**
  - Unknown or archived slug → `notFound()` → the lesson variant of 404 (§6.10).
  - Loading → skeletons: header (eyebrow, 2-line title, meta), 6 text lines, a tablist skeleton (2 × `h-11 w-32`), a 10-line panel and a callout block.
  - A tab with no native equivalent → Notice in the panel (§4.4).
  - Error → route `error.tsx`.

#### 6.3.1 Exercise panel (E-1, E-2, E-3)

```
┌─ Card (surface, rounded-card) ────────────────────────────────────────────┐
│ EXERCISE                                                         eyebrow  │
│ Conventions the agent must follow                              (h3)       │
│ Goal: a repo with 4 non-obvious conventions. Write the context files…     │
│ Repo  exercises/ex-2-1-conventions/starter          (mono, fg-muted)      │
│                                                                           │
│ 1. Set up                                                 (h4)            │
│ ┌ Setup ────────────────────────────────────────────── [⧉ Copy] ┐         │
│ │ cp -r exercises/ex-2-1-conventions/starter ~/fm-ex/… && npm i │         │
│ └───────────────────────────────────────────────────────────────┘         │
│ 2. Start your agent with                                  (h4)            │
│ [✱ Claude Code] [▢ Codex CLI]        ← same tab state as the lesson tabs  │
│ ┌ Prompt ────────────────────────────────────────────── [⧉ Copy] ┐        │
│ │ Read AGENTS.md, then add the /health route…                    │        │
│ └────────────────────────────────────────────────────────────────┘        │
│ 3. Verify                                                 (h4)            │
│ ┌ Verify ────────────────────────────────────────────── [⧉ Copy] ┐        │
│ │ npm test                                                       │        │
│ └────────────────────────────────────────────────────────────────┘        │
│   (or: [Manual verification] badge + "Use the checklist below.")          │
│ 4. Checklist                       3 of 5 done  ━━━━━━━━━━━──────  (h4)   │
│ [✓] Context file names all 4 conventions                                  │
│ [ ] Agent-added feature passes tests without edits to test files          │
│ …                                                                         │
│ ▸ Compare with reference solution           ← <details>, collapsed        │
│     Solution: exercises/ex-2-1-conventions/solution                       │
│     ┌ Terminal ──── [⧉ Copy] ┐ git diff --no-index …starter …solution      │
│     What the reference solution does differently: • … • …                 │
└───────────────────────────────────────────────────────────────────────────┘
```

- Numbered sub-steps (`h4`) turn the panel into a scannable procedure. The Copy buttons are the most prominent controls.
- The starting prompt is shown in a CodeBlock with the label "Prompt", which is copyable and wraps. **Exception to no-wrap:** prompt blocks use `whitespace-pre-wrap` because they are prose.
- Compare disclosure (E-3): native `<details><summary>`, with the summary styled `h-11 inline-flex items-center gap-2 font-medium text-link` and a chevron that rotates 90° (`transition-transform`, disabled under reduced motion). Collapsed by default.
- "Exercise complete" (E-2) appears in the checklist header only. It never marks the lesson complete, and the Mark complete block stays separate below the panel.
- Checklist item IDs that aren't in the content are ignored (§9 of the PRD).

### 6.4 `/exercises` (P1, E-5)

**Hierarchy**: 1. Exercise title and which lesson it belongs to. 2. My checklist progress. 3. Verify type and level.

```
360                                         1440
┌──────────────────────────────────────┐    ┌────────────────────────────────────────────────────────────────────────────────┐
│ Exercises                      (h1)  │    │ Exercises                                                          (h1)        │
│ 18 hands-on projects in /exercises   │    │ 18 hands-on projects in /exercises. Each has a starter, solution and checklist.│
│                                      │    │ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ LEVEL 1                      eyebrow │    │ │ Level │ Exercise                    │ Lesson             │ Verify  │ Progress │ │
│ ┌──────────────────────────────────┐ │    │ ├───────┼─────────────────────────────┼────────────────────┼─────────┼──────────┤ │
│ │ Failing test to green      (h3)  │ │    │ │ L1    │ Failing test to green       │ 1.1 Your first…    │ Auto    │ 3/4 ━━━─ │ │
│ │ Lesson 1.1 Your first agent… →   │ │    │ │ L1    │ Vague vs precise prompts    │ 1.2 Prompting for… │ Auto    │ —        │ │
│ │ [Auto verify]  3 / 4 ━━━━━━━──   │ │    │ │ …     │                             │                    │ Manual  │          │ │
│ └──────────────────────────────────┘ │    │ └──────────────────────────────────────────────────────────────────────────────┘ │
│ … one card per exercise              │    └────────────────────────────────────────────────────────────────────────────────┘
└──────────────────────────────────────┘
```

- At lg and up: a real `<table>` with a `<caption class="sr-only">`, `th[scope=col]`, and rows linking via the exercise title to `/lessons/<slug>#exercise`. Below lg: cards grouped by level (a table at 360 would scroll horizontally).
- Verify column: `neutral` Badge "Auto" or "Manual". Progress: "3 / 4" plus `ProgressBar sm`, or "—" with sr text "Not started" when there is no checklist state. An em dash means "no data", not zero.
- **States**: empty uses the curriculum empty state. Loading shows skeleton rows (8). Error uses the route boundary.

### 6.5 `/news` Today's digest

**Hierarchy**: 1. Is this today's news, and how fresh is it (N-1, N-3)? 2. Ranked items (≤10). 3. Unscored (collapsed). 4. Archive link.

```
360                                         1440
┌──────────────────────────────────────┐    ┌────────────────────────────────────────────────────────────────────────────────┐
│ Today's digest                 (h1)  │    │ ┌─ lg:col-span-8 ─────────────────────────────────────────┐ ┌─ col-span-4 ────┐ │
│ Tue 30 Sep · updated 08:03 (muted)   │    │ │ Today's digest                                  (h1)    │ │ ABOUT THE DIGEST │ │
│ [Browse archive →]                   │    │ │ Tue 30 Sep · updated 08:03 · 10 items ≥ 60              │ │ Scored daily at  │ │
│                                      │    │ │                                                         │ │ ~08:00 Manila for│ │
│ ┌ NewsCard ────────────────────────┐ │    │ │ ┌ NewsCard 87 ────────────────────────────────────────┐ │ │ relevance to     │ │
│ │ ┌──┐ Anthropic ships Opus…  ↗ 🔖 │ │    │ │ └─────────────────────────────────────────────────────┘ │ │ First Mate work. │ │
│ │ │87│ Anthropic news · 06:10      │ │    │ │ ┌ NewsCard 74 ────────────────────────────────────────┐ │ │ Only items ≥ 60  │ │
│ │ └──┘ [New model] [Tooling]       │ │    │ │ └─────────────────────────────────────────────────────┘ │ │ appear here.     │ │
│ │ WHY IT MATTERS                   │ │    │ │ … up to 10, gap-4                                       │ │ [Browse archive] │ │
│ │ Client MVPs on Opus can…         │ │    │ │                                                         │ │                  │ │
│ └──────────────────────────────────┘ │    │ │ ▸ Unscored (4)   ← <details>, collapsed                 │ │                  │ │
│ … ×10, gap-3                         │    │ │   compact unscored cards, no score/why                  │ │                  │ │
│                                      │    │ └─────────────────────────────────────────────────────────┘ └──────────────────┘ │
│ ▸ Unscored (4)                       │    └────────────────────────────────────────────────────────────────────────────────┘
└──────────────────────────────────────┘
```

- Header meta: `<time datetime="2026-09-30">Tue 30 Sep</time> · updated 08:03`, in the Asia/Manila zone. The item count sits at lg only.
- Ranked list: `<ol aria-label="Ranked by relevance">` of `NewsCard`s, sorted by score descending, then `published_at` descending (N-1). The ordered list tells screen readers the rank.
- Unscored (N-2): `<details>` with `<summary>` reading "Unscored (4)" and helper text in the body: "These items haven't been scored yet, or scoring failed. They are not ranked." Then an `<ul>` of `unscored` cards. It is never merged into the ranked list.
- **States**
  - No runs ever: EmptyState, title "No news yet", body "The digest appears after the first pipeline run.", `CommandLine npm run news:run`. (Other engineers: "or import the shared snapshots with `npm run news:import`", per PRD §14 Q1. Show both commands, with import second.)
  - Stale (N-3): a `warning` Notice (server-rendered, no live role) **above** the header meta: title "No digest yet today. Showing Mon 29 Sep.", body "Run the pipeline to fetch today's news.", `CommandLine npm run news:run`. The h1 changes to "Latest digest" so the heading is not a lie.
  - Nothing ≥ 60 today: EmptyState "Nothing above the relevance bar today", body "Today's run found N items, all scored below 60.", with the link "See today's items in the archive" → `/news/archive?from=YYYY-MM-DD&to=YYYY-MM-DD&min=0`. The Unscored section still renders below it if it has items.
  - Loading: 4 `Skeleton.NewsCard`s plus the header skeleton.
  - DB down: app-wide error page (§6.10).

### 6.6 `/news/archive`

**Hierarchy**: 1. Results. 2. Active filters (what am I looking at). 3. Filter controls. 4. Pagination.

```
360                                         1440
┌──────────────────────────────────────┐    ┌────────────────────────────────────────────────────────────────────────────────┐
│ News archive                   (h1)  │    │ News archive                                                        (h1)       │
│ [ Filters (3) ▾ ]  ← disclosure      │    │ ┌─ lg:col-span-3 <form method=get> ─┐ ┌─ lg:col-span-9 ──────────────────────────┐ │
│ ┌ (open) ──────────────────────────┐ │    │ │ Filters                    (h2)   │ │ 124 items · page 2 of 5       (status)   │ │
│ │ Tags   [✓]New model [✓]Tooling   │ │    │ │ Tags        (fieldset)            │ │ [Tooling ✕] [Min 60 ✕] [Vercel ✕]        │ │
│ │        [ ]Framework [ ]Security  │ │    │ │ [✓] New model  [✓] Tooling        │ │ Clear all filters                        │ │
│ │        [ ]Business               │ │    │ │ [ ] Framework  [ ] Security       │ │                                          │ │
│ │ Min score (0)(40)(●60)(80)       │ │    │ │ [ ] Business                      │ │ Results                         (h2)     │ │
│ │ Source [ All sources     ▾ ]     │ │    │ │ Minimum score (radio group)       │ │ ┌ NewsCard (with full date) ───────────┐ │ │
│ │ From [ 2026-09-01 ] To [ … ]     │ │    │ │ (0) (40) (●60) (80)               │ │ └──────────────────────────────────────┘ │ │
│ │ [ Apply filters ] Clear          │ │    │ │ Source [ All sources ▾ ]          │ │ … 25 per page                            │ │
│ └──────────────────────────────────┘ │    │ │ From [date]  To [date]            │ │                                          │ │
│ [Tooling ✕] [Min 60 ✕]               │    │ │ [ Apply filters ]  Clear          │ │ ‹ Prev  1 [2] 3 4 5  Next ›              │ │
│ 124 items · page 2 of 5              │    │ └───────────────────────────────────┘ └──────────────────────────────────────────┘ │
│ NewsCard …                           │    └────────────────────────────────────────────────────────────────────────────────┘
│ ‹ Prev   Page 2 of 5   Next ›        │
└──────────────────────────────────────┘
```

- **The filters are a real `<form method="get" action="/news/archive">`**, so URL params are the state (N-4) and it works before hydration. Inputs are named `tag` (repeated checkbox), `min` (radio: 0/40/60/80, default 0), `source` (select, "All sources" = empty) and `from`/`to` (native `type=date`). Submitting resets `page`.
- Explicit **Apply filters** button (`primary`) at every width. There is no auto-submit on change: each checkbox click would otherwise navigate, which is disorienting and noisy for screen readers.
- Grouping: tags in a `fieldset` with `legend` "Tags" and native checkboxes. Minimum score in a `fieldset` with `legend` "Minimum score" and native radios styled as a segmented row (each `h-11`, `peer-checked:bg-accent-soft peer-checked:text-link peer-checked:font-bold` plus a visible check glyph on the selected one, so it isn't colour alone). Inputs use a `control-border` 1px border, `rounded-lg`, `h-11`.
- Validation: `from > to` → the server swaps nothing; it renders a `danger` field error under To, "End date is before start date.", with `aria-describedby`, and results are not filtered by date. Invalid `min` values are treated as 0.
- Active filters row: `FilterChip`s, each a link to the same URL minus that param (they work without JS), plus a "Clear all filters" link → `/news/archive`.
- Result count: `<p>124 items · page 2 of 5</p>` (plain text; the page navigates, so a live region would not fire reliably). After a filter submit, move focus to the Results `h2` (`tabindex=-1`): the form's submit handler sets a `sessionStorage` flag, and the results component reads it on mount, focuses the heading and clears the flag. Don't add a URL param for this; the URL must hold only the filter state.
- Pagination: `nav[aria-label=Pagination]`. Links for Prev / pages / Next; the current page is `aria-current="page"` and not a link. At 360 it shows only "‹ Prev · Page 2 of 5 · Next ›".
- Cards show the full date ("Mon 29 Sep 2026, 06:10") because items span days. Unscored items appear in the archive only when `min=0`, with the `unscored` variant.
- Filter disclosure at 360: `button[aria-expanded][aria-controls]` "Filters (3)", where the count is the number of active filters. Closed by default; open by default if the URL has a date-validation error.
- **States**: no results → EmptyState "No items match these filters", action "Clear filters" (link). Loading → the filter column renders immediately (it's static) plus 6 card skeletons. Error → route boundary.

### 6.7 `/bookmarks` (P1, L-8, N-5)

**Hierarchy**: 1. Bookmarked lessons. 2. Bookmarked news. Each is newest-bookmarked first.

```
360                                         1440
┌──────────────────────────────────────┐    ┌────────────────────────────────────────────────────────────────────────────────┐
│ Bookmarks                      (h1)  │    │ Bookmarks                                                           (h1)       │
│ Saved in this browser only  (muted)  │    │ Saved in this browser only.                                     (fg-muted)     │
│                                      │    │ ┌─ lg:col-span-6 ────────────────────────┐ ┌─ lg:col-span-6 ──────────────────┐ │
│ Lessons (2)                    (h2)  │    │ │ Lessons (2)                       (h2) │ │ News (3)                    (h2) │ │
│ ┌──────────────────────────────────┐ │    │ │ ┌ 2.1 Project instructions… [✓] ┐     │ │ ┌ NewsCard compact ─────────┐    │ │
│ │ 2.1 Project instructions…    →   │ │    │ │ │ L2 · 15 min · saved 29 Sep    │     │ │ └───────────────────────────┘    │ │
│ │ L2 · 15 min · saved 29 Sep  [🔖] │ │    │ │ └───────────────────────────────┘     │ │ ┌ Item no longer available ─┐    │ │
│ └──────────────────────────────────┘ │    │ │ …                                      │ │ │ [Remove bookmark]         │    │ │
│ News (3)                       (h2)  │    │ └────────────────────────────────────────┘ │ └───────────────────────────┘    │ │
│ NewsCard compact ×3                  │    │                                            └──────────────────────────────────┘ │
│ ┌ Item no longer available ────────┐ │    └────────────────────────────────────────────────────────────────────────────────┘
│ │ [ Remove bookmark ]              │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

- Two sections rather than one mixed list. Lessons and news are different kinds of object with different actions. This reads the PRD's "newest first" as applying within each section (open question 3 in §8).
- Removing a bookmark (the toggle) removes the row and calls `announce("Removed from bookmarks")`. Focus moves to the next row's link, or the previous one, or the section heading if the section is now empty. **Undo**: the announcement is paired with an inline "Undo" link that replaces the row for 8s.
- **States**
  - Pre-hydration: both sections render skeleton rows (2 each). Don't show the empty state until mount (P-5).
  - Empty (both): EmptyState "Nothing bookmarked yet", body "Use the Bookmark button on any lesson or news item. Bookmarks stay in this browser." with links "Browse curriculum" and "Today's digest".
  - One section empty: that section shows one muted line, "No lessons bookmarked.", not a full EmptyState.
  - Missing lesson (archived or removed slug): hidden, per P-4 (kept in storage, not rendered). Missing news item: the `unavailable` card (N-5).
  - Storage blocked: the banner (§4.11) plus the normal empty state.

### 6.8 `/progress` (P1, P-6, P-7)

**Hierarchy**: 1. What's saved (summary). 2. Export. 3. Import. 4. Reset (danger, last).

```
360                                         1440 (single column, max-w-[700px])
┌──────────────────────────────────────┐    ┌──────────────────────────────────────────────────────────────┐
│ Progress                       (h1)  │    │ Progress                                              (h1)   │
│ Saved in this browser (localStorage) │    │ Your progress is saved in this browser only.                 │
│ ┌ Summary card ────────────────────┐ │    │ ┌ Summary ───────────────────────────────────────────────┐   │
│ │ 5 of 18 lessons complete         │ │    │ │ 5 of 18 lessons · 12 checklist items · 4 bookmarks     │   │
│ │ 12 checklist items · 4 bookmarks │ │    │ └────────────────────────────────────────────────────────┘   │
│ └──────────────────────────────────┘ │    │ Export                                                (h2)   │
│ Export                         (h2)  │    │ Download a JSON backup, or share it for the team report.     │
│ Download a backup…                   │    │ [ Export progress ] (secondary)                              │
│ [ Export progress ]                  │    │ Import                                                (h2)   │
│ Import                         (h2)  │    │ [ Choose file… ]  fm-playground-progress-2026-09-30.json     │
│ [ Choose file… ]                     │    │ ┌ Preview (accent-soft) ───────────────────────────────────┐ │
│ ┌ Preview ─────────────────────────┐ │    │ │ This file has 7 lessons, 3 bookmarks, exported 28 Sep.   │ │
│ │ 7 lessons · 3 bookmarks          │ │    │ │ Importing replaces everything saved in this browser.     │ │
│ │ Replaces current progress.       │ │    │ │ [ Replace my progress ] (primary)  [ Cancel ] (ghost)    │ │
│ │ [ Replace my progress ] [Cancel] │ │    │ └──────────────────────────────────────────────────────────┘ │
│ └──────────────────────────────────┘ │    │ ┌ Danger zone (border danger) ─────────────────────────────┐ │
│ ┌ Danger zone ─────────────────────┐ │    │ │ Reset all progress                               (h2)    │ │
│ │ Reset all progress         (h2)  │ │    │ │ Deletes lessons, checklists and bookmarks here.          │ │
│ │ Type reset to confirm            │ │    │ │ Type reset to confirm  [ ________ ]  [ Reset ] (danger)  │ │
│ │ [ ________ ]                     │ │    │ └──────────────────────────────────────────────────────────┘ │
│ │ [ Reset all progress ] (danger)  │ │    └──────────────────────────────────────────────────────────────┘
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

- Export (P-6): one button does both things, as the PRD specifies. It copies the JSON and downloads `fm-playground-progress-YYYY-MM-DD.json`. Success: `announce("Progress exported and copied")` plus inline text "Downloaded and copied to clipboard." If the clipboard is denied, the download still happens and the text reads "Downloaded. Copy to clipboard was blocked." It's not an error.
- Import: a visually styled `<input type=file accept="application/json,.json">` with a real `<label>`. On selection, validate the file. Invalid → `danger` Notice (`role=status`): "This file isn't a valid progress export." plus the reason ("missing `version`", "invalid JSON"). Valid → the preview panel (`role=status`), with **nothing written yet**. "Replace my progress" writes the state, shows a `success` Notice "Progress imported: 7 lessons, 3 bookmarks.", and moves focus to it. Cancel clears the file input and returns focus to it.
- Reset (P-7): a text input labelled "Type reset to confirm". The button is `aria-disabled` until the value, trimmed and case-sensitive, equals `reset`. Clicking while it doesn't match shows the field error "Type reset exactly to confirm." (`aria-describedby`); don't fail silently. On success: the state clears, `success` Notice "All progress has been reset.", focus to the Notice. No undo (it's destructive and confirmed), so the copy says "This can't be undone" near the button. Suggest exporting first with an inline link in the danger-zone body: "Export a backup first."
- **States**: pre-hydration summary uses skeletons. Storage blocked: the banner, and all three actions stay usable for the session (P-3). Export still works; import and reset act on the in-memory state.

### 6.9 `not-found` (404)

```
360                                         1440 (centered column, max-w-xl, pt-24)
┌──────────────────────────────────────┐    ┌──────────────────────────────────────────────────────┐
│ 404                          eyebrow │    │                 404                       eyebrow    │
│ Page not found                 (h1)  │    │                 Page not found            (h1)       │
│ The link may be old, or the lesson   │    │                 The link may be old, or the lesson   │
│ may have been renamed or archived.   │    │                 may have been renamed or archived.   │
│ [ Go to curriculum ]  (primary)      │    │                 [ Go to curriculum ]  Home           │
│ Home                                 │    │                                                      │
└──────────────────────────────────────┘    └──────────────────────────────────────────────────────┘
```

- Lesson-specific variant (`/lessons/[slug]` calling `notFound()`): h1 "Lesson not found", body "\"\<slug\>\" isn't in the current curriculum. It may have been renamed or archived.", primary "Go to curriculum". The slug is rendered as text, escaped.
- Header and footer are present (in the root layout).

### 6.10 `error` (route error boundary) and app-wide DB down

**Route error** (`error.tsx`, a client component):

```
┌ Notice danger (in page flow, where the content would be) ───────────┐
│ ✕ This page couldn't load.                                          │
│   Something went wrong while loading the curriculum.  (per route)  │
│   [ Retry ] (secondary → reset())    Go home                        │
└─────────────────────────────────────────────────────────────────────┘
```

- The page's `h1` still renders (for example "Curriculum") so the page is identifiable. No stack trace or error message text is shown in the UI; log the error to the console. `digest` may be shown in `text-xs text-fg-muted` as "Reference: abc123" for debugging.
- Retry calls `reset()`. While retrying, the button shows its loading state. If the retry fails again, the Notice re-renders unchanged; don't loop.

**App-wide DB unreachable** (§9 row 1): detected in the data layer and rendered by the route boundary as a special case, keyed on a typed `DatabaseUnavailableError` from `src/lib/db/`. It replaces the page content, **not** the shell:

```
360                                         1440 (max-w-[700px])
┌──────────────────────────────────────┐    ┌──────────────────────────────────────────────────────┐
│ Can't reach the local database (h1)  │    │ Can't reach the local database               (h1)    │
│ The app reads lessons and news from  │    │ The app reads lessons and news from local Supabase.  │
│ local Supabase.                      │    │ Start it, then seed the content:                     │
│ Start it, then seed the content:     │    │ ┌ Terminal ──────────────────────────── [⧉ Copy] ┐   │
│ ┌ Terminal ─────────────── [Copy] ┐  │    │ │ supabase start && npm run seed                 │   │
│ │ supabase start && npm run seed  │  │    │ └────────────────────────────────────────────────┘   │
│ └─────────────────────────────────┘  │    │ Docker must be running. [ Retry ] (secondary)        │
│ Docker must be running.              │    │                                                      │
│ [ Retry ]                            │    └──────────────────────────────────────────────────────┘
└──────────────────────────────────────┘
```

- No stack trace, no connection string, no error codes. Retry does a full `router.refresh()`.
- This is where the "Copy" fallback matters most (clipboard can be blocked on `http://localhost` in some browser configs), and the §4.5 fallback covers it.
- `/progress` doesn't need the DB for its core functions. If the DB is down it still renders (it reads localStorage), and only lesson-title lookups degrade to showing slugs.

---

## 7. Content and microcopy rules

- **Voice**: plain, direct, second person. Commands in backticks. No exclamation marks and no "Oops". Sentence case for all headings and buttons.
- **Empty and error copy formula**: what's missing or wrong, then what fixes it, then the command or link.
- **Dates**: absolute, Asia/Manila. Day-level: "Tue 30 Sep". With time: "Tue 30 Sep, 08:03". Archive: "Mon 29 Sep 2026, 06:10". Always wrap in `<time datetime>`. No relative times ("3h ago") in v1, because they go stale on a page left open.
- **Tool names**: "Claude Code" and "Codex CLI" in full in tabs and headings. "CC" and "Codex" are allowed only in the meta line at 360.
- **Canonical strings** (tests assert some of these; keep them identical): "Copied"; "Press ⌘C to copy" / "Press Ctrl+C to copy"; "Mark complete"; "Completed ✓ · Undo" (L-5, rendered as the badge "Completed ✓" plus the "Undo" button); "Exercise complete"; "Saved progress was unreadable and has been reset"; "Progress can't be saved in this browser"; "No digest yet today. Showing \<date\>"; "Unscored (N)"; "Item no longer available"; "No news yet. Run `npm run news:run`."; "Nothing above the relevance bar today"; "No items match these filters"; "Clear filters"; "Nothing bookmarked yet"; "No lessons seeded yet. Run `npm run seed`."; "Can't reach the local database. Run `supabase start` then `npm run seed`."; "May be outdated"; "No native equivalent in \<tool\> (as of vX)"; "Back to curriculum".

---

## 8. Edge cases and open questions

| # | Question | Recommended default (build this unless told otherwise) |
|---|---|---|
| 1 | Tool icons: vendor marks or neutral glyphs? | Neutral lucide glyphs (`Asterisk`, `Hexagon`) in v1. Swap for official marks after a trademark check. The label always carries identity. |
| 2 | Should opening a `?tool=codex` link update `prefs.tool`? | No. Only explicit tab activation writes the preference (§4.4 step 3). |
| 3 | `/bookmarks` "newest first": one mixed list or per type? | Two sections, newest first within each (§6.7). |
| 4 | Do checkboxes need a custom style for brand fit? | No. Native with `accent-color`. Revisit only if the stakeholder objects. |
| 5 | Continue CTA when the last-viewed lesson is complete: resume it or jump to the next incomplete one? | The PRD (C-4) says last viewed. Keep that. The label says "Continue", not "Next up". |
| 6 | News time zone for users outside Manila? | Always Manila (the digest date is Manila-based). Label the footer "Manila time". |
| 7 | Dark-mode logo asset: ask brand owner for an official reverse logo? | Ship the derived white-wordmark SVG (§1.5) and flag it for brand sign-off. |
| 8 | The `danger` button in dark mode is a soft fill, not solid. | Intentional. A solid `#ff9a7a` fill with dark text would be the loudest thing in the app. |

---

## 9. UX review rubric (the UI/UX gate, PRD §12 gate 3)

The UI/UX review agent applies this rubric to every PR with a UI diff (anything under `src/app/**` or `src/components/**` that affects render output, plus `globals.css` and `tokens.css`). PRs without one record "N/A: no UI changes" and pass.

### 9.1 Verdict rule

- **GREEN**: zero **Blocking** failures. Major findings may be present only if each has a follow-up issue linked in the review, capped at 2 per PR.
- **RED**: any Blocking failure, 3 or more Major findings, or missing evidence (9.2).
- Minor findings never block. They go in as review comments.

### 9.2 Required evidence in the PR description

1. Screenshots at **360, 768 and 1440** for every changed route, in the **light** theme, plus **360 and 1440 dark** for changed components.
2. For lesson or exercise changes: both tab states (`?tool=claude` and `?tool=codex`).
3. Screenshots of each §9 state the PR touches (empty, loading, error, stale, pre-hydration) or the Playwright test names that cover them.
4. Axe results: 0 serious or critical issues (from the E2E run).
5. Lighthouse a11y ≥ 95 for changed routes (M8), and LCP/CLS for the four D-4 routes if they changed.

### 9.3 Checklist

Each item says how to check it. **B** = Blocking, **M** = Major, **m** = Minor.

**A. States (PRD §9)**

| ID | Sev | Check | How to verify |
|---|---|---|---|
| A-1 | B | Every state in §9 of the PRD and §6 of this doc for the touched route exists: empty, loading, error, plus stale / unscored / storage / corrupted where they apply | Screenshots or tests. Force each with fixtures, route mocking or `localStorage` injection. |
| A-2 | B | No progress state in server HTML. No "not started" or "0 / n" flash before hydration. No hydration warnings | View source; E2E console assertion (P-5) |
| A-3 | B | Loading skeletons match the final layout (CLS < 0.05 on the route) | Lighthouse CLS or a Playwright layout-shift observer |
| A-4 | M | Empty and error copy follows §7 (what, fix, command) and uses the canonical strings | Read the diff |
| A-5 | B | Unscored items are never mixed into ranked lists. Stale digests are never labelled "today" | Fixture E2E |

**B. Brand and tokens**

| ID | Sev | Check | How to verify |
|---|---|---|---|
| B-1 | B | Satoshi is loaded via `next/font/local` with the 400/400i/500/700 files. No Google Fonts or CDN fonts | Read `layout.tsx`; network panel |
| B-2 | B | No `font-semibold` (600) anywhere | Grep G-1 (below) returns nothing |
| B-3 | B | No raw colours in components: no hex, `rgb(`, arbitrary colour classes or Tailwind palette names | Grep G-2 returns nothing (`tokens.css` and SVG assets are exempt). Palette names fail to compile anyway. |
| B-4 | B | `accent-2` is never used for text under 24px, and never to convey state | Every hit from grep G-3 needs a justification |
| B-5 | M | Radii follow §3.3 (cards `rounded-card`, buttons `rounded-xl`, badges `rounded-full`) | Read the diff and screenshots |
| B-6 | M | Type styles come from §3.1. No ad-hoc `text-[NNpx]` | Grep G-4. The only allowed hit is the code size `text-[0.875rem]` and inline `text-[0.9em]` |
| B-7 | M | The logo uses the correct asset per theme, at 32/36px, not recoloured | Screenshots, light and dark |
| B-8 | m | Spacing rhythm follows §3.2 | Screenshots |

**C. Accessibility (WCAG 2.2 AA)**

| ID | Sev | Check | How to verify |
|---|---|---|---|
| C-1 | B | Axe: 0 serious or critical issues, in both tab states, light and dark | E2E |
| C-2 | B | Every new text/background pair is in the §2.4 ledger with a ratio of ≥ 4.5 (text) or ≥ 3 (non-text/large) | Diff against the ledger; measure the rendered colour if in doubt |
| C-3 | B | Visible focus on every interactive element. No `outline-none` without a replacement. Focus inside code chrome uses `code-focus` | Tab through the page in a real browser; grep G-5 |
| C-4 | B | Tabs follow §4.4 exactly: roles, `aria-selected`, roving tabindex, Left/Right/Home/End, `?tool=` via `history.replaceState`, both tablists in sync, pref precedence | E2E plus a manual keyboard pass |
| C-5 | B | Status is never colour alone: every badge or notice has an icon and a word; the active tab and active nav have a weight change and a bar | Screenshots in greyscale |
| C-6 | B | Hit targets are ≥ 24px, and ≥ 44px at 360 on touch emulation | Playwright `hasTouch` plus bounding boxes |
| C-7 | B | Async results are announced through the single `#fm-live` region (copy, mark complete, bookmark removal, exercise complete). No `role=alert` | Read the diff; screen-reader spot check |
| C-8 | M | Focus is managed when the focused node unmounts (Mark complete ↔ Undo, dismissing a notice, bookmark removal, import confirm) | Manual keyboard pass |
| C-9 | M | Heading order has no skipped levels and exactly one `h1`. Landmarks: one `main`, one visible `nav[aria-label=Main]` | Axe plus an accessibility-tree snapshot |
| C-10 | M | External links: `target=_blank`, `rel="noopener noreferrer"`, an icon and "(opens in new tab)" sr text | Read the diff |
| C-11 | B | Reduced motion: nothing animates except content state changes; no content starts at `opacity: 0` | `emulateMedia({ reducedMotion: 'reduce' })` screenshot and a11y snapshot |

**D. Layout and responsive**

| ID | Sev | Check | How to verify |
|---|---|---|---|
| D-1 | B | No horizontal page scroll at 360, 768, 1024 or 1440. Code scrolls inside its own block | `document.documentElement.scrollWidth <= innerWidth` at each width |
| D-2 | B | Tabs remain tabs below 768px. Nav collapses to a menu button with `aria-expanded` | Screenshot at 360 |
| D-3 | M | Information hierarchy matches the §6 order for the route (for example, lesson order L-1) | Screenshots against the wireframes |
| D-4 | M | Long titles, URLs and paths wrap or truncate inside their card, never overflow | Fixture with an 80-character title and a long URL |
| D-5 | m | Prose stays within the 700px measure | Screenshot at 1440 |

**E. Interaction and copy**

| ID | Sev | Check | How to verify |
|---|---|---|---|
| E-1 | B | Copy writes the exact source text. The clipboard-denied fallback selects the code and shows "Press ⌘C/Ctrl+C to copy" | E2E with clipboard permission granted and denied |
| E-2 | B | Destructive actions: reset needs `reset` typed with mismatch feedback. Import replaces only after preview and confirm | E2E |
| E-3 | M | At most one `primary` button per region | Screenshots |
| E-4 | M | Microcopy follows §7 (sentence case, no "Oops", absolute Manila dates in `<time>`) | Read the diff |
| E-5 | m | Hover states exist for every clickable surface | Manual |

**Greps** (run from the repo root; POSIX ERE, works with both BSD and GNU grep):

```bash
# G-1: 600 weight has no font file
grep -rnE "font-semibold|font-weight: *600" src/
# G-2: raw colours in components
grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(|(text|bg|border|ring|fill|stroke|outline|decoration)-\[#" src/components src/app --include=*.tsx
# G-3: orange text
grep -rnE "text-accent-2\b" src/
# G-4: ad-hoc font sizes
grep -rnE "text-\[[0-9.]+(px|rem|em)\]" src/
# G-5: focus-ring removal
grep -rnE "outline-none|outline: *none|outline: *0" src/
```

### 9.4 Review output format

```
UI/UX gate: GREEN | RED | N/A (no UI changes)
Evidence: complete | missing <items>
Blocking: <ID> <route/component>: <problem> → <fix>   (or "none")
Major:    <ID> …  (follow-up issue #… if merged green)
Minor:    <ID> …
```

---

## 10. Hand-off map (who builds what)

| Section | Workstream | Files |
|---|---|---|
| §2, §3, `tokens.css`, fonts, logo | WS-A | `src/app/globals.css`, `src/app/tokens.css`, `src/app/layout.tsx`, `public/fonts/`, `public/brand/` (**`public/brand/` is not in WS-A's owned paths in PRD §11. The orchestrator must add it to WS-A before M1 starts.**) |
| §4 primitives, §4.11 banners slot, §5 shell, §6.9 and §6.10 | WS-A | `src/components/ui/`, `src/app/not-found.tsx`, `src/app/error.tsx` |
| `announce()` helper and `#fm-live` region | WS-A | `src/components/ui/live-region.tsx` |
| Tool preference context (shared tab state) | WS-C consumes it; WS-D owns `prefs.tool` storage | `src/lib/progress/` (D) plus `src/components/lesson/` (C) |
| §6.1 home | M2 integration | `src/app/page.tsx` |
| §6.2, §6.3, §6.4 | WS-C | `src/app/curriculum/`, `src/app/lessons/`, `src/app/exercises/`, `src/components/lesson/`, `src/components/exercise/` |
| §6.5, §6.6, §4.12 | WS-F | `src/app/news/`, `src/components/news/` |
| §6.7, §6.8, §4.11 banner logic | WS-D | `src/app/bookmarks/`, `src/app/progress/`, `src/lib/progress/` |
| `DatabaseUnavailableError` type | M0 | `src/lib/db/` |
