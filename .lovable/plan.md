
## Overview

The 8 provided HTML files are 4 unique screens (each shown twice). I'll port them into a TanStack Start app as 4 routes, faithful to the HTML's layout, typography, colors, and imagery.

## Screens → Routes

| Route | Screen | Source HTMLs |
|---|---|---|
| `/` | Crown & Cut Marketplace — "Find your next cut" (categories + featured shops) | 2, 5 |
| `/shop` | The Sharp Edge — Booking (services, barber pick, time slots, booking summary) | 1, 6 |
| `/barber` | Barber Personal Calendar — "My Schedule" (day view with appointments) | 3, 8 |
| `/owner` | Shop Owner Dashboard — Overview (KPIs, today's schedule, staff) | 4, 7 |

Cross-linking: marketplace shop cards → `/shop`; a small top nav lets you jump between the 4 views for demo.

## Design port

- Copy the HTML's design tokens (colors, `font-headline-*`, `text-body-*`, `border-subtle`, `on-surface`, `primary`, etc.) into `src/styles.css` as CSS variables + `@theme inline` mappings so utility classes like `bg-primary`, `text-on-surface`, `font-headline-lg` work unchanged.
- Preserve the fonts referenced in the HTML by adding the Google Fonts `<link>` in `__root.tsx` head.
- Hotlink the images referenced in the HTML directly (no re-hosting).
- Keep the exact composition per screen: same section order, card counts, chip lists, and CTA count.

## Per-route implementation

Each route file under `src/routes/`:
- Sets its own `head()` with a specific title + description.
- Renders a React component that mirrors the HTML structure (semantic sections, same class names against the ported tokens).
- Static content only — no backend, no auth, no state persistence beyond simple `useState` for tab/slot selection where the HTML implies interactivity.

## Shared

- Minimal top nav component (Marketplace / Shop / Barber / Owner) used across routes.
- Icons via `lucide-react` where the HTML uses Material Symbols (closest available), keeping semantics identical.
- Update `src/routes/index.tsx` to be the Marketplace (removes the placeholder).
- Root `head()` gets real app-specific title/description ("Crown & Cut — Find your next cut").

## Out of scope

- No database, auth, payments, or real booking logic.
- No responsive redesign beyond what the HTML already declares (mobile-first with `md:` breakpoints as written).
