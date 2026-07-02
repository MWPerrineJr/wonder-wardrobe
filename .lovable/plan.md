## Problem

`/auth` immediately redirects to `/` whenever a Supabase session already exists (see `src/routes/auth.tsx` lines 29-33). The auth logs confirm `/user` is returning 200 — you're still signed in from previous testing, so every visit to `/auth` flashes back home before you can interact with the form.

## Fix

Replace the blind auto-redirect with an "already signed in" state on the auth page, and make sign-out easily reachable so you can switch accounts.

### 1. `src/routes/auth.tsx`
- Remove the `useEffect` that navigates away when `session` is present.
- If `session` exists on render, show a small panel instead of the sign-in form:
  - "You're already signed in as {email}"
  - Buttons: **Continue to home** (`navigate({ to: "/" })`) and **Sign out** (`supabase.auth.signOut()` — stays on `/auth` so the form appears).
- After a successful `signInWithPassword` / `signUp`, explicitly `navigate({ to: "/" })` (so the redirect still happens on real login, just not on mount).

### 2. `src/components/account-nav.tsx`
- Confirm the dropdown's Sign out item calls the proper teardown (cancel queries, clear cache, `supabase.auth.signOut()`, `navigate({ to: "/auth", replace: true })`) so users can cleanly sign out from the marketplace header. Patch if missing.

## Verification

Drive Playwright: restore the injected session, load `/auth`, screenshot the "already signed in" panel, click **Sign out**, confirm the form appears and accepts a submission without redirecting away.
