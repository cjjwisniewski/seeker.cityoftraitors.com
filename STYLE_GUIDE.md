# Seeker Frontend UI Style Guide

This guide defines the visual system, CSS tokens, layout patterns, and Svelte component conventions used across [`seeker.cityoftraitors.com`](file:///home/cwisniewski/seeker/seeker.cityoftraitors.com). Future agents modifying or adding UI must follow these conventions so new features blend seamlessly in both light and dark modes, on desktop and mobile.

---

## 1. Core Stack, Typography & Icons

- **Font Family**: `Montserrat` (`400`, `500`, `600`, `700`) loaded in [`src/app.html`](file:///home/cwisniewski/seeker/seeker.cityoftraitors.com/src/app.html) and applied via `var(--font-family)`.
- **Icon Library**: Font Awesome `6.0.0` (`fa-solid`, `fa-regular`, `fa-brands`). Set icons use Scryfall SVGs (`https://svgs.scryfall.io/sets/{code}.svg`), inverted in dark mode via `[data-theme='dark'] .set-icon`.
- **Theme Switching**: Driven by `document.documentElement.setAttribute('data-theme', 'light' | 'dark')` (initialized pre-paint in `src/app.html`). **Never** hardcode dark-only or light-only surface/text colors where a theme token exists.

---

## 2. Design Tokens (`theme.css`)

Always reference CSS custom properties from [`src/lib/styles/theme.css`](file:///home/cwisniewski/seeker/seeker.cityoftraitors.com/src/lib/styles/theme.css):

| Token | Light Theme | Dark Theme | Usage |
| :--- | :--- | :--- | :--- |
| `--color-bg-primary` | `#f8f9fa` | `#0f172a` | Page canvas, opaque sticky cells |
| `--color-bg-secondary` | `#ffffff` | `#1e293b` | Cards, inputs, secondary buttons, mobile tiles |
| `--color-bg-elevated` | `#ffffff` | `#1e293b` | Popovers, dropdowns, modals, floating bars |
| `--color-bg-hover` | `#f1f3f5` | `#334155` | Hover states on rows, buttons, menu items |
| `--color-text-primary` | `#111827` | `#f1f5f9` | Headings, card names, primary labels |
| `--color-text-secondary` | `#4b5563` | `#94a3b8` | Subtitles, metadata, nav links |
| `--color-text-muted` | `#868e96` | `#64748b` | Placeholders, disabled/hint text |
| `--color-primary` | `#2563eb` | `#3b82f6` | Primary actions, active nav, focus rings |
| `--color-primary-dark` | `#1d4ed8` | `#2563eb` | Primary button gradients |
| `--color-primary-alpha` | `rgba(37, 99, 235, 0.2)` | `rgba(59, 130, 246, 0.2)` | Active pills, selected rows, focus halos |
| `--color-border` | `#e5e7eb` | `#334155` | Hairlines, card/table dividers |
| `--color-border-hover` | `#d1d5db` | `#475569` | Input/button hover borders |
| `--color-success` | `#22c55e` | `#4ade80` | Available stock, success accents |
| `--color-warning` | `#f59e0b` | `#fbbf24` | Warnings, cooldowns |
| `--color-error` | `#dc2626` | `#f87171` | Out-of-stock icons, destructive actions |
| `--glass-bg` | `rgba(255, 255, 255, 0.7–0.8)` | `rgba(30, 41, 59, 0.7)` | Sticky navbar, mobile row cards, glass panels |
| `--glass-border` | `rgba(255, 255, 255, 0.5–0.6)` | `rgba(255, 255, 255, 0.1)` | Glass panel borders |
| `--backdrop-blur` | `10px` | `10px` | Paired with `--glass-bg` |
| `--nav-height` | `64px` | `64px` | Sticky navbar height |
| `--transition-fast` / `normal` | `0.15s ease` / `0.3s ease` | `0.15s ease` / `0.3s ease` | Micro-interactions & theme transitions |

---

## 3. Layout, Surfaces & Radii

- **Page Widths**:
  - Wide workspace views (`/seeking`, navbar, demo banner): `max-width: 1540px; margin: 0 auto; padding: 0 1rem;`
  - Focused content/search views (`/`, `/about`, `/account`): `800px`–`900px` centered container.
- **Border Radius Scale**:
  - `999px` / `9999px`: Pills, badges, nav links, toggle chips, inline quick-add triggers (`+ Cap`, `+ Cond`), `+N` store count chips.
  - `10px`–`14px`: Modals, dropdowns, popovers, mobile row cards, workspace toolbar cards.
  - `5px`–`8px`: Compact action buttons, checkboxes (`5px` on `18px` boxes), small inputs, thumbnails (`4px`–`6px`).
- **Sticky Table Column Opacity Rule**:
  - On desktop (`>= 769px`), `td.col-card` is `position: sticky; left: 0; z-index: 5;`.
  - **Never** apply a bare semi-transparent `rgba(...)` background to a sticky cell — scrolled vendor columns will bleed through. Layer tints over the solid background token instead:
    ```css
    background: linear-gradient(0deg, rgba(34, 197, 94, 0.06), rgba(34, 197, 94, 0.06)),
      var(--color-bg-primary);
    ```

---

## 4. Semantic Color & Status Conventions

### Stock, Price Caps & Selection (`SeekingCardRow.svelte`)
Maintain clear visual hierarchy on table rows (desktop) and card grids (mobile):
1. **Selected (`tr.selected`)** — Highest priority: `var(--color-primary-alpha)` background + `inset 3px 0 0 var(--color-primary, #6366f1)` left stripe.
2. **In Stock + Under Cap (`tr.under-cap:not(.selected)`)** — `rgba(34, 197, 94, 0.09)` tint (`0.14` hover) + solid `inset 3px 0 0 #22c55e` left bar + green `UNDER CAP` pill.
3. **In Stock (`tr.in-stock:not(.selected)`)** — `rgba(34, 197, 94, 0.06)` tint (`0.11` hover) + `inset 3px 0 0 rgba(34, 197, 94, 0.5)` left bar for any card in stock on at least one enabled store.
4. **Out of Stock** — Neutral `var(--color-bg-primary)` / `var(--glass-bg)` surface with red `fa-circle-xmark`.

### Badges, Finishes & Conditions
- **Finishes**: `Nonfoil` (plain), `✦ Foil` (`.foil-variant`), `◈ Etched` (`.foil-variant`).
- **Condition Bubbles**:
  - `NM`: Emerald (`#10b981`)
  - `SP` / `LP`: Blue (`#3b82f6`)
  - `MP`: Amber (`#f59e0b`)
  - `HP` / `PO` / `DMG`: Orange (`#f97316`)
- **Historical Badges**:
  - Breakthrough low (`🔥`): Red (`#f87171` / `rgba(239, 68, 68, 0.14)`)
  - At/near floor (`≈ Low`): Emerald (`#6ee7b7` / `rgba(16, 185, 129, 0.14)`)
  - Floor reference (`Floor`): Blue (`#3b82f6`)
  - Last seen (out of stock): Neutral slate (`rgba(148, 163, 184, 0.12)`)
- **Membership Tier Pills** (`global.css`):
  - `Basic`: Neutral secondary border/surface
  - `Premium`: Purple-magenta gradient (`#8b5cf6` -> `#d946ef`)
  - `Legacy`: Emerald-blue gradient (`#10b981` -> `#3b82f6`)
  - `Banned`: Soft red (`rgba(239, 68, 68, 0.15)`)
- **Discord Embed Accents** (`DemoAlertPreviewModal.svelte` — match backend Discord embeds):
  - Restock: `#2563EB` · Price Drop: `#10B981` · Historical Low: `#FF4500` · Daily Digest: `#4F46E5`

---

## 5. Navigation, Modals & Floating Bars

- **Top Navbar** (`+layout.svelte`):
  - Sticky `var(--glass-bg)` bar (`z-index: 1000`).
  - Route links use `.nav-link` pills with icon + desktop label, active highlight via `class:active` + `aria-current="page"` (`var(--color-primary)` text on `var(--color-primary-alpha)`). At `<= 768px`, hide `.nav-label` and collapse links to `34px x 34px` circular icon buttons.
- **Floating Action Bars** (`BulkActionModals.svelte`):
  - Fixed centered bars using `left: 50%; transform: translateX(-50%);` **must** specify `width: max-content; max-width: calc(100vw - 2rem);` so CSS shrink-to-fit does not clamp width to `50vw` and stack buttons vertically. Keep `flex-wrap: nowrap` on desktop and stack cleanly under `@media (max-width: 768px)`.
- **Popovers & Dropdowns** (`SeekingCardRow.svelte`):
  - Lift parent row stacking context (`z-index: 50; position: relative;`) while open.
  - Support upward opening via `.drop-up` on the last rows of a list (`isDropUp`), close on outside click + `Escape`, and convert to in-flow full-width panels (`position: static`) inside mobile grid cards.
- **Inline Quick-Edit Pills**:
  - Optional unconfigured state (`+ Cap`, `+ Cond`) uses dashed `var(--color-border)` borders at muted opacity (`0.58`), brightening to `opacity: 1` with `var(--color-primary)` on hover/focus or mobile.

---

## 6. Responsive Breakpoints

- **`768px` (Primary Desktop / Mobile Split)**:
  - `>= 769px`: Standard multi-column `<table>` with sticky `col-card`, hover reveals, desktop nav labels, single-row floating bulk bar.
  - `<= 768px`: Rows transform into 6-column CSS Grid glass cards (`--glass-bg`, `border-radius: 14px`) with `--color-bg-secondary` sub-tiles; keep desktop `td` row-tint rules scoped inside `@media (min-width: 769px)` so mobile sub-tile backgrounds are never overridden.
- **`580px` / `640px` (Small Mobile)**:
  - Stack modal footer buttons full-width (`min-height: 44px` tap targets) and tighten horizontal padding.

---

## 7. Svelte & Security Rules

- **No Raw HTML Injection**: Never use `{@html ...}` or `innerHTML`. Render all dynamic text through Svelte text bindings.
- **No Native Browser Dialogs**: Never use `alert()`, `confirm()`, or `prompt()`. Use in-app modals or inline 2-click confirmations (e.g., `Reset Demo` in `DemoBanner.svelte`).
- **External URLs**: Always sanitize marketplace and card URLs with `sanitizeExternalUrl(...)` before binding to `<a href={...}>` or `<img src={...}>`.
- **Interactive Nesting**: Never nest `<button>` or `<a>` inside another `<a>`. Place sibling actions (like the primary best-offer link and the `+N` breakdown button) side by side inside a flex container.
- **Svelte 4 `{@const}` Placement**: `{@const ...}` is only valid as an immediate child of `{#if}`, `{#each}`, `{#await}`, or `<Component>`.
- **Zero Unused CSS**: Remove unused selectors when refactoring markup so `vite build` stays warning-free.
