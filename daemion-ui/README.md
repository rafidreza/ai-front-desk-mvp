# Daemion design system

One source of truth for how every Daemion surface looks. Brand was **extracted**
(not rebuilt) from `../daemion-brand/BRAND_GUIDELINES.html` into code.

```
daemion-ui/
├─ packages/
│  ├─ tokens/   @daemion/tokens   palette · type · space · radius (CSS vars + Tailwind v4 theme)
│  └─ ui/       @daemion/ui       React components (Tailwind v4 + CVA), built on tokens
└─ preview.html  no-build visual reference — open in a browser
```

## Two tiers

| Tier | Package | Who consumes it |
|------|---------|-----------------|
| Tokens | `@daemion/tokens` | **all three** apps — web, frontend, **and** the static website |
| Components | `@daemion/ui` | React apps only — web, frontend (website is static HTML → tokens only) |

## Usage

React app (Tailwind v4), in your root `globals.css`:

```css
@import "@daemion/tokens/theme.css";   /* pulls in Tailwind + tokens + utility mapping */
@import "@daemion/tokens/fonts.css";
```

```tsx
import { Button, Input, Field, Card, Pill } from "@daemion/ui";
```

Static website — link the raw variables, no build:

```html
<link rel="stylesheet" href="@daemion/tokens/tokens.css" />
```

## Audit fixes baked into tokens

- **R1** — disabled controls use explicit `--disabled-bg/-fg/-border`, not `opacity:0.55` on cyan. Reads as off, stays legible.
- **R2** — labels use `--text-faint` (#79817f, ≥4.5:1 on void) instead of sub-threshold gray.
- **R3** — disabled inputs share the same disabled tokens.

## Rules

- Components reference **semantic roles** (`--surface`, `--text-muted`, `--accent`) — never raw palette (`--d-signal`).
- Cyan is the charge: accent only, ~5% of any screen. Never a background field.
- Wordmark is proprietary — never retype "DAEMION" in another font; use `../daemion-brand/marks/`.
