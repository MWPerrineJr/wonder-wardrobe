## Goal

On the marketplace home (`/`), greet unauthenticated visitors with a lightweight gate: **Sign in** (or create account) or **Continue as guest**. Signed-in users skip the gate entirely.

## UX

- First-visit modal/overlay on `/` when there is no session AND no guest choice yet.
- Three actions:
  - **Sign in** → navigates to `/auth` (existing page, already has Google + email).
  - **Create account** → `/auth` in sign-up mode (pass `?mode=sign_up`).
  - **Continue as guest** → dismisses the overlay, sets `localStorage.cnc_guest = "1"` so it doesn't reappear.
- A small "Sign in" link stays in the top nav (already there via `AccountNav`) so guests can upgrade later.
- Signed-in users never see the overlay.

## Changes

1. **`src/routes/auth.tsx`** — accept optional `mode=sign_up` search param and initialize the form mode from it.
2. **`src/components/welcome-gate.tsx`** (new) — client-only overlay component:
   - Reads session from `useAuth()`.
   - Reads `localStorage.cnc_guest` in a `useEffect` (avoid SSR hydration mismatch).
   - Renders a centered card with Crown & Cut branding, short copy, and the three buttons.
   - "Continue as guest" writes the flag and closes.
3. **`src/routes/index.tsx`** — mount `<WelcomeGate />` at the top of `MarketplacePage`.

## Technical notes

- Guest state is UI-only (localStorage); no schema or server change. All existing public data already loads without auth.
- Overlay is purely presentational — no changes to booking/business logic.
- Uses existing design tokens (`glass-panel`, `bg-primary`, `text-on-*`); no new colors.
