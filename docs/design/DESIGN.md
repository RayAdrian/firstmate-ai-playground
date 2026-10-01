# DESIGN: First Mate AI Playground

| | |
|---|---|
| Status | v1.0. Gates WS-A (design system and shell), and constrains WS-C, WS-D and WS-F UI. |
| Owner | UI/UX (Opus). Changes go through a PR that edits this file. |
| Date | 2026-09-30 |
| Implements | PRD §5 Epic D (D-1 to D-5), §8 routes, §9 states, §13 brand-contrast risk |
| Companion file | [`tokens.css`](./tokens.css): import it into `src/app/globals.css` (see §2.6) |

Read this doc in order the first time. After that, §4 (components), §6 (pages) and §9 (rubric) are the reference sections.

**Precedence.** If this doc conflicts with the PRD's acceptance criteria, the PRD wins and this doc gets fixed. **PRD strings are rendered verbatim**; where this doc would prefer different copy, it says so as a *Suggestion* and the PRD string ships. If this doc conflicts with an implementer's taste, this doc wins. Accessible roles and names are fixed by the selector contract (§11), which the Playwright tests in PR #2 align to.

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

- File: `https://www.firstmate.tech/images/firstmate-logo.svg` (825×169 viewBox). The site's header uses `<img alt="First Mate Technologies" class="h-9 w-auto">`, 36px tall. **Our alt text is "First Mate"**, because the adjacent "AI Playground" label completes the link name (§5.1).
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
| fg `#282943` | success-soft / warning-soft / danger-soft | 12.57 / 12.98 / 12.31 | 4.5 | Notice body text |
| accent-2 `#ec612a` | canvas `#ffffff` | 3.33 | 3.0 | Decorative / ≥24px only |
| code-fg `#e6edf3` | code-bg `#0f1729` | 15.13 | 4.5 | Code |
| code-muted `#9aa4b2` | code-bg `#0f1729` | 7.09 | 4.5 | Code comments |
| code-muted / code-fg | code-header `#16203a` | 6.40 / 13.65 | 4.5 | Code label / Copy button, clipboard hint |
| control-border `#8e8e8f` | canvas / surface | 3.27 / 3.11 | 3.0 | Input and checkbox boundaries |
| focus `#424bd1` | canvas / surface | 6.65 / 6.31 | 3.0 | Focus ring |
| code-focus `#9fa5ff` | code-bg / code-header | 7.92 / 7.14 | 3.0 | Focus inside code chrome |
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
| fg `#ededf3` | success-soft / warning-soft / danger-soft | 13.27 / 13.45 / 13.99 | 4.5 | Notice body text |
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

**Diagrams (§6.3.3, PRD DG-5).** Strokes need 3:1 and 12–14px text needs 4.5:1. Light / dark:

| Foreground | Background | Light | Dark | Need | Used for |
|---|---|---|---|---|---|
| fg `#282943` / `#ededf3` | surface-raised `#ffffff` / `#242538` | 14.11 | 12.89 | 4.5 | Node label, badge numeral |
| fg-muted `#5f606c` / `#a4a6ba` | surface-raised | 6.22 | 6.26 | 4.5 | Node sub-line, lane eyebrow |
| fg-muted | surface `#f9f9f9` / `#1b1c2b` | 5.91 | 7.01 | 4.5 (text), 3.0 (stroke) | Edge, axis and legend labels, zone and lane captions; edges, arrowheads, axis, rail, badge rings |
| fg | accent-soft `#ecedfa` / `#1d1f3d` | 12.13 | 13.69 | 4.5 | Emphasised node label (700) |
| control-border `#8e8e8f` / `#7c7f96` | surface | 3.11 | 4.27 | 3.0 | Node and zone boundaries |
| link `#424bd1` / `#9fa5ff` | surface / accent-soft | 6.31 / 5.72 | 7.45 / 7.07 | 3.0 | Emphasised node 2px boundary, against the ground outside and its own fill inside |
| danger `#a93d17` / `#ff9a7a` | surface | 5.92 | 8.14 | 4.5 (text), 3.0 (stroke) | Risk lines, ✕ caps, risk labels, risk badge rings |
| danger | surface-raised | 6.24 | 7.27 | 3.0 | Dashed risk exit-box boundary (its own fill inside) |
| link | accent-soft | 5.72 | 7.07 | 4.5 | Workflow `watch` line inside the "Why it works" callout |

**Rejected pair:** control-border on accent-soft is 2.81 in light, which fails 3:1. That is why a diagram inside the workflow callout keeps its own `bg-surface` band (§6.3.3) and is never drawn straight on `accent-soft`.

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
@import "../../docs/design/tokens.css"; /* single source of truth; do not copy it into src/ */
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

The tokens were compile-tested against Tailwind v4.3: semantic utilities generate and `bg-blue-500` does not. M0 (`ws-0/foundation`) ships Tailwind v4 (`@import "tailwindcss"` in `globals.css`), so this works as written. WS-A replaces M0's placeholder `--background`/`--foreground` tokens with this import.

---

## 3. Type, spacing, radii, elevation, motion

### 3.1 Type scale (Satoshi; weights 400/500/700 only)

| Style | Utility | Size / line | Weight | Colour | Use |
|---|---|---|---|---|---|
| Page title | `text-3xl md:text-4xl font-bold` | 30/38 → 36/44 | 700 | fg-strong | One `<h1>` per page |
| Section title | `text-2xl font-bold` | 24/32 | 700 | fg-strong | `<h2>`: level sections, "Today's digest", lesson sections |
| Card title | `text-lg md:text-xl font-bold` | 18/28 → 20/24 | 700 | fg-strong | `<h3>`: news titles, level cards, exercise title |
| Eyebrow | `text-sm font-bold uppercase tracking-eyebrow text-link` | 14/20 | 700 | link | "Level 2", "Continue", "Today" |
| Prose | `text-prose` | 17/28 | 400 | fg | Lesson concept, tab panels, callouts |
| UI body | `text-base` | 16/24 | 400 | fg | Forms, rows, notices |
| UI label | `text-sm font-medium` | 14/20 | 500 | fg | Buttons (sm), tabs, badges, filter labels |
| Meta | `text-sm` | 14/20 | 400 | fg-muted | Dates, source, minutes, Verified line |
| Micro | `text-xs font-medium` | 12/16 | 500 | fg-muted | Code block language label, badge (sm) |
| Code | `font-mono text-[0.875rem] leading-6` | 14/24 | 400 | code-fg | Blocks and inline code |

- Inline code: `font-mono text-[0.9em] bg-surface border border-border rounded-md px-1.5 py-0.5` in `text-fg`. No colour shift.
- Italic 400 is loaded so markdown `*emphasis*` is not synthesised. Bold-italic is synthesised; this is accepted because it is rare in lessons.
- Prose measure is at most 700px (`max-w-[var(--fm-measure)]`, about 75 characters at 17px). **Code blocks, tab panels' code, the tablist and the Key differences callout use the full main column** (about 765px at lg), not the 700px measure, which cuts horizontal scrolling on long commands. Only paragraphs and lists are held to the measure.
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
- **One live region per page**: the shell renders `<div id="fm-live" role="status" aria-live="polite" aria-atomic="true" class="sr-only">` once. Components announce with a small `announce(text)` helper that clears the region and sets the text on the next frame. Don't create per-component live regions. The exception is `Notice` with `role="status"` (§4.10).

### 4.1 Button

| Variant | Classes (light and dark via tokens) | Use |
|---|---|---|
| `primary` | `bg-primary text-primary-fg hover:bg-primary-hover font-bold` | The single main action on a surface: "Continue", "Mark complete", "Replace my progress" |
| `secondary` | `bg-accent-subtle text-link hover:bg-accent-soft font-medium` | Secondary actions: "Export progress", "Try again" |
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

Badges are not interactive. Filter chips are a separate `FilterChip`: a `link` styled as a badge with an `X` icon, named "Remove filter: \<value\>" (for example "Remove filter: Tooling"), pointing at the current URL minus that param so it works without JS. At least 24px tall, and 44px on coarse pointers.

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

- `div[role=tablist][aria-label="Tool"]`. The exercise panel's instance uses `aria-label="Starting prompt"` so screen-reader users can tell the two tablists apart.
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
- No native equivalent: the panel shows a `Notice` (variant `neutral`, icon `Info`, title "No native equivalent in Codex CLI (as of v0.x.y)"), followed by `h4` "Closest workaround" and prose rendered from `codex_workaround_md` / `claude_workaround_md` (the lesson row's per-tool workaround field). The panel is never empty (L-3).

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
- Copy button: `ghost`-style, sized `sm` (`h-8 px-2.5`, and 44px on coarse pointers), `text-code-fg hover:bg-white/10`, with icon `Copy` and the visible label "Copy". Accessible name: "Copy code: \<label\>", for example "Copy code: bash", built from visible text "Copy" plus an sr-only suffix (no `aria-label`, so the name always contains the visible text). The focus ring uses `code-focus` automatically (tokens.css `[data-code-chrome]`).

**Behaviour**

1. Click → `navigator.clipboard.writeText(raw)`, where `raw` is the fence's **source text** (not `innerText` of the highlighted DOM), with only the final trailing newline trimmed.
2. Success → the icon becomes `Check`, the visible label becomes "Copied" and the sr-only suffix is dropped, so the accessible name is "Copied" for the next 2s. Call `announce("Copied")` into the page's polite live region. After 2000ms, revert. Repeated clicks restart the timer. Focus stays on the button.
3. **Clipboard denied or unavailable** (the promise rejects, or `navigator.clipboard` is undefined on a non-secure origin):
   - Select the code: `Range.selectNodeContents(codeEl)` → `getSelection().addRange`.
   - Move focus to the `<pre>` so the selection is live for the keyboard shortcut.
   - Show an inline hint directly under the header, inside the figure: `<p class="px-3 py-2 text-sm bg-code-header text-code-fg border-t border-code-border">Press ⌘C to copy</p>`. Use "Ctrl+C" when not on macOS (`navigator.userAgentData?.platform ?? navigator.platform`).
   - `announce("Copy blocked. Code selected. Press ⌘C to copy.")`.
   - The hint stays until the next click anywhere outside the block or 8s, whichever is later. The button label reads "Copy" again (not "Failed").
4. Shell blocks never include a `$ ` prompt. If authors add one, the seed validation should flag it (a WS-B note).

**Variants**: `CodeBlock` (fenced, above) and `CommandLine`, a single-line variant for setup and verify commands in the exercise panel and in empty states. `CommandLine` has the same chrome with the label as an explicit prop ("Setup", "Verify", "Terminal").

### 4.6 Checkbox (E-2)

- **Native `<input type="checkbox">`**, `size-5`, `accent-color: var(--fm-primary)` in light and `var(--fm-link)` in dark (the brand primary would draw the checked box at 2.53:1 on dark `surface`; `#9fa5ff` is 7.45:1), `rounded` via the UA. Use the native control; don't restyle it with a custom box. It stays accessible and matches D-2 without custom ARIA.
- Row: `<label class="flex items-start gap-3 py-2.5 min-h-11 cursor-pointer">`, containing the checkbox (`mt-0.5`) and `<span class="text-base text-fg">`. The whole row is the hit target (44px).
- Checked: the text is **not** struck through (legibility). The native check is the signal, and the list's count updates.
- The checklist is a `fieldset` whose `legend` is exactly "Checklist" (styled at h4 size; the "4." step number in §6.3.1 is an `aria-hidden` span outside the legend, so the group name stays "Checklist"). Next to the legend: a meta line reading "3 of 5 done" and a `ProgressBar` size `sm` named "Checklist". When everything is checked, the header's meta is replaced by a success Badge `Check` "Exercise complete", and `announce("Exercise complete")` fires once on the transition, not on page load.
- Pre-hydration: checkboxes render **unchecked and disabled** with `aria-busy` on the list, then enable after mount. Don't render a checked state from the server (P-5). Keeping them disabled for the few ms before hydration prevents a lost click.

### 4.7 ProgressBar (C-2)

- `div[role=progressbar][aria-valuemin=0][aria-valuemax=100][aria-valuenow={pct}][aria-label="Level 3"]`, with `aria-valuetext="2 of 4 lessons complete"`.
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
- Dismissible: an icon button (`X`, `aria-label="Dismiss"`) at top-right. After dismissal, focus moves to the `<main>` heading (h1), which is `tabindex=-1`.
- **Live-region rule**:
  - A **danger** Notice rendered after mount because of an event (the route error boundary, import failed) gets `role="alert"`.
  - A **warning, info or success** Notice rendered after mount because of an event (corrupted-state reset, storage-blocked detection, import preview or success) gets `role="status"`.
  - A Notice present in the server HTML (stale digest) gets **no** live role, because it's just content.
  - `role="alert"` is used nowhere else.

### 4.11 Global banners (P-2, P-3)

These live in a `GlobalNotices` slot directly under the header, inside the container, above `<main>`'s h1. They are client-only and appear after mount.

- **Storage unavailable (P-3)**: `warning` Notice, compact single line. Title "Progress can't be saved in this browser." Body: "Everything still works for this visit. Private windows and blocked site data prevent saving." Not dismissible, because the condition persists. `role="status"`.
- **Corrupted state (P-2)**: `warning` Notice, dismissible. Title "Saved progress was unreadable and has been reset." Body: "If you exported a backup, you can import it on the Progress page." with a link to `/progress`. `role="status"`. Dismissal is session-only.
- If both would show, show only the storage banner. Corruption can't be persisted anyway.

### 4.12 News card (N-1, N-2, N-5)

**Anatomy (scored), from `md` up** (three columns: tile, content, bookmark)

```
┌──────────────────────────────────────────────────────────────────┐
│ ┌────┐  Anthropic ships Claude Opus 5.5 with 1M context  ↗   [🔖] │  ← areas: tile | title | bookmark
│ │ 87 │  Anthropic news · Wed 30 Sep, 06:10                        │  ← tile | meta (spans 2)
│ │/100│  [New model] [Tooling]                                     │  ← tile | tags (spans 2)
│ └────┘  WHY IT MATTERS                                            │
│         Client MVPs on Opus can drop the chunking layer in…      │  ← tile | why (spans 2)
└──────────────────────────────────────────────────────────────────┘
```

**Anatomy (scored), below `md`** (360px: the title, tags and why-it-matters span the full card width)

```
┌──────────────────────────────────┐   328px card, p-4 → 296px content
│ ┌──┐ Anthropic news        [🔖]  │  ← tile | meta | bookmark (44×44)
│ │87│ Wed 30 Sep, 06:10           │
│ └──┘                             │
│ Anthropic ships Claude Opus 5.5  │  ← title (full width, 296px)
│ with 1M context ↗                │
│ [New model] [Tooling]            │  ← tags (full width)
│ WHY IT MATTERS                   │
│ Client MVPs on Opus can drop the │  ← why (full width, text-base)
│ chunking layer in retrieval…     │
└──────────────────────────────────┘
```

- Container: `<article aria-labelledby={titleId} class="rounded-card bg-surface p-4 md:p-6 grid grid-cols-[auto_1fr_auto] gap-x-3 md:gap-x-4 gap-y-2">` with **named grid areas**:

  ```css
  /* < md */
  grid-template-areas:
    "tile meta bookmark"
    "title title title"
    "tags tags tags"
    "why why why";
  /* >= md */
  grid-template-areas:
    "tile title bookmark"
    "tile meta meta"
    "tile tags tags"
    "tile why why";
  ```

  Implement the templates as a small CSS class next to NewsCard (for example `.news-card` with an `@media (width >= 48rem)` override), and give each child `[grid-area:tile]`, `[grid-area:title]` and so on. Tailwind arbitrary `[grid-template-areas:…]` values also work but are hard to read. The tile is `self-start`.
- **DOM order**: tile, title (`h3`), meta, bookmark, tags, why. The focus order is title link, then bookmark, at every width. Below `md` the bookmark sits visually above the title; that small reversal is accepted, because naming the item before acting on it is the better reading order for screen readers.
- Width check at 360: card 328px, `p-4` leaves 296px. Row 1 is tile 48 + gap 12 + meta ≈ 180 + gap 12 + bookmark 44. The title, tags and why-it-matters get the full 296px: a 280-character why-it-matters runs about 7 lines at 16px, where the two-column layout gave 11.
- **Score tile**: `size-14 rounded-xl bg-canvas border border-border flex flex-col items-center justify-center`. The number is `text-xl font-bold text-link tabular-nums`, with a `text-xs text-fg-muted` "/100" under it. Accessible text: `<span class="sr-only">Relevance score</span> 87 <span class="sr-only">out of 100</span>`. **No traffic-light colouring by score.** The score is a ranking signal, not a status. Below `md` the tile is `size-12` (and the number `text-lg`).
- **Title**: `h3 > a`, `text-lg font-bold text-fg-strong hover:text-link hover:underline`, `href` = source URL, `target="_blank" rel="noopener noreferrer"`, followed by a 14px `ArrowUpRight` icon and `<span class="sr-only">(opens in new tab)</span>`. The titles come from feeds; render them as text and never as HTML.
- **Meta line**: `text-sm text-fg-muted`: source name, then ` · `, then `<time datetime="{published_at ISO}">Wed 30 Sep, 06:10</time>`. Times are shown in Asia/Manila with the `en-PH` format "EEE d MMM, HH:mm". The published date is always shown, including on `/news` for same-day items (N-1).
- **Tags**: `<ul aria-label="Tags">` of `Badge`s (variant `tag`), with labels mapped from the enum: `new-model` → "New model", `tooling` → "Tooling", `framework` → "Framework", `business` → "Business", and `security` → **variant `danger`** with a `ShieldAlert` icon, "Security". Order is fixed as listed so the security chip is always last.
- **Why it matters**: eyebrow "Why it matters" (`text-xs font-bold uppercase tracking-eyebrow text-fg-muted`, not the link colour, to keep link colour for things you can act on), then `<p class="text-base">` (16px; card text is not long-form reading, and 17px prose sat too close to the 18px title). **Plain text only** (PRD §13 injection). The field is capped at 280 characters by the pipeline, so there's no truncation in the UI.
- **Bookmark**: icon button `Bookmark` / `BookmarkCheck`, `aria-pressed`, `aria-label="Bookmark: {title}"`, in the `bookmark` grid area (`size-9`, and `size-11` on coarse pointers, `self-start justify-self-end`). Pre-hydration it renders unpressed and `aria-disabled`, then enables after mount.
- **Card is not a stretched link.** It has two interactive elements.

**Variants**

- `unscored` (N-2): no score tile. The `tile` area is dropped from the template at every width (`grid-cols-[1fr_auto]`, rows "title bookmark" / "meta meta"). The meta line gets a `neutral` badge "Unscored" (or "Scoring failed" when `scoring_status=failed`). No tags, no why-it-matters. The title link stays.
- `compact` (home top 3): no why-it-matters text and no tags; the `tags` and `why` rows are dropped. The score tile is `size-12` at every width and uses the `md` template (tile beside the title) even at 360, because with no body text the title keeps about 190px.
- `unavailable` (N-5, bookmarks): `bg-surface border border-dashed border-border`, text "Item no longer available" in `text-fg-muted`, with a "Remove bookmark" ghost button. No link.

### 4.13 Star and reactions (PRD §18, CM-1 to CM-6, CM-11; design addendum D-R)

**Intent.** This should feel like colleagues saying "this worked for me", not like a social feed. The warmth comes from three things:
- **Real names** in plain text, shown next to the reaction they gave.
- **The verbs** of the four reactions.
- **A thank-you** on the first reaction.

It does **not** come from colour, animation or numbers. There are no avatars, no profiles, no "trending", no ranking by count, no confetti, and no notification dots. Counts stay `fg-muted`-quiet, and names are what draw the eye.

The brand rules hold:
- The filled Star is `text-link`, not gold and not `accent-2` (§2.2 keeps accent-2 for the nav dot and illustrations).
- The emoji are the only colour the feature adds.
- Each emoji is always `aria-hidden` and, on the workflow page, always next to its word label.

**Reaction set** (fixed order everywhere): 🙌 Worked for me · 💡 Learned something · ⏱️ Saved me time · 🔥 Game-changer.

```
/workflows card (stretched link; only the Star is interactive)        /workflows/[slug], md and up (Star in the eyebrow row)
┌──────────────────────────────────────────┐                          WORKFLOW                                   [☆ Star 12]
│ Title (stretched link)                   │                          Title                                          (h1)
│ Problem, 2 lines                         │                          ✓ Reviewed by stewards · … · by Ada       (meta line)
│ [Claude Code] [Hook]   [Next.js]         │                          [🙌 Worked for me 4] [💡 Learned something 1] [⏱️ Saved me time] [🔥 Game-changer 2]
│ Verified 25 Sep 2026 · by Ada            │                          🙌 Rafael, Ana and 2 others
│ 🙌 4 · 🔥 2                     [☆ 12]   │                          🔥 Lea and 1 other
└──────────────────────────────────────────┘                          Reacting as Rafael · Edit name

/workflows/[slug] below md (column 328): exactly 2 rows of reactions
WORKFLOW                 [☆ 12]
Title (h1)
meta line…
┌───────────────┐ ┌───────────────┐
│ 🙌 Worked   4 │ │ 💡 Learned  1 │      ← grid-cols-2 gap-2, each pill full cell width (160px)
├───────────────┤ ├───────────────┤
│ ⏱️ Saved      │ │ 🔥 Game-changer 2│
└───────────────┘ └───────────────┘
🙌 Rafael, Ana and 2 others
Reacting as Rafael · Edit name
First reaction in this browser (inline, not a modal):
┌ bg-accent-subtle rounded-xl p-4 ─────────────────────────────┐
│ Thanks for sharing that.                                     │
│ Add your name? Optional                       (legend, bold) │
│ Your name [______________]  [ Save ]  Skip                   │
│ Shown next to your reactions. Saved in this browser.         │
└──────────────────────────────────────────────────────────────┘
```

#### 4.13.1 Star toggle

- **Element.** `button type="button" aria-pressed`.
  - Idle: a 16px outline `Star` icon plus the count (`tabular-nums`).
  - Pressed: the icon is filled (`fill-current text-link`) and the count is `text-fg-strong`.
  - The state is carried by shape (filled vs outline) and by `aria-pressed`, never by colour alone.
- **On a card:** an icon-and-count pill, `relative z-10 inline-flex h-9 min-w-11 items-center gap-1.5 rounded-full border border-border bg-canvas px-3 text-sm font-medium text-fg-muted hover:bg-surface touch:h-11`.
  - It is the only interactive element inside the stretched-link card (§4.2). Its `relative z-10` keeps a click on it from opening the workflow.
  - **Name:** `aria-label="Star <title>, <n> stars"` ("1 star", "0 stars"). The visible count is inside the name (2.5.3).
- **On the page: a separate control, not part of the reactions.** The Star means "save and appreciate this workflow"; reactions say what it did for you. It is **never** inside the `Reactions` group.
  - **Placement:** the eyebrow row of W2's §6.12 header becomes `flex items-center justify-between gap-3`: eyebrow "Workflow" on the left, the Star on the right, aligned to the eyebrow at every width. That costs no extra row, which matters at 360.
  - md and up: an `h-11` pill with a visible word, `☆ Star 12`. Below md: the same pill without the word, `☆ 12` (`min-w-11`). The name is the same at every width.
  - **Name:** `aria-label="Star, <n> stars"`, for example "Star, 12 stars" (the page `h1` already names the workflow). The visible "Star" and count are both inside the name (2.5.3).
  - The label never changes to "Starred". `aria-pressed` and the filled icon carry the state.
- **Zero:** shows `0` on the page ("☆ Star 0", per PRD §18.7) and `0` on cards, so the control keeps its width.
- **Press feedback:** the icon scales 1 → 1.15 → 1 over `--fm-duration-fast`. There is no scale under reduced motion. No other motion.

#### 4.13.2 Reaction bar (workflow page only; toggles)

- **Container.** A `div role="group" aria-label="Reactions"` holding the four reaction buttons and nothing else (the Star is in the header, §4.13.1). It sits directly after the meta line, before At a glance and Result: `mt-5 grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center`.
- **Reaction button.** `button type="button" aria-pressed aria-describedby="reactors-<key>"` with `inline-flex h-11 items-center gap-2 rounded-full border border-border bg-canvas px-3.5 text-sm font-medium text-fg hover:bg-surface`.
  - Content: `<span aria-hidden="true">🙌</span>`, then the visible label, then the count `<span class="ml-auto tabular-nums text-fg-muted md:ml-0">4</span>`.
  - **Visible label by width.** md and up shows the full label ("Worked for me", "Learned something", "Saved me time", "Game-changer"). Below md it shows a short form so two pills fit in a 328px row: "Worked", "Learned", "Saved", "Game-changer". The labels are two spans, `<span class="md:hidden">Worked</span><span class="hidden md:inline">Worked for me</span>`. **Rule: each short form must be a prefix of its full label**, so the accessible name always contains the visible text as a contiguous substring (2.5.3 Label in Name). The pairs are "Worked" in "Worked for me", "Learned" in "Learned something", "Saved" in "Saved me time" and "Game-changer" in "Game-changer". "Saved time" is **not** allowed, because it isn't a substring of "Saved me time". R1 adds a unit test asserting `fullLabel.startsWith(shortLabel)` for all four.
  - **Accessible name** comes from `aria-label="<Full label> <n>"`, for example `aria-label="Worked for me 4"`, so it is identical at every width and doesn't depend on which span is displayed.
  - Below md the pill is `w-full justify-start` (it fills its grid cell; the count sits at the right edge). md and up it is `w-auto`.
  - A zero count is visually hidden but kept for assistive tech (`<span class="sr-only">0</span>`). That keeps the bar from shouting "0" four times on a new workflow, while the name stays regular.
  - **Pressed:** `bg-accent-soft ring-2 ring-inset ring-link border-transparent text-fg-strong`, and the count turns `text-fg-strong`. The 2px ring is a weight change, not only a colour change, so pressed is never colour-only.
  - **Name:** "<Full label> <n>", for example "Worked for me 4", at every width (the emoji is hidden).
  - Any subset can be on at once.
- **Rows by width.**
  - **Below md: exactly 2 rows** (a 2×2 grid, 2 × 44px + 8px = 96px). The longest short pill, "🔥 Game-changer 2", is about 140px, which fits a 160px cell.
  - md and up: one row. The four full-label pills are about 640px, within the 720px (md) and about 740px (lg) columns.
  - Pills never truncate and never scroll horizontally.
- **Vertical budget at 360** (from the end of the meta line to Result). The 2-row bar is 96px. The reactor lines are at most 4 × 20px, plus the name line at 24px, plus 32px of margins. That makes about 230px worst case, against about 340px for the earlier 4-row wrap. A workflow with no reactions spends only the 96px bar plus the name line.

#### 4.13.3 Reactor lines ("who reacted", CM-3)

- `ul` with `mt-3 space-y-1 text-sm text-fg-muted`, with one `li id="reactors-<key>"` per reaction that has at least 1, in the fixed order. The list is omitted when everything is zero.
- Each line reads `<span aria-hidden="true">🙌</span> <span class="sr-only">Worked for me: </span>{formatReactors(names, total)}`. That gives, for example, "Rafael, Ana and 3 others", "Rafael and Ana", "1 person" or "4 people".
  - Names are `text-fg font-medium`. They are the warm part, so they get more weight than the surrounding muted text.
  - "and 3 others" stays `fg-muted`.
- **Plain text only** (CM-4): React text nodes, never markdown or HTML.
  - Each name is an `inline-block max-w-[18ch] truncate align-bottom` span with `title={name}`, so a 40-character name ends in "…" and never pushes "and 3 others" off the line.
  - The joining words ("and", "others") are never truncated.
  - Names are rendered in the `dir="auto"` isolate (`<bdi>`), so a right-to-left name cannot reorder the sentence.
- The lines are server-rendered with the counts (CM-6), so they are correct on first paint. After the user reacts, the line updates optimistically:
  - The count changes.
  - The user's own name is **not** inserted locally, because the server's "2 most recent names" is the source of truth and is refetched on the next page load.

#### 4.13.4 Read-only counts on cards (CM-2)

- A `p` with `mt-2 text-sm text-fg-muted tabular-nums` in the card footer, before the Star. It has two children:
  - One visible, `aria-hidden` span with the compact form, for example "🙌 4 · 🔥 2".
  - One `sr-only` span with the whole sentence, comma-separated in the fixed order, for example "3 worked for me, 2 learned something, 1 saved me time, 2 game-changer". It is a single string, so a screen reader never runs two counts together.
  - Zero reactions are omitted from both. The whole `p` is omitted when every reaction is zero.
- **Footer layout.** `mt-auto pt-4 flex items-end justify-between gap-3`. The left column holds the existing "Verified … · by …" line, then the counts row. The Star sits on the right, bottom-aligned. At 360 the left column wraps and the Star keeps its width (`shrink-0`).
- The emoji-only row is the **one sanctioned exception** to "an emoji never stands alone" (PRD §18.5 gives this exact form for cards). The page bar teaches each emoji's meaning, and the sr-only text gives the full words. Do not add tooltips: they don't work on touch, and they would sit under the stretched link.

#### 4.13.5 Name prompt (first reaction or star in this browser, CM-4)

- **When.** It appears on the first Star or reaction in a browser whose `namePrompted` is false, *after* the action has already happened optimistically. It never blocks the action, and it never appears again once Saved or Skipped.
- **Where.**
  - On the page: directly under the reaction bar, above the reactor lines, whether it was triggered by a reaction or by the header Star. It is the one place on the page for community follow-ups.
  - On a card: inside the card, under the footer, full card width, with `relative z-10`. The card grows, and the grid row grows with it.
  - Only one prompt exists on screen at a time.
- **Anatomy.** A `form` that is a `region` with `aria-labelledby` on its legend, styled `mt-3 rounded-xl bg-accent-subtle p-4`.
  - A thank-you line in `text-sm text-fg`: "Thanks for sharing that." (after a reaction) or "Thanks for the star." (after a star).
  - Then the legend "Add your name? Optional" (`text-base font-bold text-fg-strong`, with "Optional" as part of the visible text).
  - Then the field row (`flex flex-wrap items-end gap-2`):
    - A visible label "Your name" and an `input type="text" maxlength="40" autocomplete="nickname"` (`h-11` or `h-9`, matching §4.1 sizes).
    - A `primary sm` "Save".
    - A `ghost sm` "Skip".
  - Then helper text in `text-sm text-fg-muted`: "Shown next to your reactions. Saved in this browser."
  - The input is `aria-describedby` the helper.
- **Focus.** Focus stays on the control that was pressed, so the person can keep reacting. The prompt is next in Tab order, because it follows the bar in the DOM. It is announced once through `#fm-live`: "Add your name? Optional."
  - Save and Skip remove the prompt and return focus to the control that triggered it (on the page, that is also where the "Reacting as …" line now sits).
  - `Escape` inside the prompt equals Skip.
- **Save.** The name is normalised by the shared rule (CM-4). If it's empty after normalising, it behaves as Skip. Otherwise the prompt closes, `announce("Name saved")` fires, and the reactor line updates on the next load.
  - If `community_set_name` fails, the prompt stays open with inline `text-sm text-danger` "Couldn't save your name. Try again.", and focus stays in the input. The local name is still stored, so the next Save retries.
- **Skip.** Stores `null`, closes, announces nothing, and returns focus.

#### 4.13.6 "Your name" control (workflow page, CM-4)

- One line under the reactor lines: `mt-2 text-sm text-fg-muted`.
  - With a name: "Reacting as **Rafael** · Edit name". The name is in `text-fg font-medium` inside `<bdi>`, truncated at `18ch` like the reactor names.
  - Without one: "Reacting anonymously · Add name".
  - The action is a `button` styled as the §4.1 `link` variant (`min-h-6`, `touch:min-h-11`).
  - **Wording: "Edit name" (with a name) and "Add name" (without).** PRD §18 CM-4 is amended in this PR to match (it said "Edit"). A bare "Edit" next to a name is ambiguous for screen-reader users who reach the button by Tab alone.
- **Editing** swaps the line for the prompt form without the thank-you line: legend "Your name", the same input prefilled, "Save", "Cancel", and the helper "Saved in this browser. Clear it to react anonymously."
  - On open, focus goes to the input with its text selected.
  - On Save or Cancel, focus returns to the "Edit name" / "Add name" button.
  - An empty Save makes every reaction from this browser anonymous and announces "You're reacting anonymously". A non-empty Save announces "Name saved".
- **Client-only.** The line depends on localStorage. It renders after hydration in a reserved `min-h-6` slot, so nothing below it moves (P-5).

#### 4.13.7 States

| State | Card | Page |
|---|---|---|
| Server render / before `mine` resolves (CM-6) | Counts are correct. The Star is unpressed and `aria-disabled="true"` (the NewsCard bookmark pattern). | Counts and reactor lines are correct. The Star and the four reaction toggles are unpressed and `aria-disabled`. The "Your name" slot is reserved. There is no layout shift when pressed states apply. |
| `mine` fails | The toggles enable as unpressed. Writes are desired-state, so a mistaken "on" is a no-op. | Same. |
| Optimistic press (CM-5) | The icon fills and the count goes up by 1 at once. The control is never disabled while a request is in flight. Rapid presses send only the last desired state. | Same, per reaction. The reactor line's count text updates. |
| Rolled back (error, `workflow_unavailable`) | The state and count revert within 2s. `#fm-live` says "Couldn't save your star. Try again." A visible `text-sm text-danger` line with the same text appears under the card footer. It clears on the next successful action or after 8s. | The same revert and announcement ("…your reaction…"). The visible error line sits under the bar. |
| Rate-limited | Reverts, with "Too many changes. Wait a minute and try again." (announced and visible). The controls stay enabled. | Same. |
| Offline | Treated as a failed write: the same rollback and "Couldn't save…" message. There is no separate offline banner. Nothing is queued, so the UI never claims a save that didn't happen. | Same. |
| Community read failed (§18.7) | No Star and no counts row. The card is otherwise normal. | The header Star and the whole community block (bar, lines, name control) are absent. There is no empty shell and no error. |
| Archived workflow (CM-11, P1) | The Star is `aria-disabled` and shows its count. | Every toggle is `aria-disabled` with counts and `aria-describedby` a note under the bar, "Reactions are closed on archived workflows." in `text-sm text-fg-muted`. `aria-disabled` keeps the toggles focusable, so screen-reader users hear why. |
| All zero | `0` on the Star and no counts row. | "☆ Star 0" and the four labels without counts. No reactor list. |

**Honest-counts copy.** Counts are never called "verified", "people who ran this", "users" or anything similar.
- The reactor line uses the PRD's "person / people" wording.
- The only explicit caveat is the name helper's "Saved in this browser". Counts are best-effort per browser, and adding a disclaimer under every bar would read as distrust of colleagues.
- If the stakeholder wants one, the place for it is the "Your name" helper: "Counts are per browser, so treat them as a rough guide."

**Light and dark.** Every surface and text colour is a token already in the §2.4 ledger:
- Pills: `canvas`, `border`, `fg`, `fg-muted`.
- Pressed pills: `accent-soft`, a `link` ring, `fg-strong`.
- Prompt: `accent-subtle`.
- Errors: `danger`.

In dark mode the pills keep `border-border`, and the pressed ring is `#9fa5ff` on `#1d1f3d`. The emoji render as the platform draws them. Their legibility doesn't depend on them, because the words carry the meaning.

**Focus.** Every toggle and button uses the §4.0 ring (`focus-visible:outline-2 outline-solid outline-focus outline-offset-2`), with `rounded-full` matching the pill. The card Star's ring must sit above the card's `:has(a:focus-visible)` ring. Because the Star is not an `a`, the card's ring doesn't light up when the Star has focus.

**Announcements** (`#fm-live`, polite):
- "Couldn't save your star. Try again." / "Couldn't save your reaction. Try again."
- "Too many changes. Wait a minute and try again."
- "Add your name? Optional." (once per browser)
- "Name saved"
- "You're reacting anonymously"

Successful toggles announce nothing, because `aria-pressed` already reports the new state.

**Touch.** The page pills are 44px (`h-11`) at every width. The card Star is 36px on fine pointers and 44px on coarse ones. The name buttons are 44px on coarse pointers. Adjacent pills keep `gap-2` (8px), so no two targets overlap.

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

**Header (≥ lg, 1024px+)**

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│ [FM logo] AI Playground     Curriculum  Exercises  News  Bookmarks      Progress │
│                             ━━━━━━━━━━                                            │
└───────────────────────────────────────────────────────────────────────────────────┘
```

- Left: `<a href="/">` containing the logo `<img alt="First Mate">` (h-9) and `<span class="text-sm font-bold text-fg-strong">AI Playground</span>`, with `gap-3` and a 1px `border-l border-border h-5` divider between them. Accessible name: "First Mate AI Playground" (the img alt plus the visible label; this is the §11 value).
- Nav: `<nav aria-label="Main">` holding a `<ul>` of links `h-[60px] inline-flex items-center px-3 text-sm font-medium text-fg-muted hover:text-fg`. **Active: `text-fg-strong font-bold` plus a 2px `link` bar pinned to the header's bottom edge, plus `aria-current="page"`.**
- Active matching: `/curriculum` is active for `/curriculum` and `/lessons/*`. `/exercises` is active for `/exercises`. `/news` is active for `/news` **and** `/news/archive`. `/bookmarks` and `/progress` match exactly. `/` activates nothing (the logo is home).
- "Progress" sits alone on the right with a lucide `Settings2` icon plus text, because it is utility rather than content.
- **The full nav starts at lg (1024px).** With six links ("Workflows" was added) the row needs about 1000px once the brand is counted, and it overflowed at 768px on Linux, where the fallback font is wider than on macOS. So between md and lg (768–1023px) the header uses the same Menu button and disclosure as below md, with the "AI Playground" label visible. Do not shave padding to fit six links at 768; a wider font will break it again. The e2e checks 1024px and 768px with a wide-font stress style.

**Header (< lg, 360–1023px)**

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

- Menu button: `button[aria-expanded][aria-controls="mobile-nav"]` at `size-11`, with icon `Menu` or `X` and a **fixed** `aria-label="Menu"`; the open or closed state is conveyed by `aria-expanded` only.
- The panel is a **disclosure, not a modal**: `nav#mobile-nav[aria-label="Main"]` directly under the header, `bg-surface-raised shadow-sm`, full-width links `h-12 px-4 text-base`. It pushes content down; it is not an overlay. There's no focus trap.
- Behaviour: on open, focus moves to the first link (PR #2 expects this; there is still no focus trap). **Esc** closes and returns focus to the button. Choosing a link navigates and closes (close on `pathname` change). The panel closes if the viewport grows to md or wider.
- **Fit at 360**: brand (h-8 logo ≈ 156px + divider + "AI Playground" ≈ 95px + gaps) plus the 44px menu button leaves about 8px in 328px. Below 375px (`max-[374px]:`), the "AI Playground" label and divider are `sr-only`, so the link keeps its full accessible name while the logo stands alone. At 375px and up the label shows.
- Render the desktop `<nav>` and the mobile `<nav>` so that only one is exposed at a time (`hidden lg:flex` / `lg:hidden`). Two visible "Main" landmarks fail axe.

**Skip link**: `<a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 bg-canvas text-link px-4 py-2 rounded-lg">Skip to content</a>`. Activating it focuses `<main tabindex=-1>`.

**Footer**: `py-8 text-sm text-fg-muted`: "First Mate AI Playground · internal, runs locally", and on the right, "Content verified per lesson · News updates daily ~08:00 Manila". There are no links except `/progress`.

### 5.2 Grid and breakpoints

| Breakpoint | Width | Content columns | Notes |
|---|---|---|---|
| base | 360–767 | 1 | `px-4`. Everything stacks. |
| md | 768–1023 | 1 (level/news grids go to 2) | `px-6`. Menu-button header (the full nav starts at lg). |
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
│ basics to orchestration      (h1 30) │    │                                                                                │
│                                      │    │                                                                                │
│                                      │    │ ┌─ col-span-7 ─────────────────────────────┐ ┌─ col-span-5 ─────────────────┐ │
│ ┌─ Continue card (accent-soft) ────┐ │    │ │ ┌─ Continue card (accent-soft) ────────┐ │ │ TODAY · Wed 30 Sep     eyebrow│ │
│ │ CONTINUE                         │ │    │ │ │ CONTINUE                    eyebrow  │ │ │ ┌87┐ Anthropic ships Opus…  ↗ │ │
│ │ Project instructions: CLAUDE.md  │ │    │ │ │ Project instructions: CLAUDE.md vs   │ │ │ └──┘ Anthropic news · 06:10   │ │
│ │ vs AGENTS.md               (h2)  │ │    │ │ │ AGENTS.md                     (h2)   │ │ │ ┌74┐ Next.js 16.2 changes…  ↗ │ │
│ │ L2 · 15 min            (meta)    │ │    │ │ │ L2 · Context engineering · 15 min    │ │ │ └──┘ Vercel blog · 05:02      │ │
│ │ [ Continue: Project instr… → ]   │ │    │ │ │ [ Continue: Project instructions… →] │ │ │ ┌66┐ Supabase advisory…     ↗ │ │
│ └──────────────────────────────────┘ │    │ │ └──────────────────────────────────────┘ │ │ └──┘ Supabase blog · 01:40    │ │
│                                      │    │ │ Your levels                       (h2)   │ │ See all →              (link) │ │
│ Your levels                    (h2)  │    │ │ ┌ L1 ────────┐┌ L2 ────────┐┌ L3 ────────┐ │ └───────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │    │ │ │Foundations ││Context eng.││Agentic     │ │                                    │
│ │ L1 Foundations         3 / 3  ✓  │ │    │ │ │3 / 3 ✓Done ││1 / 3       ││0 / 4       │ │                                    │
│ │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │ │    │ │ │━━━━━━━━━━━ ││━━━───────  ││─────────── │ │                                    │
│ ├──────────────────────────────────┤ │    │ │ └────────────┘└────────────┘└────────────┘ │                                    │
│ │ L2 Context engineering  1 / 3    │ │    │ │ ┌ L4 ────────┐┌ L5 ────────┐              │                                    │
│ │ ━━━━━━━━━━───────────────────── │ │    │ │ │Parallelism ││Orchestrat. │              │                                    │
│ ├ … L3, L4, L5 rows ───────────────┤ │    │ │ │0 / 4       ││0 / 4       │              │                                    │
│ └──────────────────────────────────┘ │    │ │ └────────────┘└────────────┘              │                                    │
│ View full curriculum →               │    │ │ View full curriculum →                   │                                    │
│                                      │    │ └──────────────────────────────────────────┘                                    │
│ Today · Wed 30 Sep             (h2)  │    └────────────────────────────────────────────────────────────────────────────────┘
│ [87] Anthropic ships Opus… ↗         │      (levels: grid-cols-3 stretched-link cards → /curriculum#level-2; link name "Level 2 …")
│ [74] Next.js 16.2 changes… ↗         │
│ [66] Supabase advisory…    ↗         │
│ See all →                            │
└──────────────────────────────────────┘
```

- At 360, Continue comes first, then levels as a compact list (not 5 cards), then news. At md, levels become `grid-cols-2`. **At lg (M2 layout, supersedes the wireframe above):** the 7-column side holds Continue, then "Your levels" as `grid-cols-3` cards under it, then "View full curriculum →"; the 5-column side holds the news column. The levels no longer span the full width (that left about 250px of dead space under Continue). The "→" on "See all" and "View full curriculum" is `aria-hidden`.
- Level cards: the stretched link's text is `<span aria-hidden="true">L2</span><span class="sr-only">Level 2</span> Context engineering`, so the visible form is short and the accessible name is "Level 2 Context engineering" (§11). At 360 the compact rows use the same markup.
- The Continue card is `bg-accent-soft rounded-card`. It is the only accent-filled surface on the page.
- **States**
  - **Continue link (C-4, verbatim)**: the primary control is a link whose visible text and accessible name are exactly `Continue: <lesson title>`, styled as a `primary` button (`max-w-full`, the title truncates with `truncate` inside the button but the full title stays in the accessible name). The card also shows the title as an `h2` and the meta line above it. With no history, the same link reads `Continue: <first L1 lesson title>` and points at it (C-4.2).
    - *Suggestion (not shipped):* "Start here" / "Start lesson 1.1" copy for the no-history case would be clearer. It needs a PRD change first.
  - **Continue target (amended M2, PRD C-4.1):** resume the last-viewed lesson; if it is already completed, the link points to the next incomplete lesson in curriculum order (wrapping to the earliest incomplete one). Same link, same `Continue: <title>` name.
  - **All lessons complete:** the card keeps its shell (same background, padding and radius; at 360 its height follows its content, which is taller than a Continue card) and shows the h2 "You've completed the curriculum", a meta line ("All N lessons are marked complete. Revisit any of them from the curriculum."), and a primary link "Review the curriculum" → `/curriculum`. There is no `Continue: …` link in this state.

    ```
    ┌─ Continue card (accent-soft) ──────────────┐
    │ CONTINUE                          eyebrow  │
    │ You've completed the curriculum      (h2)  │
    │ All 18 lessons are marked complete. …      │
    │ [ Review the curriculum → ]                │
    └────────────────────────────────────────────┘
    ```
  - Pre-hydration (amended M2): the server renders the C-4.2 default href, but the link is `aria-disabled`, out of the tab order, non-clickable and reads "Loading your progress…" (no arrow while inert) until the store has hydrated (the card carries `data-hydrated="false"`, then `"true"`), so nobody follows a wrong default. Until then the h2 and meta line are skeleton bars of the same height (the default lesson's title is not rendered, so it cannot flash before a different last-viewed lesson). Once hydrated the link reads `Continue: <title>` and shows its arrow. After mount, if `lastViewed` points elsewhere, the link text and `href` swap in place (same box, no CLS). Level progress uses skeletons (§4.7). No "0 / 3" flash.
  - Last-viewed lesson no longer exists (P-4): fall back to the C-4.2 default silently.
  - No curriculum seeded: the whole levels area and the Continue card are replaced by one EmptyState: "No lessons seeded yet. Run `npm run seed`." (§7).
  - News: no digest → the news column shows a compact EmptyState whose title is the PRD string verbatim, "No news yet. Run `npm run news:run`.", and it does **not** block the page. Stale → the header reads "Latest · Tue 29 Sep" with a warning Badge showing an `AlertTriangle` icon and the text "Stale" (never the word "today"; icon plus word per C-5). Nothing ≥60 → "Nothing above the relevance bar today" plus a link to the archive. The "See all" link (N-6) goes to `/news` in every state.
  - DB down → the app-wide error page (§6.10).
  - Loading: the Suspense fallback (`HomeSkeleton`) shows skeletons whose heights equal the loaded Continue card, level cards (list at 360, 2 cols at md, 3 at lg) and 3 news rows at each width, so the page height does not change on swap.

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

- Level section: `section[aria-labelledby="level-n-eyebrow level-n-title"][id=level-n]`, so its accessible name is "Level n Foundations: …" (§11), with the eyebrow "Level n", the `h2` title, the summary in `text-fg-muted`, and a progress row showing "2 / 4" text, a `ProgressBar md` and, when complete, a success Badge "Completed".
- Lesson list: `<ol>` inside a `Card` (`bg-surface`, rows separated by `border-subtle`). Each row is a stretched link: `h3 > a` (`text-lg font-bold`), then the objective (`text-base text-fg`, clamped to 2 lines at 360 with `line-clamp-2`, and full at lg), then a meta row (`text-sm text-fg-muted`: "15 min · Verified 12 Sep 2026 · Claude Code v2.3 / Codex v0.9", wrapping allowed). The state badge sits top-right at lg and in the meta row at 360.
- Completion state per row: `success` Badge "Completed" or **nothing** for not started. Don't show a "Not started" badge; its absence is the state, and it avoids visual noise across 18 rows. The number prefix ("1.1") sits **outside** the `<a>` (in a preceding `<span>`), so the link name is exactly `<title>` (§11). The prefix is in `text-fg-muted tabular-nums`.
- "May be outdated" (C-5): `warning` Badge, shown when `last_verified_on` is more than 60 days before today. It has a `title` attribute plus visible text, and the meta line keeps the actual date so the badge is explained.
- Jump links at 360: a horizontal row of 5 `accent` badges-as-links (`h-11` touch). At lg this becomes the sticky left rail "On this page" with per-level counts.
- **States**
  - Empty: EmptyState "No lessons seeded yet. Run `npm run seed`." with `CommandLine npm run seed`.
  - Loading: 2 level sections of skeletons (eyebrow, title, bar, 3 rows each) at the real heights.
  - Error: route `error.tsx` (§6.10), with "Try again".
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

- **Header**: breadcrumb `nav[aria-label=Breadcrumb]`; eyebrow "Lesson 2.1"; `h1`; objective `text-lg text-fg`; meta line; then the status and actions row, with the completion Badge (after mount) and the bookmark toggle button (`ghost sm`, `aria-pressed`, fixed label "Bookmark" with an outline or filled icon, L-8). "May be outdated" appears here too (C-5).
- **Section headings**: "Concept" (`h2 id=concept`), "In your tool" (`h2 id=tools`, which gives the tabs a heading), "Key differences" (`h2 id=differences`, rendered inside the callout), "Exercise" (`h2 id=exercise`).
- **Key differences callout** (L-3): `section[aria-labelledby=differences]` (a `region` named "Key differences"; not `aside`, which would be `complementary`), `rounded-card bg-accent-soft border-l-4 border-link p-5`, with an `h2` at `text-xl` and a `<ul>` of 1–5 items (`text-prose`). It sits **outside and after** the tabs and is always visible.
- **Right rail** (lg+): "On this lesson" anchor list, sticky at `top-[76px]`. It links to the four `h2` ids and highlights nothing (no scroll-spy in v1). Hidden below lg.
- **Mark complete block** (L-5): `Card` with the text "Done with this lesson?" and a `primary` button "Mark complete". After clicking, the control area renders the PRD string **verbatim as one visible line: `Completed ✓ · Undo`**. Structure: `<span class="text-success font-bold">Completed ✓</span><span aria-hidden="true"> · </span><button type="button">Undo</button>`, so the visible text is exactly "Completed ✓ · Undo" and the only button is named "Undo". Also `announce("Lesson marked complete")`. Focus moves to the "Undo" button (the clicked node unmounts, so set it explicitly). Undo removes the entry, restores the "Mark complete" button, moves focus to it, and announces "Marked not complete". Pre-hydration, the button is disabled and labelled "Mark complete", with no state claimed.
  - Test note: PR #2 line "after: `getByRole('button', { name: /Completed ✓/ })`" must change to `getByText('Completed ✓ · Undo')` plus `getByRole('button', { name: 'Undo' })`. There is no button named "Completed ✓".
- **Prev/next** (L-6): `nav[aria-label="Lesson"]`, two `Link`s showing the direction label plus the lesson number and title. At 360 they stack full-width (44px+). At the last L5 lesson, "Next" becomes "Back to curriculum →".
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
│ ▸ Compare with reference solution   ← disclosure button, collapsed        │
│     Solution: exercises/ex-2-1-conventions/solution                       │
│     ┌ Terminal ──── [⧉ Copy] ┐ git diff --no-index …starter …solution      │
│     What the reference solution does differently: • … • …                 │
└───────────────────────────────────────────────────────────────────────────┘
```

- Numbered sub-steps (`h4`) turn the panel into a scannable procedure. The Copy buttons are the most prominent controls.
- The starting prompt is shown in a CodeBlock with the label "Prompt", which is copyable and wraps. **Exception to no-wrap:** prompt blocks use `whitespace-pre-wrap` because they are prose.
- Compare disclosure (E-3): **a `button[aria-expanded][aria-controls]` disclosure, not `<details>`** (Playwright does not expose `<summary>` as a button). Button name "Compare with reference solution", styled `h-11 inline-flex items-center gap-2 font-medium text-link`, with a chevron that rotates 90° (`transition-transform`, disabled under reduced motion). The controlled panel has the `hidden` attribute while collapsed. Collapsed by default.
- The whole panel is `section[aria-labelledby="exercise exercise-title"]`, so its region name starts with "Exercise" (§11).
- "Exercise complete" (E-2) appears in the checklist header only. It never marks the lesson complete, and the Mark complete block stays separate below the panel.
- Checklist item IDs that aren't in the content are ignored (§9 of the PRD).

#### 6.3.2 Watch block (PRD §15, MD-1, MD-2, MD-3)

**Purpose.** This block plays a short, silent animation or terminal recording inside the Concept section. It adds to the lesson text and never replaces it, so it is visually quieter than the Key differences callout and the Exercise panel. It is a server component with no client JS.

**Placement (MD-1).** The block goes inside `section[aria-labelledby=concept]`, after the concept prose and before the "In your tool" `h2`. The L-1 order, the four `h2` ids and the right rail stay as they are. The rail gets no "Watch" entry.

```
360 (column 328)                            1440 (lg:col-span-8, column ≈ 740)
┌──────────────────────────────────────┐    ┌───────────────────────────────────────────────────┐
│ Concept                        (h2)  │    │ Concept                                     (h2)  │
│ prose…                               │    │ prose…                                            │
│                         ↕ mt-8       │    │                                     ↕ mt-8        │
│ WATCH                        eyebrow │    │ WATCH                                    eyebrow  │
│ Three agents, three          (h3)    │    │ Three agents, three worktrees             (h3)    │
│ worktrees                            │    │ ▣ Animation · 1:12 · No sound            (meta)   │
│ ▣ Animation · 1:12 · No sound (meta) │    │ ┌───────────────────────────────────────────────┐ │
│ ┌──────────────────────────────────┐ │    │ │                                               │ │
│ │          poster (16:9)           │ │    │ │              poster (16:9, w-full)            │ │
│ │   ▶ 0:00 ───────────── 🔇 ⛶ ⋮    │ │    │ │                                               │ │
│ └──────────────────────────────────┘ │    │ │ ▶ 0:00 ─────────────────────────────── 🔇 ⛶ ⋮ │ │
│ › Transcript                 (h-11)  │    │ └───────────────────────────────────────────────┘ │
│                         ↕ space-y-10 │    │ › Transcript                                      │
│ WATCH …second item…                  │    │                                                   │
│                                      │    │ In your tool                                (h2)  │
│ In your tool                   (h2)  │    └───────────────────────────────────────────────────┘
└──────────────────────────────────────┘

Transcript open:
│ ⌄ Transcript                                      │
│ ┌ bg-surface rounded-lg p-4 ─────────────────────┐ │
│ │ Three columns appear, labelled with branches…  │ │
│ │ (plain text, line breaks kept)                 │ │
│ └────────────────────────────────────────────────┘ │
```

**Anatomy (top to bottom, per item)**

- **Wrapper:** a single `div` around all items, `mt-8 space-y-10`, with no background and no card. The video is already a framed object, so a surface card around it would be a frame inside a frame. Dropping the card also gives the video the full column width, which the captions need at 360.
- **Item:** `section[aria-labelledby="watch-<id>"]` with `data-testid="media-block"`, which is a `region` named "Watch: \<title\>".
- **Heading (`h3`, MD-1):** `<h3 id="watch-<id>" aria-label="Watch: {title}"><span aria-hidden="true" class="block text-sm font-bold uppercase tracking-eyebrow text-link">Watch</span><span class="mt-1 block text-lg md:text-xl font-bold text-fg-strong">{title}</span></h3>`.
  - **V3: use this exact markup.** The explicit `aria-label` is the source of the name. Do not build it from the spans: two block spans plus an sr-only ": " compute as "Watch : \<title\>" in Chrome, with a space before the colon (PR #27 review). The eyebrow is `aria-hidden`, so it is never read twice.
  - The region (`section[aria-labelledby="watch-<id>"]`) and the video (`aria-labelledby="watch-<id>"`) both resolve to the h3's `aria-label`, so all three names are exactly `Watch: <title>`.
  - The eyebrow has the same look as "EXERCISE" and "LESSON 2.1".
- **Meta line:** `mt-1 flex flex-wrap items-center gap-x-2 text-sm text-fg-muted`. The kind word is always shown, so the kind is never carried by the icon alone:
  - Animation: a 14px `Clapperboard` icon (`aria-hidden`), then "Animation · `<time datetime="PT72S">1:12</time>` · No sound".
  - Recording: a 14px `SquareTerminal` icon, then "Terminal recording · 0:42 · No sound · Claude Code 2.1.277 / Codex 0.154.0 · Recorded 1 Oct 2026". The versions come from the manifest's `tool_versions` and the date from `made_on`, formatted "d MMM yyyy". Show only the tools the item has.
  - The duration is `m:ss` from `duration_s`.
  - "No sound" is there because every item has no audio track (MD-2). Without it, people hunt for a volume control that does nothing.
- **Frame:** the `<video>` itself, at `mt-3 block w-full h-auto rounded-xl border border-border bg-code-bg`, with `style="aspect-ratio: <width> / <height>"` and the `width`/`height` attributes from the manifest. That reserves the box, so CLS is 0.
  - `bg-code-bg` (`#0f1729` light, `#0b0f1c` dark) is what shows before the poster paints. It matches the native controls' dark scrim and the terminal-recording theme, so there's no white flash.
  - The `border-border` edge keeps a light poster from bleeding into the canvas in light mode. In dark mode it keeps the light-only posters (§15.4 has no dark variants) from floating.
  - The radius is `rounded-xl` (12px, the same as CodeBlock), not `rounded-card`.
- **Player (MD-2):** `<video controls preload="none" playsInline poster src width height aria-labelledby="watch-<id>">`, plus `<track kind="captions" srclang="en" label="English" src default>`.
  - There is no `autoplay`, no `muted` autoplay trick, no `loop`, and no JS `play()`.
  - The controls are native, with no overlay, custom play button or hover preview.
- **Captions:** they are on by default because of `default`. In `globals.css` (WS-A), add `[data-testid="media-block"] video::cue { font-family: var(--font-sans); background: rgb(0 0 0 / .8); }`, and below `md` add `font-size: 15px`.
  - Chromium sizes cues at about 5% of the video height. On a 328px-wide frame that's about 9px, which is illegible (PRD §15.6 gate 2).
  - From `md` up the default size (19px or more) stands.
- **Transcript (MD-2):** a `<details class="group mt-2">` that is closed by default (`group` drives the chevron via `group-open:`).
  - The summary is `<summary id="watch-<id>-transcript-toggle" class="inline-flex h-11 cursor-pointer list-none items-center gap-2 rounded-md font-medium text-link hover:underline [&::-webkit-details-marker]:hidden">`. It holds a 16px `ChevronRight` (`aria-hidden`, `transition-transform`, `rotate-90` when open via `group-open:`, and static under reduced motion), then "Transcript", then `<span class="sr-only"> for {title}</span>`.
    - The summary is styled like the Compare disclosure (§6.3.1), so the two disclosures on a lesson page look alike.
    - The visible label is "Transcript", as the PRD requires.
    - The accessible name is "Transcript for \<title\>", so it stays unique when items stack (2.5.3: it starts with the visible text).
  - The panel is `<div role="region" aria-labelledby="watch-<id>-transcript-toggle" class="mt-2 rounded-lg bg-surface p-4 text-base text-fg whitespace-pre-line dark:border dark:border-border">`.
    - It renders the `.txt` as plain text and never as markdown or HTML (L-7). Line breaks are kept and runs of spaces collapse.
    - The transcript describes what is on screen (WCAG 1.2.1). The design doesn't truncate it.
- **The `<details>` exception:** §11's rule that disclosures are always `button[aria-expanded]` has two named exceptions: this transcript and "Diagram as text" (§6.3.3, PRD §17).
  - MD-2 names the element.
  - The block ships no JS.
  - `<details>` opens on find-in-page, which helps a transcript.
  - Tests locate it with `region.locator('summary')` rather than `getByRole('button')`.

**Multiple items.** Items render in `id` order, each with its own heading, meta, frame and transcript, separated by `space-y-10`. There are no dividers and no "1 of 2" counters, because the eyebrow repeats and that is enough rhythm.

**Spacing summary.**

| From → to | Value |
|---|---|
| Last concept paragraph → block | `mt-8` |
| Eyebrow → title | `mt-1` |
| Title → meta | `mt-1` |
| Meta → frame | `mt-3` |
| Frame → summary | `mt-2` (the 44px summary carries its own air) |
| Summary → open panel | `mt-2` |
| Item → item | `space-y-10` |
| Block → "In your tool" | the existing section rule (`mt-10`) |

**Responsive.** The frame is always `w-full` of the lesson column, and the height follows the ratio.

| Width | Column | 16:9 frame |
|---|---|---|
| 360 | 328px | 328 × 185 |
| 768 | 720px | 720 × 405 |
| 1440 | about 740px (`lg:col-span-8`) | about 740 × 416 |

The meta line wraps at 360, which is allowed. There is no horizontal scroll at any width.

**Focus and keyboard.**
- The tab order is the video (Space/Enter plays it and the native control keys work), then the native controls in browsers that expose them, then the summary (Enter/Space toggles it).
- The video gets `focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-focus focus-visible:outline-offset-2`. The ring sits on the canvas outside the dark frame, so accent passes. `outline-solid` is required (TW4, §4.0).
- The summary gets the same ring with `rounded-md`.
- Nothing moves focus programmatically.

**Motion.**
- Nothing plays until the user presses play, under either `prefers-reduced-motion` setting (MD-2, asserted in both emulations).
- The poster is a still frame.
- The only UI motion is the chevron rotation (`--fm-duration-base`), which drops to 0 under reduced motion.

**Light and dark.**
- Every colour is a token: `text-link` eyebrow, `text-fg-strong` title, `text-fg-muted` meta, `border-border` and `bg-code-bg` frame, `bg-surface` transcript panel (with a border in dark), and `text-link` summary. Each pair is already in the §2.4 ledger.
- Accent-2 is never used for text.
- Text inside rendered frames is the media gate's concern (§15.6 gate 2): Remotion uses ink, accent and Satoshi, and VHS uses a theme close to the CodeBlock palette (`#0f1729` / `#e6edf3`).

**States.**
- **No media (MD-1):** render nothing. That means no wrapper, no heading, no "No video for this lesson" EmptyState and no spacing artefact. A lesson without media is the normal case (13 of 18 lessons), not an empty state.
- **Some items invalid (MD-3):** they are skipped silently in the UI (the server logs them), and the remaining items render. If all of them are invalid, it's the same as no media.
- **Before the poster loads:** the reserved `bg-code-bg` frame with native controls.
- **Playback error** (file gone after render, network): the browser's native error state. The heading, meta and transcript stay, so the content is still available as text.
- **Loading:** media is read in the same server request as the lesson, so there is no separate skeleton. The lesson `loading.tsx` skeleton doesn't change, because adding a video placeholder to all 18 lessons would be wrong for 13 of them.

**Deltas vs PR #26** (`media/v3-watch` at 46d7bec; V3 conforms to this section):
1. Remove the per-item `bg-surface rounded-card p-4 md:p-5 my-8` card, and use one `mt-8 space-y-10` wrapper. The frame-in-frame goes, and the video gains 32px at 360.
2. Make the `h3` an `aria-hidden` eyebrow "Watch" plus the title (`text-lg md:text-xl`), named by `aria-label="Watch: <title>"`. #26 has a single `text-lg` line.
3. Add the meta line: the kind word plus icon, `<time>` duration, "No sound", and for recordings the versions and recorded date. #26 shows none.
4. Change the frame to `rounded-xl border border-border bg-code-bg`, not `rounded-card bg-canvas` (that showed a white box before the poster). Add `aria-labelledby` to the video.
5. Add the `::cue` font floor (15px below md) and the Satoshi family.
6. Make the summary match the Compare disclosure: `h-11`, `font-medium` at body size, a rotating chevron and a hidden marker, with the sr-only " for \<title\>". #26 has 14px text, a 24px target and no open/closed indicator.
7. Put the transcript in a `role=region` panel labelled by the summary (`bg-surface rounded-lg p-4`, `whitespace-pre-line`). #26 has a bare paragraph.

#### 6.3.3 Diagram (PRD §17, DG-1 to DG-11)

**Purpose.** A diagram is a static, server-rendered drawing that makes one claim about a structure the prose is describing: a loop, a ladder, what sits inside what, or who does what when. It adds to the text and never replaces it. It has no client JS and nothing in it moves. There are four templates (`flow`, `stack`, `boundary`, `lanes`). Their geometry is fixed by this section, so an author can change only words and counts.

**This section is the source of truth for every number G1's layout module uses.** `checkLabelsFit` (PRD §17.3) measures the label boxes defined here with `estimateTextWidth(text, px)` (about 0.55em per character plus 15% slack, so 8.855px per character at 14px and 7.59px at 12px). If the drawing and the check ever disagree, the drawing is wrong.

##### Deltas vs PRD §17 (the coordinator applies these to the PRD and to G0)

The PRD's numbers came from the audit's first pass. Measuring the real columns changed four of them.

1. **Horizontal viewBox width: 576, not 640.** PRD §17.5 assumes "at md+ the column is at least 672px". At 1024 that is false. The lesson column is `lg:col-span-8` of 960px, which is **629px**. Less the 1px figure border and `md:p-6`, that leaves 579. In a workflow's "Why it works" callout the figure band is 625px wide, which leaves 577 (see Workflow placement below). 640 would scale every label to 0.91 there, so 12px text would render at 10.9px. At 576 the horizontal SVG never scales below 1.0 anywhere from 768 up. DG-2's "at 768px the horizontal SVG renders at least 640px wide" becomes "at 768 **and 1024**, at least 576".
2. **Vertical viewBox width: 280, not 296.** At 360 the lesson column is 328. Less the 2px border and `p-4` (32), that leaves 294. The workflow band leaves 292 (324 − 32). 280 fits both with no downscale. The container cap becomes **`max-w-[336px]`, not 420**, which is 1.2×. At 420 the labels would render at 21px on a tablet, larger than the 17px prose they summarise.
3. **The flow exit `text` is one line of at most 20 characters, not the 2×24 `label` (G0 contract change).** In the vertical layout an exit box is indented 32px from the spine (below). With two loop lanes the box is 216 wide, and its 196px label box can't hold a 24-character line (213px estimated). 20 characters is 177px.
4. **DG-3's cap-maximum fixture asserts no *width* issues, in both orientations.** Height is a budget, not a guarantee. Six steps at 2 lines plus a sub-line (78px each), with every gap labelled, is about 780px tall vertically, which no 560 cap allows. The geometry guarantees that every label fits its box at any valid length, through the fit-or-stack rule below. Height is checked by two more fixtures: one that sits exactly at 560 and returns no issues, and one 1px over that returns exactly one height issue.
5. **Name vs description (clarifies DG-4).** The SVG's accessible **name** is the title (`aria-labelledby` → `<title>`), and its **description** is the summary (`aria-describedby` → `<desc>`). Putting both ids in `aria-labelledby` would make the name "<title> <summary>". That breaks `getByRole('img', { name: '<title>' })` in DG-2 and makes the screen reader repeat the figcaption.

##### Frame and anatomy

```
360 (lesson column 328)                      1440 (lesson column ≈ 733)
┌ figure  rounded-card border bg-surface ┐   ┌ figure ────────────────────────────────────────────┐
│ p-4                                    │   │ p-6                                                │
│ The edit, approve, verify loop  (title)│   │ The edit, approve, verify loop              (title)│
│ Give the agent a check it can run, and │   │ Give the agent a check it can run, and it loops    │
│ it loops on its own failures. (summary)│   │ on its own failures.                      (summary)│
│                              ↕ mt-4    │   │                                     ↕ mt-4         │
│   ┌ vertical SVG, 280 → ≤336 wide ┐    │   │    ┌ horizontal SVG, 576 wide, mx-auto ────────┐   │
│   │ …                             │    │   │    │ …                                         │   │
│   └───────────────────────────────┘    │   │    └───────────────────────────────────────────┘   │
│                              ↕ mt-4    │   │                                     ↕ mt-4         │
│ › Diagram as text             (h-11)   │   │ › Diagram as text                                  │
└────────────────────────────────────────┘   └────────────────────────────────────────────────────┘
```

- **Figure:** `<figure data-testid="diagram" class="my-8 rounded-card border border-border bg-surface p-4 md:p-6">`, the full lesson column wide. Code blocks use the full column too, while prose is held to the 700px measure. The figure's own `bg-surface` frame is right here, unlike the frameless Watch block: the drawing is a set of shapes on a ground, and the ground has to be a known token so that every pair in the ledger holds.
- **Figcaption, first child:** the claim comes before the picture, so the drawing reads as evidence for it.
  - `<figcaption class="min-w-0">`
  - title: `<span class="block text-base font-bold text-fg-strong">`
  - summary: `<span class="mt-1 block text-sm text-fg-muted">`
  - The figcaption is not a heading, so it adds no `h3` (L-1 and the right rail don't change). The figure's accessible name is the figcaption text.
- **Drawings:**
  - `<div class="mt-4">` holds two SVGs:
    - `<svg … class="hidden md:block print:block mx-auto h-auto w-full max-w-[576px]">` (horizontal)
    - `<svg … class="md:hidden print:hidden mx-auto h-auto w-full max-w-[336px]">` (vertical)
  - Each SVG carries the `viewBox`, `width` and `height` attributes from the layout, so the box is reserved and CLS is 0.
  - `display:none` takes the hidden one out of the accessibility tree.
  - Print always gets the horizontal one.
  - The horizontal SVG sits on a 576px track, so it never upscales. The vertical one may grow to 1.2× (labels up to 16.8px).
- **"Diagram as text":** a `<details class="group mt-4">`. Its summary and panel are specified below.
- **Spacing:** prose → figure `my-8`; figcaption → drawing `mt-4`; drawing → summary `mt-4`; summary → open panel `mt-2`.

##### Shared geometry (user units = CSS px at scale 1)

| Constant | Value | Notes |
|---|---|---|
| `H_W` / `V_W` | 576 / 280 | viewBox widths (Deltas 1 and 2) |
| `MAX_H` | 560 | viewBox height cap, in each orientation |
| Label type | 14px, 500 (700 when emphasised), line box 20, baseline at line top + 15 | `fill-fg`. Measured at 14. Bold is about 4% wider than Medium and sits inside the 15% slack. The DG-3 browser cross-check must put `emphasis` on a 24-character label. |
| Small type | 12px, line box 16, baseline at line top + 12 | `sub` (400, `fill-fg-muted`), edge/axis/legend labels (500, `fill-fg-muted`), zone and lane captions and the lane eyebrow (700, `fill-fg-muted`). Measured at 12. Sentence case only: no `uppercase` and no tracking, because the estimate doesn't model caps. |
| Node | `padX 10`, `padY 10`, `rx 12`, min width 96 | `fill-surface-raised stroke-control-border`, 1px |
| Node height | `20 + 20·lines + (sub ? 18 : 0)` | 1 line 40; 2 lines 60; 1 line + sub 58; 2 lines + sub 78 (the sub-line is a 2px gap plus 16) |
| Label box | node width − 20 | Every label line (at 14) and the `sub` (at 12) must fit. The text is left-aligned at node x + 10. |
| Content width | `max(96, ceil(max line estimate) + 20)` | Used wherever a template sizes nodes to their content |
| Edge | 1.5px `stroke-fg-muted`, orthogonal segments only, corners `stroke-linejoin="round"` | No diagonals and no curves |
| Arrowhead | `<marker id="diagram-<id>-<h\|v>-arrow">`, path `M0 0 L8 4 L0 8 Z`, `refX 8 refY 4`, `markerUnits="userSpaceOnUse"`, 8×8, `fill-fg-muted` | One definition per colour per SVG. Ids are suffixed, so the two SVGs never collide. |
| ✕ end-cap | `<marker …-x>`, two 1.5px lines `M0 0 L8 8 M8 0 L0 8`, `stroke-danger`, centred on the path end | Drawn as a path. The "✕" glyph is never used, because Satoshi has none. The risk path stops 6px short of its target. |
| Edge-label halo | `paint-order="stroke"`, `stroke-surface`, `stroke-width 4`, `stroke-linejoin round` | Applied wherever a label could cross a line |
| Badge | circle `r 9`, `fill-surface-raised stroke-fg-muted` 1px; numeral 12/700 `fill-fg`, `text-anchor middle`, baseline at cy + 4 | Numbers crossings and handoffs (below) |
| Legend | Starts 16 below the body. Each entry is a badge, then 6px, then text (12/500 `fill-fg-muted`). | Horizontal: entries flow inline with a 16 gap, wrapped greedily into rows of height 20. Vertical: one entry per row, with the text word-wrapped to `W − 24` (rows of 16). The legend wraps rather than truncating, so it can never fail fit. |

**The fit-or-stack rule.**
- `flow`, `boundary` and `lanes` each have a preferred horizontal arrangement: a row, columns, or a grid.
- The layout tries that arrangement at 576. If any label box is too small, if the row is too wide, or if exit boxes or badges can't be placed without overlapping, the **horizontal SVG uses the stacked (vertical) geometry instead**. Its viewBox is then 280 wide, and its class keeps `max-w-[336px]`.
- So a label that fits its cap always fits a box. That is what Delta 4 relies on.
- The layout returns `mode: "row" | "stacked"` for the horizontal SVG. The lesson seed and `workflows:validate` print a non-failing note ("<path>: diagram <id>: horizontal stacked, labels too wide for a row") so the author knows that shortening a label buys the row form.
- `stack` has one arrangement, used at both widths.

**Connectors that carry labels (crossings and handoffs).**
- Routing a line plus a label between arbitrary boxes is where general layouters spend their complexity, so these connectors use **numbered badge pairs and a legend** instead.
- Each crossing or handoff gets the next number (1–4, in authored order):
  - A badge **straddles the top border of each end** (cy = node top), right-aligned at x = node right − 16. Several badges on one node step left by 22.
  - A legend entry reads `{label}: {from} → {to}`. The `from` and `to` are the node or zone labels, with `\n` read as a space. A handoff with no `label` reads `{from} → {to}`.
- In a horizontal row or grid layout, the connector is **also drawn as a line** when a path with at most one elbow runs only through gaps (never across a node or a caption). Otherwise it is badge-only.
- In the stacked layout, it is always badge-only.
- This is the one place where meaning lives in the legend rather than the picture. The legend is in the SVG, so it is visible. The "Diagram as text" list repeats it.

##### Emphasis and risk (never colour alone, DG-5)

| Element | Default | Emphasis (`emphasis: true`, ≤ 1 per diagram) | Risk (`style: risk`) |
|---|---|---|---|
| Node | `fill-surface-raised stroke-control-border`, 1px, label 500 | `fill-accent-soft stroke-link`, **2px**, label **700** | (only exits and markers carry `risk`) |
| Exit box | as a node | — | `stroke-danger` 1.5px, **dashed `6 4`**, label 500 `fill-fg` |
| Edge, exit connector, crossing, handoff line | 1.5px `stroke-fg-muted`, solid, arrowhead | — | 1.5px `stroke-danger`, **dashed `6 4`**, **✕ end-cap** instead of the arrowhead, label `fill-danger` |
| Badge | `stroke-fg-muted` 1px, solid | — | `stroke-danger` 1.5px, **dashed `3 2`** |
| Legend entry | badge + text | — | badge, then a 10×10 ✕ path, 4px, then text in `fill-danger` |
| Lanes marker | 1.5px `stroke-fg-muted`, solid, label `fill-fg-muted` | — | dashed `6 4` `stroke-danger`, a ✕ at the start, label `fill-danger` |

- Emphasis has three cues: stroke weight (1 → 2), type weight (500 → 700) and fill. Risk has three: the dash, the ✕ shape and the label's words. **Authoring rule (PRD §17.4): a risk label names the risk in words** ("injected instructions", not "path 2").
- Colour is the third cue in both cases, never the first.
- The text alternative adds the spoken "(key)" and "(risk)".

##### `flow`

```
Horizontal, row form (fits 576)                                   Vertical / stacked (280)
                ┌ Full re-gate ┐  exit box, h 40                   ┌ Ask ─────────────────────┐
                └──────┬───────┘                                  └┬─────────────────────────┘ ┆
             ✕ "no" ┆  ↕ 40 (label at connector x + 6)              │ spine x = 24           ┆ loop
┌ Ask ┐ 40 ┌ Edit ─┐ "if green" ┌ Approve ┐ ──→ ┌▣ Verify ┐          ▼                        ┆ lanes,
│     │ ─→ │       │ ─────────→ │         │     │ (2px)   │        ┌ Edit ────────────────────┐ ┆ 16 each
└─────┘    └───▲───┘            └─────────┘     └────┬────┘        └┬─────────────────────────┘ ┆
               │   16                                │              │ "if green"   (x = 36)   ┆
               └────────────── fails ────────────────┘  lane 36     ▼                         ┆
```

**Row form (horizontal).**
- **Nodes.** One row, content-width, vertically centred on the row's centre line. The row height is the tallest node's height.
- **Gaps.** `gap_i = 40`, or `est(next_i, 12) + 16` when step *i* has `next`.
- **Arrows.** Each arrow runs at the row centre line from node *i*'s right edge to node *i+1*'s left edge. The `next` label is centred over the arrow, with its baseline 6 above the line. Its label box is `gap_i − 16`.
- **Fits when** `Σ widths + Σ gaps ≤ 576`.
- **Loops (≤ 2), below the row.**
  - Loop *k* runs in lane `y_k = row bottom + 16 + 36k`.
  - Path: `M (src.cx + 6k, src.bottom) V y_k H (tgt.cx − 6k) V tgt.bottom`, with the arrowhead pointing up into the target.
  - A self-loop (`to == from`) leaves at `cx + 16` and returns at `cx − 16`.
  - The label is centred on the lane's horizontal span, with its baseline at `y_k + 16`, clamped to [0, 576]. Its label box is the full 576.
  - Loop band height: `16 + 36·loops`.
- **Exits (≤ 2), above the row.**
  - Exit box: content-width, height 40, centred over its source's `cx`, then pushed right to keep a 16px gap and clamped to [0, 576 − w]. If they still overlap, use the stacked form.
  - The connector runs from `src.top` up to `box.bottom`, with an elbow at mid-gap if the box moved. The gap is 40.
  - The exit label is left-aligned at connector x + 6, with its baseline at `box.bottom + 24`. Its label box runs from there to the next exit's connector, or to 576.
  - Exit band height: `40 + 40`.
- **Height.** Exit band + row + loop band.

**Stacked form (vertical, and the horizontal fallback).**
- **Nodes.** Full width `W_node = 280 − 16·loops`. Each node's label box is `W_node − 20`, so 228 even with two loops.
- **Spine.** Arrows run down the spine at `x = 24`. Each arrow goes from a node's bottom to the next node's top, with the arrowhead touching the top.
- **The gap below step *i*.**
  - Height: `max(32, 16 + 16·n)`, where *n* is the number of label lines in the gap.
  - Line order: the `next` label (left-aligned at x = 36), then any loop labels for loops leaving step *i* (right-aligned to `W_node`). Each label box is `W_node − 36`.
- **Exits from step *i*.**
  - They follow that gap. The exit label sits on its own gap line at x = 40.
  - The exit box is at `x = 32` and `W_node − 32` wide, with height 40 (label box `W_node − 52`, at least 196 → Delta 3).
  - A branch leaves the spine at the box's mid-y and runs right to the box (arrowhead or ✕).
  - The spine continues down past the box by 16 to the next step.
- **Loops (≤ 2), on the right.**
  - Loop *k* runs in lane `x_k = W_node + 8 + 16k`.
  - It leaves the source's right edge at `top + 20`, runs right to `x_k`, then vertically to the target's `top + 20` (+6 per extra loop on the same node), then left with the arrowhead into the target's right edge.
  - A self-loop leaves at `top + 14` and returns at `bottom − 14`.

##### `stack`

```
Same arrangement at 576 and 280 (layers full width)
  Strongest            axis.high (12/500, x 0)
↑ ┌ Hooks ─────────────── (key, 2px) ┐
│ │ run every time the event fires  │   gap 8
│ ├ Skills ─────────────────────────┤
│ ├ Instructions ───────────────────┤
│ └─────────────────────────────────┘
  Advisory             axis.low
```

- **Axis.** The axis line is `x = 10`, from the bottom of the lowest layer to the top of the highest, 1.5px `stroke-fg-muted`, with the arrowhead pointing up.
- **Axis labels.** `axis.high` sits in a 20-high band above, left-aligned at x 0, baseline 12. `axis.low` sits in a 20-high band below. Each label box is `W`.
- **Layers.** They run from x 24 to W, so they are 552 / 256 wide (label boxes 532 / 236). They are stacked bottom-up in authored order (the first layer at the bottom) with an 8px gap.
- **Height.** `40 + Σh + 8(n − 1)`. Five 78-high layers make 462.

##### `boundary`

```
Horizontal, columns form (t top-level zones)                 Vertical / stacked
┌ Your machine ──────────────┐ 40 ┌ Remote ────────┐          ┌ Your machine ──────────┐
│ ┌ Agent ─────────────①┐    │    │ ┌ MCP server ─②┐│          │ ┌ Agent ───────── ①② ┐ │
│ └─────────────────────┘    │ ←①─┤ └──────────────┘│          │ └────────────────────┘ │
│ ┌ stdio server ───────┐    │ ┆② │ ┌ Web page ─①┐  │          └────────────────────────┘  gap 16
│ └─────────────────────┘    │ ┆✕ │ └────────────┘  │          ┌ Remote ────────────────┐
└────────────────────────────┘    └─────────────────┘          │ ┌ Web page ────── ① ─┐ │
① Tool results: Web page → Agent    ② ✕ Injected instructions… └────────────────────────┘
                                                                ① Tool results: Web page → Agent
```

- **Zones.** A zone is a rect with `rx 12`, no fill (the figure ground shows through) and a 1px solid `stroke-control-border`. Its caption is 12/700 `fill-fg-muted` at x + 10, with its baseline at y + 22, and has a 16 + 12 band, so a badge straddling the first item's top border clears the caption. Zone padding is 10.
- **Items.** Items are nodes stacked inside a zone with a **12px** gap (badges straddle the top edge by 9), each the zone's inner width.
- **Zone captions** must fit `zone width − 20`.
- **Columns form.**
  - The *t* top-level zones become equal-width, equal-height columns with a 40px gap: `w = (576 − 40(t − 1)) / t`, so 576, 268 or 165.
  - A nested zone (one level) sits inside its parent, below the parent's items, inset 10.
  - When `t == 1` and the parent has a nested zone, the parent's items and the nested zone become two sub-columns, 258 each with a 40px gap.
  - Fits when every caption and label box fits. In practice three columns stack unless the labels are about 14 characters or fewer.
  - Crossing lines run across the 40px gaps. Their vertical segments sit at the gap centre, offset −12, −4, +4 or +12 per crossing in that gap.
- **Stacked form.**
  - Top-level zones are stacked full width with a 16px gap.
  - A nested zone sits below its parent's items, inset 10. With W 280 its items are 240 wide (label box 220).
  - Crossings are badge-only.
- **Crossing badges** follow the connector rule. A crossing to a zone puts its badge on the zone's top border, right − 16.
- **Height.** The sum of zone heights and gaps, plus the legend.

##### `lanes`

```
Horizontal, grid form                                        Vertical / stacked: timeline
 Push B   (marker, risk: ✕ dashed)                            ①─┬ Author ───────────────┐
Author    ┌ Commit A ┐       ┆ ┌ Push B ┐                       │ │ Commit A              │
          └──────────┘       ┆ └────────┘                       │ └───────────────────────┘
Reviewer        ┌ Review A ┐ ┆        ┌ Success ┐               ②─┬ Reviewer ─────────────┐
                └──────────┘ ┆        │ refused │               │ │ Review A              │
                             ┆        └─────────┘               │ └───────────────────────┘
Head      ┌ A ┐              ┆ ┌ B: no ┐                       ┄┄✕┄ Push B ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ (marker)
          └───┘              ┆ └───────┘                        ③─┬ Author … Push B …
 col pitch = (576 + 24)/c                                        ▼ time
```

- **Grid form (horizontal).**
  - Columns: *c* is the highest `col` used. Pitch is `(576 + 24) / c`, the box width is `pitch − 24`, and the box x is `(col − 1)·pitch`.
  - Lane rows are stacked in authored order. Each lane has a 28-high caption band above it (12/700 `fill-fg-muted`, x 0, baseline 14, box `576`; the free lower part takes the straddling badges), and the row height is the tallest step in that lane. Rows are 12 apart.
  - Fits when every label box (`box − 20`) fits. With c = 4 that is about 12 characters per line, so the grid form needs short step labels.
  - Each lane is a `g[data-part=lane]` holding its caption and its step nodes.
- **Marker (one at most), in the grid.**
  - A vertical line at `x = (col − 1)·pitch − 12` (the gap before its column), running from the top of the first caption to the bottom of the last row.
  - Its label goes in a 20-high band above everything, left-aligned at line x + 6, or right-aligned ending at line x − 6 if it doesn't fit to the right.
- **Timeline (stacked).**
  - A 28px rail on the left holds one time circle per column used (`r 10` at cx 14, the column number as the numeral, styled like a badge), joined by a 1.5px `stroke-fg-muted` line that ends in an arrowhead pointing down.
  - Step boxes run from x 36 to 280, so they are 244 wide (label box 224).
  - Each box starts with its **lane eyebrow** (the lane label, 12/700 `fill-fg-muted`, then 2px), so its height is node height + 18.
  - Steps that share a column stack 12 apart, in lane order (badges straddle the top border by 9). Column groups are 16 apart. A column's circle lines up with the eyebrow baseline of its first box.
  - Each lane is a `g[data-part=lane]` holding its step nodes, so lanes count the same in both SVGs (DG-1).
- **Marker in the timeline.** A horizontal line across the full width just above its column group, with its label on a 20-high band above it at x 0 (x 14 after a risk ✕).
- **Handoffs.** They follow the connector rule. In the grid form, the line goes from source right edge → gap centre → target left edge, or straight down or up within a column if no box is in the way.

##### Groups and parts (DG-1)

Every drawn element sits in a `g[data-part]`:

| `data-part` | Contains |
|---|---|
| `node` | a step, layer, item or exit box |
| `edge` | a flow arrow |
| `loop` | a loop path and its label |
| `exit` | an exit box, its connector and its label |
| `zone` | a zone rect, its caption and its children |
| `crossing` | its line (if drawn) and both badges |
| `lane` | a lane |
| `handoff` | its line (if drawn) and both badges |
| `marker` | a lanes marker |
| `axis` | the stack axis |
| `legend` | the legend |

- Exits contain their box as a `node`.
- `data-state="key"` goes on the emphasised node's group, and `data-state="risk"` on each risk group. Tests and forced-colours CSS use these hooks. Nothing in the drawing needs the CSS hook to be readable.

##### Token mapping

All colour is token utilities on SVG elements: `fill-*` and `stroke-*`, from the §2 tokens. Dark mode needs nothing further. There is no hex, `rgb()`, `hsl()` or named colour in the markup (DG-5).

| Part | Light / dark via token |
|---|---|
| Figure ground | `bg-surface` |
| Node | `fill-surface-raised stroke-control-border` |
| Emphasised node | `fill-accent-soft stroke-link`, 2px |
| Zone | `fill-none stroke-control-border` |
| Labels | `fill-fg` |
| Sub, edge and axis labels, captions, legend, eyebrow | `fill-fg-muted` |
| Edges, arrowheads, axis, rail, badge rings | `stroke-fg-muted` / `fill-fg-muted` |
| Risk lines, caps, rings and labels | `stroke-danger` / `fill-danger` |
| Halo | `stroke-surface` |

**Forced colours.** Under `@media (forced-colors: active)`, WS-A's `globals.css` adds the rules below, so the result doesn't depend on whether a browser forces SVG paint:
- `[data-testid="diagram"] svg { forced-color-adjust: none }`
- Inside it:
  - `.fill-surface-raised, .fill-accent-soft { fill: Canvas }`
  - `.stroke-control-border, .stroke-fg-muted, .stroke-danger { stroke: CanvasText }`
  - `.fill-fg, .fill-fg-muted, .fill-danger { fill: CanvasText }`
  - `.stroke-link { stroke: Highlight }`
  - `.stroke-surface { stroke: Canvas }`
- Dashes, ✕ caps, stroke widths and bold labels survive, so emphasis and risk stay distinguishable without colour.

##### "Diagram as text" (DG-4)

- **Summary:** the same pattern as the Watch transcript (§6.3.2).
  - `<summary id="diagram-<id>-text-toggle" class="inline-flex h-11 cursor-pointer list-none items-center gap-2 rounded-md font-medium text-link hover:underline [&::-webkit-details-marker]:hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-focus focus-visible:outline-offset-2">`
  - Inside it: a 16px `ChevronRight` (`aria-hidden`, `group-open:rotate-90`, static under reduced motion), then "Diagram as text", then `<span class="sr-only"> for {title}</span>`.
- **Panel:** `<div role="region" aria-labelledby="diagram-<id>-text-toggle" class="mt-2 rounded-lg bg-surface-raised p-4 text-base text-fg dark:border dark:border-border">`. It is closed by default and opens on find-in-page.
- **Content:** every string is generated from the YAML, never authored separately. It is plain React text with no markdown, and `\n` in a label becomes a space. "(key)" and "(risk)" are always spelled out.

| Type | Structure and exact sentence templates |
|---|---|
| flow | `<ol>` of steps: `{label}{sub ? ": " + sub}{key ? " (key)"}`, plus ` Arrow to step {i+1}: {next}.` when `next` is set. Then `<p>` per loop: `From step {i} ({from}) back to step {j} ({to}): {label}.` Then `<p>` per exit: `From step {i} ({from}), exit "{label}": {text}{risk ? " (risk)"}.` |
| stack | `<p>` `Ordered from {axis.low} to {axis.high}.`, then `<ol>` of layers from low to high: `{label}{: sub}{ (key)}` |
| boundary | `<ul>` of zones: `{zone}` with a nested `<ul>` of items (`{label}{: sub}{ (key)}`) and nested zones the same way. Then `<p>` "Crossings:" and an `<ol>` in badge order: `{from} to {to}: {label}{ (risk)}.` |
| lanes | `<p>` `Lanes: {a}, {b}{, c}.`, then `<ol>` in column order, then lane order: `Time {col}, {lane}: {label}{: sub}{ (key)}`. The marker becomes a list item before its column: `Time {col}, event: {label}{ (risk)}`. Then "Handoffs:" and an `<ol>` in badge order: `{from} to {to}{: label}{ (risk)}.` |

##### Accessibility

- **SVG markup:** `<svg role="img" aria-labelledby="diagram-<id>-title-<h|v>" aria-describedby="diagram-<id>-desc-<h|v>" focusable="false">`, with `<title>` = title and `<desc>` = summary as the first children (Delta 5).
- **SVG children:** nothing is focusable. There are no links, no `tabindex`, no `<a>` and no `<foreignObject>`. Children of `role="img"` are presentational.
- **Tab order:** content before the figure → the "Diagram as text" summary → content after. Nothing moves focus.
- **Motion:** none. Only the chevron rotates (`--fm-duration-base`, 0 under reduced motion).
- **Zoom:** labels are real `<text>`, so they scale with page zoom and stay selectable and findable.
- **The `<details>` exception** (§11) now has two named cases: the Watch transcript and "Diagram as text". The kit ships no JS, so a button disclosure isn't available.

##### Workflow placement (DG-10, DG-11; resolves Q-DG1)

```
│ ┃ Why it works                              (h2, inside the §6.12 callout)       │
│ ┃──────────────────────────────────────────────────────────────── band ──────────│
│ ┃ Patch-id re-attest                                                              │
│ ┃ A rebase that changes nothing re-uses its gates; anything else re-gates.        │
│ ┃            [ horizontal SVG, 576 ]                                              │
│ ┃ › Diagram as text                                                               │
│ ┃─────────────────────────────────────────────────────────────────────────────────│
│ ┃ ▣ Watch: Gated merge pipelines (Lesson 5.3) →                     (watch line)  │
│ ┃ prose…                                                                          │
```

- **Order inside "Why it works":** `h2` → diagram → `watch` line → prose. All of it sits outside the tool tabs.
- **The figure is a band, not a card in a card.** Inside the `bg-accent-soft border-l-4 p-5` callout, the figure is `-mx-5 my-4 border-y border-border bg-surface px-4 py-4 md:px-6 md:py-6`, with no radius and no side borders. It runs edge to edge between the callout's link border and its right edge.
  - **Why not inline on the callout:** `control-border` on `accent-soft` is 2.81:1 in light, which fails the 3:1 node-boundary rule.
  - **Why not a nested card:** a nested card would leave 551px at 1024 and 250px at 360.
  - **What the band gives:** 577 at 1024, 668 at 768 and 292 at 360, all with no downscale.
  - Everything else (figcaption, two SVGs, details) is the same as in a lesson.
- **The `watch` line goes in "Why it works", not the "At a glance" rail.**
  - The rail answers "does this fit me" with facts. The video shows *why* the mechanism works, so it belongs next to the mechanism.
  - Below lg the rail renders above Result, far from the explanation it supports.
  - It is one line: `<p class="mt-4"><a href="/lessons/<slug>#watch-<media-id>" class="inline-flex min-h-11 items-center gap-2 font-medium text-link hover:underline">` + a 16px `Clapperboard` (animation) or `SquareTerminal` (recording) icon, `aria-hidden` + "Watch: {manifest title} (Lesson X.Y)" + `<span aria-hidden="true"> →</span></a></p>`.
  - The visible text is "Watch: <title> (Lesson X.Y) →". The accessible name drops the arrow.
  - It is a same-tab internal link.
  - Ledger: `link` on `accent-soft` is 5.72 / 7.07.
- **States.** No `diagram` and no `watch`: "Why it works" renders exactly as §6.12. A `diagram` that is invalid at render, or a `watch` that is unresolved at render, is skipped and logged with no residue (DG-9).

##### States (both surfaces)

- **No diagram:** nothing is rendered. There's no placeholder and no spacing artefact.
- **Invalid at render (DG-9):** that figure is skipped and the rest of the page renders.
- **Loading:** the diagram arrives with the page HTML, so the lesson and workflow skeletons don't change.
- **Dark:** token-driven, nothing extra.
- **Print:** the horizontal SVG only.

##### Review checklist (gate/uiux on G1 and G2)

Check at 360, 768, **1024** and 1440, in light, dark and forced-colours:
1. Exactly one drawing is visible.
2. No label is clipped and no label crosses a line without its halo.
3. The emphasised node reads as emphasised in greyscale.
4. Every risk element has its dash, its ✕ and a word.
5. The figcaption's claim matches the drawing and the prose.
6. "Diagram as text" lists everything in the drawing.
7. There is no horizontal scroll.
8. A stacked horizontal form is intended, or the author was told how to shorten labels to get the row form.

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
- Verify column: `neutral` Badge "Auto" or "Manual". Progress: "3 / 4" plus `ProgressBar sm`, or "—" with sr text "No progress yet" when there is no checklist state (the literal "not started" is banned from the DOM, per PR #2 TC for P-5). An em dash means "no data", not zero.
- **States**: empty uses the curriculum empty state. Loading shows skeleton rows (8). Error uses the route boundary.

### 6.5 `/news` Today's digest

**Hierarchy**: 1. Is this today's news, and how fresh is it (N-1, N-3)? 2. Ranked items (≤10). 3. Unscored (collapsed). 4. Archive link.

```
360                                         1440
┌──────────────────────────────────────┐    ┌────────────────────────────────────────────────────────────────────────────────┐
│ Today's digest                 (h1)  │    │ ┌─ lg:col-span-8 ─────────────────────────────────────────┐ ┌─ col-span-4 ────┐ │
│ Wed 30 Sep · updated 08:03 (muted)   │    │ │ Today's digest                                  (h1)    │ │ ABOUT THE DIGEST │ │
│ [Browse archive →]                   │    │ │ Wed 30 Sep · updated 08:03 · 10 items ≥ 60              │ │ Scored daily at  │ │
│                                      │    │ │                                                         │ │ ~08:00 Manila for│ │
│ ┌ NewsCard ────────────────────────┐ │    │ │ ┌ NewsCard 87 ────────────────────────────────────────┐ │ │ relevance to     │ │
│ │ ┌──┐ Anthropic news        [🔖]  │ │    │ │ └─────────────────────────────────────────────────────┘ │ │ First Mate work. │ │
│ │ │87│ Wed 30 Sep, 06:10           │ │    │ │ ┌ NewsCard 74 ────────────────────────────────────────┐ │ │ Only items ≥ 60  │ │
│ │ Anthropic ships Claude Opus… ↗   │ │    │ │ └─────────────────────────────────────────────────────┘ │ │ appear here.     │ │
│ │ WHY IT MATTERS                   │ │    │ │ … up to 10, gap-4                                       │ │ [Browse archive] │ │
│ │ Client MVPs on Opus can…         │ │    │ │                                                         │ │                  │ │
│ └──────────────────────────────────┘ │    │ │ ▸ Unscored (4)   ← disclosure button, collapsed         │ │                  │ │
│ … ×10, gap-3                         │    │ │   compact unscored cards, no score/why                  │ │                  │ │
│                                      │    │ └─────────────────────────────────────────────────────────┘ └──────────────────┘ │
│ ▸ Unscored (4)                       │    └────────────────────────────────────────────────────────────────────────────────┘
└──────────────────────────────────────┘
```

- Header meta: `<time datetime="2026-09-30">Wed 30 Sep</time> · updated 08:03`, in the Asia/Manila zone. The item count sits at lg only.
- The digest content is `section[aria-labelledby=<h1 id>]` (region named "Today's digest", or "Latest digest" when stale). Inside it, an sr-only `h2` "Ranked items" sits between the h1 and the card `h3`s so heading levels don't skip.
- Ranked list: `<ol aria-label="Today's digest">` ("Latest digest" when stale) of `NewsCard`s, sorted by score descending, then `published_at` descending (N-1). The ordered list tells screen readers the rank.
- Unscored (N-2): a disclosure `button[aria-expanded=false][aria-controls]` whose name is "Unscored (4)", preceded by an `h2` wrapper (`<h2><button>…</button></h2>`, the APG accordion-header pattern), controlling a `hidden` panel with helper text: "These items haven't been scored yet, or scoring failed. They are not ranked." Then an `<ul>` of `unscored` cards. It is never merged into the ranked list.
- **States**
  - No runs ever: EmptyState whose title is the PRD string **verbatim**: "No news yet. Run `npm run news:run`." (inline code for the command), followed by `CommandLine npm run news:run` for copying.
    - *Suggestion (not shipped until the PRD agrees):* add a second line for engineers who don't run the pipeline: "Or import the shared snapshots: `npm run news:import`" (PRD §14 Q1).
  - Stale (N-3): a `warning` Notice (server-rendered, no live role) **above** the header meta: title rendered verbatim as "No digest yet today. Showing Tue 29 Sep" (PRD N-3 wording, no trailing period), body "Run the pipeline to fetch today's news.", `CommandLine npm run news:run`. The h1 changes to "Latest digest" so the heading is not a lie.
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
│ │        [ ]Framework [ ]Security  │ │    │ │ [✓] New model  [✓] Tooling        │ │ Clear filters                            │ │
│ │        [ ]Business               │ │    │ │ [ ] Framework  [ ] Security       │ │                                          │ │
│ │ Minimum score [ 60        ▾ ]    │ │    │ │ [ ] Business                      │ │ Results                         (h2)     │ │
│ │ Source [ All sources     ▾ ]     │ │    │ │ Minimum score [ 60 ▾ ]            │ │ ┌ NewsCard (with full date) ───────────┐ │ │
│ │ From [ 2026-09-01 ] To [ … ]     │ │    │ │                                   │ │ └──────────────────────────────────────┘ │ │
│ │ [ Apply filters ] Clear          │ │    │ │ Source [ All sources ▾ ]          │ │ … 25 per page                            │ │
│ └──────────────────────────────────┘ │    │ │ From [date]  To [date]            │ │                                          │ │
│ [Tooling ✕] [Min 60 ✕]               │    │ │ [ Apply filters ]  Clear          │ │ ‹ Prev  1 [2] 3 4 5  Next ›              │ │
│ 124 items · page 2 of 5              │    │ └───────────────────────────────────┘ └──────────────────────────────────────────┘ │
│ NewsCard …                           │    └────────────────────────────────────────────────────────────────────────────────┘
│ ‹ Prev   Page 2 of 5   Next ›        │
└──────────────────────────────────────┘
```

- **The filters are a real `<form method="get" action="/news/archive">`**, so URL params are the state (N-4) and it works before hydration. Inputs are named `tag` (repeated checkbox), `min` (native `<select>` labelled "Minimum score": options "Any" = 0, "40+", "60+", "80+"; default 0), `source` (select, "All sources" = empty) and `from`/`to` (native `type=date`). Submitting resets `page`.
- Explicit **Apply filters** button (`primary`) at every width. There is no auto-submit on change: each checkbox click would otherwise navigate, which is disorienting and noisy for screen readers.
- Grouping: tags in a `fieldset` with `legend` "Tags" and native checkboxes. Minimum score, Source, From and To are native controls with `<label>`s reading exactly "Minimum score", "Source", "From" and "To". Inputs use a `control-border` 1px border, `rounded-lg`, `h-11`.
- Validation: `from > to` → the server swaps nothing; it renders a `danger` field error under To, "End date is before start date.", with `aria-describedby`, and results are not filtered by date. Invalid `min` values are treated as 0.
- Active filters row: `FilterChip`s, each a link to the same URL minus that param (they work without JS), plus a "Clear filters" link → `/news/archive`. When the result set is empty, this row's link is not rendered, so the EmptyState's "Clear filters" is the only one on the page.
- Result count: `<p>124 items · page 2 of 5</p>` (plain text; the page navigates, so a live region would not fire reliably). After a filter submit, move focus to the Results `h2` (`tabindex=-1`): the form's submit handler sets a `sessionStorage` flag, and the results component reads it on mount, focuses the heading and clears the flag. Don't add a URL param for this; the URL must hold only the filter state.
- Pagination: `nav[aria-label=Pagination]`. Links for Prev / pages / Next, where Prev and Next have visible text "Prev" / "Next" and accessible names "Previous page" / "Next page" (visible text is contained in the name, 2.5.3); the current page is `aria-current="page"` and not a link. At 360 it shows only "‹ Prev · Page 2 of 5 · Next ›".
- Cards show the full date ("Tue 29 Sep 2026, 06:10") because items span days. Unscored items appear in the archive only when `min=0`, with the `unscored` variant.
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
│ Import                         (h2)  │    │ Import progress file [ Choose file… ]  fm-…-2026-09-30.json  │
│ Import progress file [Choose file…]  │    │ ┌ Preview (accent-soft) ───────────────────────────────────┐ │
│ ┌ Preview ─────────────────────────┐ │    │ │ This file has 7 lessons, 3 bookmarks, exported 28 Sep.   │ │
│ │ 7 lessons · 3 bookmarks          │ │    │ │ Importing replaces everything saved in this browser.     │ │
│ │ Replaces current progress.       │ │    │ │ [ Replace my progress ] (primary)  [ Cancel ] (ghost)    │ │
│ │ [ Replace my progress ] [Cancel] │ │    │ └──────────────────────────────────────────────────────────┘ │
│ └──────────────────────────────────┘ │    │ ┌ Danger zone (border danger) ─────────────────────────────┐ │
│ ┌ Danger zone ─────────────────────┐ │    │ │ Reset all progress                               (h2)    │ │
│ │ Reset all progress         (h2)  │ │    │ │ Deletes lessons, checklists and bookmarks here.          │ │
│ │ Type reset to confirm            │ │    │ │ Type reset to confirm [ ______ ] [ Reset all progress ]  │ │
│ │ [ ________ ]                     │ │    │ └──────────────────────────────────────────────────────────┘ │
│ │ [ Reset all progress ] (danger)  │ │    └──────────────────────────────────────────────────────────────┘
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

- Export (P-6): one button does both things, as the PRD specifies. It copies the JSON and downloads `fm-playground-progress-YYYY-MM-DD.json`. Success: `announce("Progress exported and copied")` plus inline text "Downloaded and copied to clipboard." If the clipboard is denied, the download still happens and the text reads "Downloaded. Copy to clipboard was blocked." It's not an error.
- Import: a visually styled `<input type=file accept="application/json,.json">` with a real `<label>` reading "Import progress file". The preview is inline (not a dialog) with buttons "Replace my progress" and "Cancel"; the reset button is always named "Reset all progress". On selection, validate the file. Invalid → `danger` Notice (`role=alert`, per §4.10): "This file isn't a valid progress export." plus the reason ("missing `version`", "invalid JSON"). Valid → the preview panel (`role=status`), with **nothing written yet**. "Replace my progress" writes the state, shows a `success` Notice "Progress imported: 7 lessons, 3 bookmarks.", and moves focus to it. Cancel clears the file input and returns focus to it.
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

The mechanism is the one M0 implemented and verified in a production build (`ws-0/foundation`, PR #1). This doc describes it; it doesn't redesign it.

**How DB-down is detected (M0, `src/lib/db/errors.ts`)**

1. Every server read goes through `dbRead(query)`. On a network-level failure (`isConnectionFailure`: `ECONNREFUSED`, `fetch failed` and similar, on the error or its `cause`), it throws `DbUnavailableError`. Other query errors throw a plain `Error`.
2. `DbUnavailableError` carries a **stable `digest = "DB_UNAVAILABLE"`** (`DB_UNAVAILABLE_DIGEST`). In production, Next replaces server error messages with a generic one and drops the class, but keeps a string `digest` set on the error, so the value reaches the client boundary.
3. The root `src/app/error.tsx` (client) calls `isDbUnavailable(error)`, which matches by `instanceof`, by `name === "DbUnavailableError"` or **by `digest === "DB_UNAVAILABLE"`** (the path that works under `next start`). True → the DB-down view. False → the generic route error view.
4. Copy comes from constants, never retyped: `DB_UNAVAILABLE_MESSAGE` (the PRD string, verbatim) and `DB_UNAVAILABLE_COMMAND` (`supabase start && npm run seed`).
5. `app/error.tsx` renders inside the root layout, so the header, nav and `#fm-live` stay. It does not catch errors thrown by the root layout itself. The layout must not read the DB (the shell is static), so no `global-error.tsx` is needed for this state.

WS-A restyles `error.tsx`. It keeps the detection logic and the constants and doesn't change the mechanism.

**Generic route error view**

```
360                                         1440 (max-w-[700px], pt-12)
┌──────────────────────────────────────┐    ┌──────────────────────────────────────────────────────┐
│ Something went wrong           (h1)  │    │ Something went wrong                         (h1)    │
│ ┌ Notice danger role=alert ────────┐ │    │ ┌ Notice danger role=alert ────────────────────────┐ │
│ │ ✕ This page couldn't load. Your  │ │    │ │ ✕ This page couldn't load. Your saved progress   │ │
│ │   saved progress is not affected.│ │    │ │   is not affected.                               │ │
│ │ [ Try again ]  Back to curriculum│ │    │ │ [ Try again ] (secondary)   Back to curriculum   │ │
│ └──────────────────────────────────┘ │    │ └──────────────────────────────────────────────────┘ │
│ Reference: 3fa9c1 (text-xs muted)    │    │ Reference: 3fa9c1                                    │
└──────────────────────────────────────┘    └──────────────────────────────────────────────────────┘
```

- `h1` "Something went wrong", a button "Try again" and a link "Back to curriculum" (M0 names, PR #2 AMB-A7). No stack trace or server message is shown; production doesn't have them anyway. `error.digest` may be shown as "Reference: \<digest\>" in `text-xs text-fg-muted`.
- "Try again": `startTransition(() => { router.refresh(); reset(); })`. `reset()` alone re-renders the client boundary without refetching Server Component data, so a server-side failure would not recover. While pending, the button shows its loading state. If it fails again, the view re-renders unchanged; don't loop.

**DB-down view** (same boundary, `isDbUnavailable(error) === true`)

```
360                                         1440 (max-w-[700px], pt-12)
┌──────────────────────────────────────┐    ┌──────────────────────────────────────────────────────┐
│ Database unavailable           (h1)  │    │ Database unavailable                         (h1)    │
│ Can't reach the local database. Run  │    │ Can't reach the local database. Run `supabase start` │
│ `supabase start` then `npm run seed`.│    │ then `npm run seed`.        ← DB_UNAVAILABLE_MESSAGE │
│ ┌ Terminal ─────────────── [Copy] ┐  │    │ ┌ Terminal ──────────────────────────── [⧉ Copy] ┐   │
│ │ supabase start && npm run seed  │  │    │ │ supabase start && npm run seed                 │   │
│ └─────────────────────────────────┘  │    │ └────────────────────────────────────────────────┘   │
│ [ Try again ]                        │    │ [ Try again ] (secondary)                            │
└──────────────────────────────────────┘    └──────────────────────────────────────────────────────┘
```

- `h1` "Database unavailable" (M0), then `DB_UNAVAILABLE_MESSAGE` **verbatim** in one `<p>` (backticked commands render as inline code; the text content is identical), then a `CommandLine` labelled "Terminal" holding `DB_UNAVAILABLE_COMMAND` (copy button name "Copy code: Terminal"), then "Try again" (same refresh-plus-reset behaviour).
  - *Suggestion (not shipped):* a line "Docker must be running." under the command would pre-empt the most common follow-up failure. It is not PRD copy, so it is left out.
- No stack trace, connection string or error code. The page is server-safe: no DB read happens during its render.
- This is where the "Copy" fallback matters most (clipboard can be blocked on `http://localhost` in some browser configs), and the §4.5 fallback covers it.
- `/progress` doesn't need the DB for its core functions. If the DB is down it still renders (it reads localStorage), and only lesson-title lookups degrade to showing slugs.

### 6.11 `/workflows` (PRD §16, WF-30, WF-31, WF-32)

**Hierarchy**: 1. The cards (what exists). 2. Search. 3. Active filters. 4. Filter controls. It is the `/news/archive` pattern (§6.6) with a card grid instead of a list, and no pagination (the library is expected to hold 10-30 items; PRD §12 lists pagination as a Could above 60).

```
360                                         1440
┌──────────────────────────────────────┐    ┌────────────────────────────────────────────────────────────────────────────────┐
│ Workflows              Share ↗  (h1) │    │ Workflows                                                      Share ↗  (h1)  │
│ Search workflows                     │    │ Setups engineers got working: …                                    (fg-muted) │
│ [ Title or problem     ] [ Search ]  │    │ Search workflows                                                               │
│ [ Filters (2) ▾ ]  ← disclosure      │    │ [ Title or problem                        ] [ Search ]                         │
│ 6 workflows                          │    │ ┌─ lg:col-span-3 <form method=get> ─┐ ┌─ lg:col-span-9 ──────────────────────┐ │
│ [Codex CLI ✕] [Review ✕]  Clear      │    │ │ Filters                    (h2)   │ │ 6 workflows                          │ │
│ Results                        (h2)  │    │ │ Tool [ Any tool ▾ ]               │ │ [Codex CLI ✕] [Review ✕]  Clear      │ │
│ ┌ card ────────────────────────────┐ │    │ │ Use case (fieldset, checkboxes)   │ │ Results                      (h2)    │ │
│ │ Title (stretched link)           │ │    │ │ Level [ Any level ▾ ]             │ │ ┌ card ──────────┐ ┌ card ─────────┐ │ │
│ │ Problem, clamped to 2 lines      │ │    │ │ Stack (fieldset, checkboxes)      │ │ │ Title          │ │ Title         │ │ │
│ │ [Claude Code] [Hook] [Skill]     │ │    │ │ [ Apply filters ]                 │ │ │ Problem (2 ln) │ │ Problem       │ │ │
│ │ [Next.js] [TypeScript]           │ │    │ └───────────────────────────────────┘ │ │ badges · chips │ │ badges        │ │ │
│ │ Verified 25 Sep 2026 · by Ada    │ │    │                                       │ │ Verified · by  │ │ Verified · by │ │ │
│ └──────────────────────────────────┘ │    │                                       │ └────────────────┘ └───────────────┘ │ │
│ Show archived (2)                    │    │                                       │ Show archived (2)                    │ │
└──────────────────────────────────────┘    └────────────────────────────────────────────────────────────────────────────────┘
```

- **Header row**: `h1` "Workflows" and a "Share ↗" link to `<REPO_URL>/blob/main/CONTRIBUTING.md#share-a-workflow` (`target=_blank`, `rel="noopener noreferrer"`, sr-only " (opens in new tab)"). `min-h-11`. The `REPO_URL` constant comes from the contract, never a literal in a component.
- **Search** sits above the grid at every width so it never hides behind the disclosure. It is a `type=search` input labelled "Search workflows" plus a "Search" button, both attached to the filter form through the `form` attribute, so one submit carries search and filters together. `maxlength=100`.
- **Filters are a real `<form method="get" action="/workflows">`** (the §6.6 pattern: works before hydration, URL is the state, explicit "Apply filters", no auto-submit). Controls: `tool` is a native select labelled "Tool" ("Any tool", "Claude Code", "Codex CLI"); `use` is a `fieldset` "Use case" of checkboxes; `level` is a select labelled "Level" ("Any level", "Level 1" to "Level 5"; the level of the related lesson); `stack` is a `fieldset` "Stack" of checkboxes. Checkbox options are the PRD §16.6 taxonomy plus any value the data adds. Empty fields are left out of the URL on submit. A `lesson` or `archived` view is carried through an Apply with hidden inputs. After a submit, focus moves to the Results `h2` (same `sessionStorage` handoff as §6.6).
- **Filters disclosure** below lg: `button[aria-expanded][aria-controls]` "Filters (N)", where N counts facet filters (tool, use, level, stack, lesson; the always-visible search is not counted). Closed by default. From lg it is a left column and the button is gone.
- **Active filters row**: `FilterChip`s ("Remove filter: Codex CLI", "Remove filter: Review", "Remove filter: Level 2", "Remove filter: Lesson <slug>", "Remove filter: Search: <q>"), each a link to the same URL minus that value, plus one "Clear filters" link. When the result set is empty the row's Clear link is not rendered, so the EmptyState's is the only one on the page.
- **Count**: plain text, "6 workflows" ("1 workflow"). Not a live region (the page navigates).
- **Card** (`Card interactive`, an `li` in a `ul`; 1 column at base, 2 columns from md): title as an `h3` with the stretched link; problem in `text-base` clamped to 2 lines with `line-clamp-2` (the full text stays in the DOM); a row of text badges, one per tool ("Claude Code", "Codex CLI", `accent`) and one per distinct setup kind (`neutral`: "Context file", "Hook", "Skill", "Subagent", "Config", "Script") or a single "Prompt only"; stack chips (`tag` badges); a footer line "Verified 25 Sep 2026 · by Ada Lovelace". Past 60 days the verified text is replaced by the `warning` badge "May be outdated" (§4.3, icon plus words). In the archived view the badge is `neutral` "Archived" with the date.
- **Order**: `verified_on` descending, then title ascending. Archived (181 days or more) is hidden; "Show archived (N)" at the end of the list links to `?archived=1` and, once on, becomes "Hide archived".
- **States**: no workflows at all: EmptyState "No workflows yet." with a link "Share the first one ↗" (new tab). No matches: EmptyState "No workflows match these filters" with "Clear filters". Loading: `workflows-skeleton` (heading, search, the filter column and 6 card skeletons). Error: route boundary (§6.10). The `/workflows` page and its loading and error files live in a `(index)` route group so `loading.tsx` does not wrap `/workflows/[slug]`, which needs a real HTTP 404.

### 6.12 `/workflows/[slug]` (`?tool=claude|codex`) (PRD §16, WF-33 to WF-38)

**Hierarchy**: 1. What it fixes and whether to trust it (header, Result). 2. What to copy (Setup, Prompt). 3. How to apply it (Steps). 4. Why (callout). The rail answers "does this fit me" without scrolling.

```
360                                         1440
┌──────────────────────────────────────┐    ┌────────────────────────────────────────────────────────────────────────────────┐
│ Workflows / Title          (crumb)   │    │ Workflows / Title                                    (crumb)                   │
│ [Archived: not verified since …]     │    │ ┌─ lg:col-span-8 ────────────────────────────┐ ┌─ lg:col-span-4 (sticky) ───────┐ │
│ WORKFLOW                    (eyebrow)│    │ │ WORKFLOW                                   │ │ AT A GLANCE            (aside) │ │
│ Title                          (h1)  │    │ │ Title                                (h1)  │ │ Tools [Claude Code] [Codex CLI]│ │
│ Problem sentence                     │    │ │ Problem sentence                           │ │ Setup type [Context file] …    │ │
│ ✓ Reviewed by stewards · 26 Sep 2026 │    │ │ ✓ Reviewed by stewards · 26 Sep 2026       │ │ Stack [Next.js]                │ │
│ Author-verified on Claude Code v2…   │    │ │ Author-verified on Claude Code v2.1.0, …   │ │ Builds on Lesson 2.2: … →      │ │
│ by Ada Lovelace                      │    │ │ by Ada Lovelace                            │ │ Report outdated ↗              │ │
│ ┌ AT A GLANCE (no On this page) ───┐ │    │ │ Result (h2)                                │ │ ─────────────                  │ │
│ └──────────────────────────────────┘ │    │ │ ┌ Before ────────┐ ┌ After ──────────┐     │ │ On this page                   │ │
│ Result                         (h2)  │    │ │ Setup (h2)   [Claude Code | Codex CLI]     │ │  Result · Setup · Prompt …     │ │
│ ┌ Before ┐                           │    │ │ [Context file] AGENTS.md  (CodeBlock+Copy) │ └────────────────────────────────┘ │
│ ┌ After  ┐                           │    │ │ Prompt (h2)  [Claude Code | Codex CLI]     │                                    │
│ Setup … Prompt … Steps …             │    │ │ Steps (h2)   1. … 2. … 3. …                │                                    │
│ │ Why it works (callout)           │ │    │ │ │ Why it works (callout)                   │                                    │
└──────────────────────────────────────┘    │ └────────────────────────────────────────────┘                                    │
                                            └────────────────────────────────────────────────────────────────────────────────┘
```

- **Header**: `nav[aria-label=Breadcrumb]` ("Workflows / <title>", the current item `aria-current=page`), eyebrow "Workflow" (`EYEBROW_CLASS`, uppercased by CSS), `h1`, the problem sentence (`text-lg`), then the meta line. Document title "<title> · Workflow · First Mate AI Playground".
- **Meta line: two signals that are never merged** (WF-34). **Reviewed** is a `success` badge with a `BadgeCheck` icon reading "Reviewed by stewards", followed by the `reviewed_on` date (omitted when unknown). It says a steward merged this file, and its element never contains the word "verified". **Verified** is plain `fg-muted` text, "Author-verified on Claude Code v2.1.0, Codex CLI v0.40.0 · 25 Sep 2026" (only the tools the workflow covers); it is the author's claim. Then "by <author>" and, from 61 days, the `warning` "May be outdated" badge. The two are separate sibling elements so a screen reader and a test can tell them apart.
- **Archived** (181 days or more): a `warning` Notice with `live={false}` above the eyebrow, "Archived: not verified since <date>. Kept for reference; the setup may no longer work." The page is still fully readable.
- **At a glance** (WF-35). From lg: a sticky (`top-[76px]`) right rail, an `aside[aria-label="At a glance"]` with Tools, Setup type (kind badges or "Prompt only"), Stack, "Builds on Lesson X.Y: <title> →" (only when `related_lesson` resolves to an active lesson, so X.Y is the curriculum number), "Report outdated ↗" and a `nav[aria-label="On this page"]` with the five section links (`#result`, `#setup`, `#prompt`, `#steps`, `#why-it-works`). Below lg the same facts render as a `section[aria-label="At a glance"]` between the meta line and Result, without "On this page". Only one of the two is displayed at a time (`hidden lg:block` / `lg:hidden`), so there is never a duplicate landmark in the accessibility tree.
- **Report outdated** opens `<REPO_URL>/issues/new?template=workflow-outdated.yml&labels=workflow-outdated&title=Outdated%3A+<slug>&workflow=<slug>` in a new tab (`rel="noopener noreferrer"`, sr-only " (opens in new tab)"). `REPO_URL` and the template name come from the contract.
- **Result**: an `h2` with two `Card`s, "Before" and "After" (`h3`), side by side from md and stacked below. The After card has a 4px `link` left border so the pair does not read as two equal boxes (the border is decoration; the headings carry the meaning). Body text is rendered by the lesson `Markdown` component (L-7: raw HTML shown as text).
- **Setup**: one `CodeBlock` per artifact. The figure label is the file `path` (so Copy reads "Copy code: AGENTS.md"), the language is the fence language, and a `neutral` kind badge ("Context file", "Hook", ...) sits above it. With no setup files: "No setup files." (and "Prompt only" in the rail and on the card).
- **Prompt**: the prompt markdown, whose fenced blocks render as `CodeBlock`s. Per-tool prompts exist only when the file has `### Claude Code` and `### Codex CLI` subsections; a tool with no prompt of its own shows the shared one.
- **Tool tabs only when both tools are covered** (WF-36). `tools` has both: Setup and Prompt each get the §4.4 tabs (tablists "Setup tool" and "Prompt tool"), bound to the same page-wide selection, the same `?tool=` param and the same `prefs.tool` preference as lessons, so choosing Codex CLI in one switches the other. A setup block tagged `tool=` shows only in its tab; an untagged block shows in both. Result, Steps and Why it works are outside the tabs. `tools` has one value: no tabs and no tablist exist in the DOM, and the prompt and setup show for that tool only.
- **Steps**: an ordered list (`list-decimal`), each item plain text with `backtick` spans as inline code (`InlineText`, never HTML).
- **Why it works**: a callout like Key differences (§6.3): `border-l-4 border-link bg-accent-soft`, `h2` inside, body rendered by `Markdown`.
- **States**: unknown or removed slug: a real HTTP 404 (the existence check is in `[slug]/layout.tsx`, above `loading.tsx`) rendering `not-found.tsx`: `h1` "Workflow not found", a primary link "Go to workflows" to `/workflows`, and "Home". The slug is never echoed. Loading: `workflow-skeleton` (header, two result cards, two code blocks). Error: route boundary (§6.10). The workflow page never writes progress; it only reads `prefs.tool`.
- **Lesson row** (WF-39a): on `/lessons/[slug]`, after previous/next, an `h2` "Workflows that use this" (`section[aria-labelledby=lesson-workflows]`) lists up to 3 non-archived workflows (newest verified first), each a full-width link row (`rounded-xl bg-surface`, the same shape as the previous/next links) with the title in bold and the problem below. More than 3: a "See all N →" link to `/workflows?lesson=<slug>`. With none, or when the read fails, nothing is rendered, including the heading. It sits after the Watch block (§6.3.2) and after everything else on the page.

---

## 7. Content and microcopy rules

- **Voice**: plain, direct, second person. Commands in backticks. No exclamation marks and no "Oops". Sentence case for all headings and buttons.
- **Empty and error copy formula**: what's missing or wrong, then what fixes it, then the command or link.
- **Dates**: absolute, Asia/Manila. Day-level: "Wed 30 Sep". With time: "Wed 30 Sep, 08:03". Archive: "Tue 29 Sep 2026, 06:10". Always wrap in `<time datetime>`. No relative times ("3h ago") in v1, because they go stale on a page left open.
- **Tool names**: "Claude Code" and "Codex CLI" in full in tabs and headings. "CC" and "Codex" are allowed only in the meta line at 360.
- **Canonical strings** (tests assert some of these; keep them identical): "Copied"; "Press ⌘C to copy" / "Press Ctrl+C to copy"; "Mark complete"; "Completed ✓ · Undo" (L-5, visible text verbatim; "Undo" is the only button, §6.3); "Exercise complete"; "Saved progress was unreadable and has been reset"; "Progress can't be saved in this browser"; "No digest yet today. Showing \<date\>"; "Unscored (N)"; "Item no longer available"; "No news yet. Run `npm run news:run`."; "Continue: \<lesson title\>"; "See all"; "Something went wrong"; "Try again"; "Database unavailable"; "Nothing above the relevance bar today"; "No items match these filters"; "Clear filters"; "Nothing bookmarked yet"; "No lessons seeded yet. Run `npm run seed`."; "Can't reach the local database. Run `supabase start` then `npm run seed`."; "May be outdated"; "No native equivalent in \<tool\> (as of vX)"; "Back to curriculum".

---

## 8. Edge cases and open questions

| # | Question | Recommended default (build this unless told otherwise) |
|---|---|---|
| 1 | Tool icons: vendor marks or neutral glyphs? | Neutral lucide glyphs (`Asterisk`, `Hexagon`) in v1. Swap for official marks after a trademark check. The label always carries identity. |
| 2 | Should opening a `?tool=codex` link update `prefs.tool`? | No. Only explicit tab activation writes the preference (§4.4 step 3). |
| 3 | `/bookmarks` "newest first": one mixed list or per type? | Two sections, newest first within each (§6.7). |
| 4 | Do checkboxes need a custom style for brand fit? | No. Native with `accent-color`. Revisit only if the stakeholder objects. |
| 5 | Continue CTA when the last-viewed lesson is complete: resume it or jump to the next incomplete one? | **Revised 2026-09-30 (orchestrator, M2 browser gate; PRD C-4.1 amended):** resume the last-viewed lesson, but when it is complete point to the next incomplete lesson in curriculum order, and show a completed state when everything is done. Reason: resuming a finished lesson is a dead end. The label still says "Continue", not "Next up". |
| 6 | News time zone for users outside Manila? | Always Manila (the digest date is Manila-based). Label the footer "Manila time". |
| 7 | Dark-mode logo asset: ask brand owner for an official reverse logo? | Ship the derived white-wordmark SVG (§1.5) and flag it for brand sign-off. |
| 8 | The `danger` button in dark mode is a soft fill, not solid. | Intentional. A solid `#ff9a7a` fill with dark text would be the loudest thing in the app. |
| 9 | PRD copy I'd change (Suggestions only; the PRD strings ship): a "Start here" label for the no-history Continue link; a `npm run news:import` line in the /news empty state; "Docker must be running." on the DB-down view. | Ship the PRD strings verbatim. Raise these as a PRD amendment if the stakeholder wants them. |

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
| C-7 | B | Async results are announced through the single `#fm-live` region (copy, mark complete, bookmark removal, exercise complete). `role=alert` only on event-driven danger Notices (§4.10) | Read the diff; screen-reader spot check |
| C-12 | B | Every role and accessible name in §11 is implemented exactly. A new interactive or landmark element adds a §11 row in the same PR | Accessibility-tree snapshot against §11 |
| C-8 | M | Focus is managed when the focused node unmounts (Mark complete ↔ Undo, dismissing a notice, bookmark removal, import confirm) | Manual keyboard pass |
| C-9 | M | Heading order has no skipped levels and exactly one `h1`. Landmarks: one `main`, one visible `nav[aria-label=Main]` | Axe plus an accessibility-tree snapshot |
| C-10 | M | External links: `target=_blank`, `rel="noopener noreferrer"`, an icon and "(opens in new tab)" sr text | Read the diff |
| C-11 | B | Reduced motion: nothing animates except content state changes; no content starts at `opacity: 0` | `emulateMedia({ reducedMotion: 'reduce' })` screenshot and a11y snapshot |

**D. Layout and responsive**

| ID | Sev | Check | How to verify |
|---|---|---|---|
| D-1 | B | No horizontal page scroll at 360, 768, 1024 or 1440. Code scrolls inside its own block | `document.documentElement.scrollWidth <= innerWidth` at each width |
| D-2 | B | Tabs remain tabs below 768px. Nav collapses to a menu button below 1024px with `aria-expanded` | Screenshot at 360 |
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
| §2, §3, `tokens.css`, fonts, logo | WS-A | `src/app/globals.css` (imports `docs/design/tokens.css`; token edits go through a PR to this doc), `src/app/layout.tsx`, `public/fonts/`, `public/brand/` (**`public/brand/` is not in WS-A's owned paths in PRD §11. The orchestrator must add it to WS-A before M1 starts.**) |
| §4 primitives, §4.11 banners slot, §5 shell, §6.9 and §6.10 | WS-A | `src/components/ui/`, `src/app/not-found.tsx`, `src/app/error.tsx` |
| `announce()` helper and `#fm-live` region | WS-A | `src/components/ui/live-region.tsx` |
| Tool preference context (shared tab state) | WS-C consumes it; WS-D owns `prefs.tool` storage | `src/lib/progress/` (D) plus `src/components/lesson/` (C) |
| §6.1 home | M2 integration | `src/app/page.tsx` |
| §6.2, §6.3, §6.4 | WS-C | `src/app/curriculum/`, `src/app/lessons/`, `src/app/exercises/`, `src/components/lesson/`, `src/components/exercise/` |
| §6.3.2 Watch block, `video::cue` rule | V3 (the `::cue` rule goes in `src/app/globals.css` via WS-A, or in a V3-owned stylesheet imported by `media-block.tsx`) | `src/components/lesson/media-block.tsx`, `src/components/lesson/server/media.ts` |
| §6.5, §6.6, §4.12 | WS-F | `src/app/news/`, `src/components/news/` |
| §4.13 Star and reactions (placement in W2's §6.11 card footer and §6.12 under the meta line) | R1 | `src/components/community/`, mounted into `src/components/workflows/` (granted single mounts, PRD §18.9) |
| §6.7, §6.8, §4.11 banner logic | WS-D | `src/app/bookmarks/`, `src/app/progress/`, `src/lib/progress/` |
| `DbUnavailableError`, `isDbUnavailable`, `DB_UNAVAILABLE_MESSAGE` (done in M0) | M0 | `src/lib/db/errors.ts` |

---

## 11. Selector contract

This is the authoritative list of **accessible roles and names** for every landmark and interactive element. Playwright tests locate elements with `getByRole(role, { name })` or `getByLabel(label)` using exactly these values. Implementations must produce them exactly (rubric C-12). Names in quotes are exact strings. `/…/` is a regex for names that contain data. `<title>` is the lesson or news item title.

**Conventions**

- `data-testid` is used only where no accessible name exists (skeleton containers), and every one is listed here.
- A name comes from visible text wherever possible. `aria-label` is used only for icon-only controls and the listed landmarks, and it always contains the visible text (WCAG 2.5.3).
- Hidden tab panels, collapsed disclosure panels and the closed mobile menu use the `hidden` attribute, so they are out of the accessibility tree.
- **Announcements**: `#fm-live` has `role="status"`. Because Notices can also be `status`, tests locate announcements with `page.locator('#fm-live')` or `getByRole('status').filter({ hasText: '<text>' })`, never with a bare `getByRole('status')`.
- **Disclosures** are always `button[aria-expanded][aria-controls]`. `<details>`/`<summary>` is not used anywhere, with **two named exceptions**: the Watch block transcript (§6.3.2, PRD MD-2) and "Diagram as text" (§6.3.3, PRD §17). Locate them with `region.locator('summary')` / `figure.locator('summary')`, not `getByRole('button')`.

### 11.1 Shell (every page)

| Element | Role | Name | Notes |
|---|---|---|---|
| Skip link | `link` | "Skip to content" | First focusable element; `href="#main"` |
| Header | `banner` | (none) | One per page |
| Home link (logo) | `link` | "First Mate AI Playground" | `img alt="First Mate"` + visible "AI Playground" text |
| Desktop nav (≥1024) | `navigation` | "Main" | Links "Curriculum", "Exercises", "Workflows", "News", "Bookmarks", "Progress"; current one has `aria-current="page"` |
| Menu button (<1024) | `button` | "Menu" | `aria-expanded` `false`/`true`, `aria-controls="mobile-nav"`; absent at ≥1024 |
| Mobile nav (<1024, open) | `navigation` | "Main" | Same 6 links. Only one "Main" nav is exposed at a time |
| Main | `main` | (none) | `id="main"`, `tabindex="-1"` |
| Footer | `contentinfo` | (none) | |
| Live region | `status` | (none) | `id="fm-live"`; texts: "Copied", "Copy blocked. Code selected. Press ⌘C to copy." (or Ctrl+C), "Lesson marked complete", "Marked not complete", "Exercise complete", "Removed from bookmarks", "Progress exported and copied" |
| Storage banner (P-3) | `status` | (none) | Text contains "Progress can't be saved in this browser" |
| Corrupted notice (P-2) | `status` | (none) | Text contains "Saved progress was unreadable and has been reset"; contains `button` "Dismiss" |

### 11.2 Components

| Component | Element | Role | Name |
|---|---|---|---|
| Tabs (lesson) | tablist | `tablist` | "Tool" |
| | tabs | `tab` | "Claude Code", "Codex CLI" (icon is `aria-hidden`) |
| | panel | `tabpanel` | Same as its tab ("Claude Code" / "Codex CLI"), via `aria-labelledby` |
| Tabs (exercise prompt) | tablist | `tablist` | "Starting prompt"; tabs and panels named as above |
| CodeBlock | wrapper | `figure` | Its `figcaption`: the filename, else the language, else "text" |
| | scroll area | (generic, focusable `pre`) | `aria-label="Code: <label>"` |
| | copy button | `button` | "Copy code: \<label\>", which becomes "Copied" for 2s after a successful copy (use `/^Cop(y\|ied)/` if re-querying within 2s) |
| | denied hint | (text) | "Press ⌘C to copy" or "Press Ctrl+C to copy" |
| CommandLine | same as CodeBlock | `figure` | Label is "Setup", "Verify", "Prompt" or "Terminal"; copy button "Copy code: Setup" and so on |
| Checkbox item | input | `checkbox` | The item text, exactly as in `CHECKLIST.md` |
| ProgressBar | bar | `progressbar` | "Level \<n\>" on curriculum and home; "Checklist" in the exercise panel. `aria-valuenow` is 0–100. Not rendered before hydration (skeleton instead) |
| Badge | | (none; text) | "Completed", "May be outdated", "Unscored", "Scoring failed", "Stale", "Exercise complete", tag labels; workflows: "Claude Code", "Codex CLI", "Prompt only", "Archived", "Reviewed by stewards", setup kinds ("Context file", "Hook", "Skill", "Subagent", "Config", "Script") |
| Notice | container | `alert` (event-driven danger), `status` (event-driven other tones), none (server-rendered) | Dismiss `button` "Dismiss" |
| EmptyState | section | `region` | Its title text (`aria-labelledby`) |
| NewsCard | card | `article` | `<title>` (via `aria-labelledby`) |
| | title link | `link` | `/^<title> \(opens in new tab\)$/` |
| | bookmark | `button` | "Bookmark: \<title\>", `aria-pressed` |
| | tags | `list` | "Tags"; `listitem` per tag |
| | remove (unavailable variant) | `button` | "Remove bookmark" |
| Skeletons | container | (none) | `data-testid`: `curriculum-skeleton`, `lesson-skeleton`, `news-skeleton`, `archive-skeleton`, `home-skeleton`, `bookmarks-skeleton`, `workflows-skeleton`, `workflow-skeleton`, `progress-placeholder` (pre-hydration progress). Each has `aria-busy="true"` |
| Diagram (§6.3.3) | wrapper | `figure` | Its `figcaption` text: the title, then the summary. Use `getByRole('figure', { name: /^<title>/ })` or `[data-testid="diagram"]` |
| | drawing | `img` | `<title>` (via `aria-labelledby`); description = the summary (via `aria-describedby`). Exactly one is visible at each width (vertical below md, horizontal from md); ids `diagram-<id>-title-h` / `-v` |
| | text toggle | (`summary` of `<details>`) | Visible "Diagram as text"; accessible name "Diagram as text for \<title\>". Locate with `figure.locator('summary')` |
| | text panel | `region` | "Diagram as text for \<title\>" (via `aria-labelledby` on the summary id) |
| | parts | (none) | `g[data-part]`: `node`, `edge`, `loop`, `exit`, `zone`, `crossing`, `lane`, `handoff`, `marker`, `axis`, `legend`; `data-state="key"` / `"risk"` |
| Workflow watch line (§6.3.3) | link | `link` | "Watch: \<manifest title\> (Lesson X.Y)". The visible text ends " →", which is `aria-hidden`. `href` `/lessons/<slug>#watch-<media-id>` |
| Star (card, §4.13) | button | `button` | `/^Star .+, \d+ stars?$/`, for example "Star Context files that stick, 4 stars"; `aria-pressed`; `aria-disabled` until the pressed state loads |
| Star (workflow page) | button | `button` | `/^Star, \d+ stars?$/` (from `aria-label`, the same at every width); `aria-pressed`. In the header eyebrow row, **outside** the "Reactions" group |
| Reactions (workflow page) | group | `group` | "Reactions"; contains exactly four `button`s (never the Star) with `aria-pressed`, named `/^Worked for me \d+$/`, `/^Learned something \d+$/`, `/^Saved me time \d+$/` and `/^Game-changer \d+$/` (emoji hidden), each `aria-describedby` its reactor line |
| Reactor line | listitem | `listitem` | Starts with sr-only "<Label>: " then `formatReactors` output, for example "Worked for me: Rafael, Ana and 3 others" |
| Card counts row | (text) | none | One sr-only sentence, comma-separated in fixed order, for example "3 worked for me, 2 learned something"; the visible "🙌 3 · 💡 2" is `aria-hidden`; absent when all are zero |
| Name prompt | region | `region` | "Add your name? Optional"; `textbox` "Your name"; `button`s "Save" and "Skip" |
| Your name control | (text + button) | `button` | Text "Reacting as <name>" or "Reacting anonymously"; `button` "Edit name" or "Add name"; the edit form has `textbox` "Your name" and `button`s "Save" and "Cancel" |
| Archived note | (text) | none | "Reactions are closed on archived workflows." (each toggle `aria-describedby` it) |
| Community announcements | `#fm-live` | `status` | "Couldn't save your star. Try again.", "Couldn't save your reaction. Try again.", "Too many changes. Wait a minute and try again.", "Add your name? Optional.", "Name saved", "You're reacting anonymously" |

### 11.3 Pages

**`/` Home**

| Element | Role | Name |
|---|---|---|
| Page heading | `heading` level 1 | "Learn Claude Code and Codex CLI, basics to orchestration" |
| Continue | `link` | `/^Continue: .+/` (exactly "Continue: \<lesson title\>") |
| Continue, all lessons complete | `heading` level 2 + `link` | heading "You've completed the curriculum"; link "Review the curriculum" → `/curriculum`; no `/^Continue: /` link |
| Level cards | `link` (stretched title) | `/^Level \d/`, for example "Level 2 Context engineering" |
| Level progress | `progressbar` | "Level \<n\>" |
| Curriculum link | `link` | "View full curriculum" |
| Today's news list | `list` | "Today's digest" ("Latest digest" when stale) |
| See all | `link` | "See all" → `/news` |

**`/curriculum`**

| Element | Role | Name |
|---|---|---|
| Heading | `heading` 1 | "Curriculum" |
| Jump links (<lg) / rail (lg+) | `navigation` | "Levels" |
| Level section | `region` | `/^Level \d/`, for example "Level 1 Foundations: prompting and tool basics" |
| Level progress | `progressbar` | "Level \<n\>" |
| Lesson row | `link` | `<title>` |
| Empty | `region` | "No lessons seeded yet. Run npm run seed." (EmptyState title; the command is inline code) |

**`/lessons/[slug]`**

| Element | Role | Name |
|---|---|---|
| Breadcrumb | `navigation` | "Breadcrumb" |
| Heading | `heading` 1 | `<title>` |
| Bookmark | `button` | "Bookmark" (fixed name; state is `aria-pressed` only, shown by a filled icon) |
| Section headings | `heading` 2 | "Concept", "In your tool", "Key differences", "Exercise" |
| On-this-lesson rail (lg+) | `navigation` | "On this lesson" |
| Tool tabs | see 11.2 | tablist "Tool" |
| Key differences | `region` | "Key differences" |
| Exercise panel | `region` | `/^Exercise/` (for example "Exercise Conventions the agent must follow") |
| Starter prompt tabs | `tablist` | "Starting prompt" |
| Checklist | `group` | "Checklist" (a `fieldset` with legend "Checklist") containing `checkbox`es |
| Compare disclosure | `button` | "Compare with reference solution" (`aria-expanded`) |
| Watch block (§6.3.2, media lessons only) | `region` | "Watch: \<title\>" (`section[aria-labelledby]`, `data-testid="media-block"`); absent on lessons without media |
| Watch heading | `heading` 3 | Exactly "Watch: \<title\>", from the h3's `aria-label` (the visible eyebrow "Watch" is `aria-hidden`). The region and the video resolve to this name through `aria-labelledby` |
| Watch video | `video` (no ARIA role; locate with `region.locator('video')`) | "Watch: \<title\>" via `aria-labelledby`; `track[kind=captions][default]` |
| Transcript toggle | `summary` (not a `button` in Playwright; locate with `region.locator('summary')`) | Visible "Transcript"; accessible name "Transcript for \<title\>" |
| Transcript panel | `region` (exposed only while open) | "Transcript for \<title\>" (`aria-labelledby` the summary) |
| Mark complete | `button` | "Mark complete" |
| Completed state | text + `button` | Visible text "Completed ✓ · Undo"; `button` "Undo" |
| Prev/next | `navigation` | "Lesson"; links `/^Previous: /` and `/^Next: /`, or "Back to curriculum" on the last lesson |
| Unknown slug | `heading` 1 | "Lesson not found"; `link` "Go to curriculum" |

**`/exercises`**

| Element | Role | Name |
|---|---|---|
| Heading | `heading` 1 | "Exercises" |
| Table (lg+) | `table` | "Exercises" (sr-only `caption`); `columnheader`s "Level", "Exercise", "Lesson", "Verify", "Progress" |
| Exercise link | `link` | Exercise title |
| Cards (<lg) | `article` | Exercise title |

**`/news`**

| Element | Role | Name |
|---|---|---|
| Heading | `heading` 1 | "Today's digest" (fresh) / "Latest digest" (stale) |
| Digest region | `region` | Same as the h1 |
| Ranked heading | `heading` 2 | "Ranked items" (sr-only) |
| Ranked list | `list` | "Today's digest" / "Latest digest"; `listitem` → NewsCard `article` |
| Unscored | `button` | `/^Unscored \(\d+\)$/` (`aria-expanded`) |
| Archive link | `link` | "Browse archive" |
| Stale notice | (no role) | Text "No digest yet today. Showing \<date\>" |
| Empty (no runs) | `region` | "No news yet. Run npm run news:run." |
| Empty (none ≥60) | `region` | "Nothing above the relevance bar today"; `link` "See today's items in the archive" |

**`/news/archive`**

| Element | Role | Name |
|---|---|---|
| Heading | `heading` 1 | "News archive" |
| Filters toggle (<lg) | `button` | `/^Filters/` (for example "Filters (3)"), `aria-expanded` |
| Filter form | `form` | "Filters" |
| Tags | `group` | "Tags"; `checkbox`es "New model", "Tooling", "Framework", "Security", "Business" |
| Minimum score | `combobox` (select) | "Minimum score"; options "Any", "40+", "60+", "80+" |
| Source | `combobox` (select) | "Source"; first option "All sources" |
| From / To | date `textbox` | "From", "To" |
| Apply | `button` | "Apply filters" |
| Filter chips | `link` | `/^Remove filter: /` (for example "Remove filter: Tooling"); each links to the current URL minus that param |
| Clear | `link` | "Clear filters" (exactly one on the page) |
| Results heading | `heading` 2 | "Results" |
| Pagination | `navigation` | "Pagination"; `link`s "Previous page", "Next page", page numbers "Page \<n\>"; the current page is `aria-current="page"` text, not a link |
| Empty | `region` | "No items match these filters" |


**`/bookmarks`**

| Element | Role | Name |
|---|---|---|
| Heading | `heading` 1 | "Bookmarks" |
| Sections | `region` | `/^Lessons \(\d+\)$/`, `/^News \(\d+\)$/` |
| Lesson bookmark | `link` | `<title>`; toggle `button` "Bookmark: \<title\>" (`aria-pressed=true`) |
| Missing news item | (text) | "Item no longer available"; `button` "Remove bookmark" |
| Undo after removal | `button` | "Undo" |
| Empty | `region` | "Nothing bookmarked yet"; links "Browse curriculum", "Today's digest" |

**`/workflows`**

| Element | Role | Name |
|---|---|---|
| Heading | `heading` 1 | "Workflows" (exactly one) |
| Share | `link` | `/^Share/` (visible "Share ↗", plus sr-only "(opens in new tab)") → `<REPO_URL>/blob/main/CONTRIBUTING.md#share-a-workflow`, `target=_blank`, `rel="noopener noreferrer"` |
| Search | `searchbox` | "Search workflows"; `button` "Search" |
| Count | (text) | "N workflows" ("1 workflow") |
| Filters toggle (<lg) | `button` | `/^Filters/` (for example "Filters (2)"), `aria-expanded` |
| Filter form | `form` | "Filters" (`method=get`, `action=/workflows`) |
| Tool | `combobox` (select) | "Tool"; options "Any tool", "Claude Code", "Codex CLI" |
| Use case | `group` | "Use case"; `checkbox`es "Planning", "Review", "Testing", "Refactoring", "Debugging", "Parallel work", "CI and gates", "Security", "Context", "Automation" (plus any the data adds) |
| Level | `combobox` (select) | "Level"; options "Any level", "Level 1" to "Level 5" |
| Stack | `group` | "Stack"; `checkbox`es "General (no specific stack)" (value `any`; ticking it narrows to stack-agnostic workflows, while an unticked group means no stack filter), "Next.js", "React", "TypeScript", "Node.js", "Supabase", "Postgres", "Python", "GitHub Actions" (plus any the data adds) |
| Apply | `button` | "Apply filters" |
| Filter chips | `link` | `/^Remove filter: /` ("Remove filter: Codex CLI", "Remove filter: Review", "Remove filter: Level 2", "Remove filter: Lesson <slug>", "Remove filter: Search: <q>") |
| Clear | `link` | "Clear filters" (exactly one on the page) |
| Results heading | `heading` 2 | "Results" |
| Card | `listitem` in a `list` | contains the title `link` (`<title>`, an `h3`) and the badges above |
| Show archived | `link` | `/^Show archived \(\d+\)$/` → `?archived=1`; "Hide archived" when on |
| Empty (none exist) | `region` | "No workflows yet."; `link` `/^Share the first one/` |
| Empty (no match) | `region` | "No workflows match these filters"; `link` "Clear filters" |

**`/workflows/[slug]`**

| Element | Role | Name |
|---|---|---|
| Breadcrumb | `navigation` | "Breadcrumb" (links "Workflows"; current item is the title, `aria-current=page`) |
| Heading | `heading` 1 | `<title>` |
| Eyebrow | (text) | "Workflow" |
| Archived notice | (text, no role) | Starts "Archived:" and contains "not verified since" |
| Reviewed | badge (text) | "Reviewed by stewards" (+ the `reviewed_on` date); never contains "verified" |
| Verified | (text) | `/^Author-verified on /` followed by the tool versions, " · " and the date |
| Section headings | `heading` 2 | "Result", "Setup", "Prompt", "Steps", "Why it works" (ids `result`, `setup`, `prompt`, `steps`, `why-it-works`); each section is a `region` with that name |
| Result cards | `heading` 3 | "Before", "After" |
| Setup / Prompt tabs (both tools only) | `tablist` | "Setup tool", "Prompt tool"; tabs "Claude Code", "Codex CLI"; none in the DOM when `tools` has one value |
| Setup blocks | `figure` | Its `figcaption`: the file `path`; Copy `button` "Copy code: <path>" |
| Steps | `list` (ordered) | in the "Steps" region |
| Rail (lg+) | `complementary` | "At a glance"; contains `navigation` "On this page" (links "Result", "Setup", "Prompt", "Steps", "Why it works") |
| Rail (<lg) | `region` | "At a glance" (no "On this page") |
| Builds on | `link` | `/^Builds on Lesson \d+\.\d+: /` → `/lessons/<slug>`; absent when the lesson is unset, archived or removed |
| Report outdated | `link` | `/^Report outdated/` → the prefilled issue URL, `target=_blank`, `rel="noopener noreferrer"` |
| Unknown or removed slug | `heading` 1 | "Workflow not found" (HTTP 404); `link` "Go to workflows" → `/workflows` |

**`/lessons/[slug]` workflows row**

| Element | Role | Name |
|---|---|---|
| Section | `region` | "Workflows that use this" (`h2`); absent when there are none |
| Items | `link` | the workflow title (the problem is in the same link); at most 3 |
| See all | `link` | `/^See all \d+/` → `/workflows?lesson=<slug>`, only when more than 3 |

**`/progress`**

| Element | Role | Name |
|---|---|---|
| Heading | `heading` 1 | "Progress" |
| Export | `button` | "Export progress" |
| Import input | file input | label "Import progress file" |
| Import preview | `status` | Contains "Importing replaces everything saved in this browser." |
| Confirm / cancel | `button` | "Replace my progress", "Cancel" |
| Import failed | `alert` | Contains "This file isn't a valid progress export." |
| Reset input | `textbox` | "Type reset to confirm" |
| Reset | `button` | "Reset all progress" (`aria-disabled="true"` until the input is exactly `reset`) |
| Reset done | `status` | "All progress has been reset." |

**`not-found` and `error`**

| Element | Role | Name |
|---|---|---|
| 404 heading | `heading` 1 | "Page not found" (lesson variant: "Lesson not found") |
| 404 action | `link` | "Go to curriculum" |
| Route error heading | `heading` 1 | "Something went wrong" |
| Route error notice | `alert` | Contains "This page couldn't load." |
| Retry | `button` | "Try again" |
| Back link | `link` | "Back to curriculum" |
| DB-down heading | `heading` 1 | "Database unavailable" |
| DB-down message | (text) | Exactly `DB_UNAVAILABLE_MESSAGE` |
| DB-down copy | `button` | "Copy code: Terminal" |

### 11.4 M0 stubs WS-A must update

When WS-A replaces the M0 stubs in `src/components/ui/index.tsx`, `src/app/error.tsx` and `src/app/not-found.tsx`, it **must update the stubs and their M0 tests in the same PR** so the contract above holds.

| M0 today | Contract | WS-A action |
|---|---|---|
| `Notice` `tone: "info" \| "warning" \| "error"`, always sets `role` (`error` → `alert`, otherwise `status`) | Variants `info`, `neutral`, `success`, `warning`, `danger`; server-rendered Notices have **no** role (§4.10) | Keep `tone` as the prop name (M0 asked for stable props) and widen it: `"error"` stays an accepted alias for `"danger"`. Add `live?: "polite" \| "assertive" \| false`, defaulting to `"polite"` (`status`), with `danger` defaulting to `"assertive"` (`alert`). `live={false}` renders no role; WS-F's stale Notice passes it. Update the M0 Notice unit test. |
| DB-down copy button named "Copy command" (`tests/unit/m0/db-unavailable.test.tsx` asserts it) | "Copy code: Terminal" (CommandLine) | Update that M0 unit test to the new name in the same PR that restyles `error.tsx`. |
| `not-found.tsx` link "Back to curriculum" | "Go to curriculum" (the error view keeps "Back to curriculum") | Change the link text. |
| `EmptyState` `title: string` | The title can contain inline code (/news, /curriculum empty) | Widen to `title: ReactNode` (compatible). |

### 11.5 Known deltas with PR #2 (tests must follow this section)

| PR #2 expectation | Contract | Why |
|---|---|---|
| `getByRole('button', { name: /Completed ✓/ })` after Mark complete | `getByText('Completed ✓ · Undo')` and `getByRole('button', { name: 'Undo' })` | One control undoes; the PRD string is visible text |
| `getByRole('progressbar', { name: 'Level 3' })` vs `/Level 3/` | Name is exactly "Level 3"; both locators work | |
| Notices: `getByRole('alert')` for warning tone | Warning and info tones are `status`; only danger is `alert` | Warnings are not urgent |
| Unscored as `<details>` in some cases | `button` "Unscored (N)" | `<summary>` is not a button in Playwright's role map |
| Bare `getByRole('status')` for "Copied" | `page.locator('#fm-live')` or a `status` filtered by text | Several `status` elements can coexist |
| `getByRole('button', { name: 'Retry' })` (P-3 case) | "Try again" | Matches M0 `error.tsx` and AMB-A7 |
| Reset inside `getByRole('dialog')` | Inline form, no dialog; button "Reset all progress" | |

