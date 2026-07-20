## Google sign-in visibility + sign-out confirmation

### 1. Google sign-in in the top-nav account dropdown
The `/auth` page already has "Continue with Google", but the header account dropdown (`src/components/account-nav.tsx`) only shows "Sign in" / "Create account" links for signed-out users — no Google option. That's likely what's missing.

- Update `src/components/account-nav.tsx`:
  - When signed out, add a "Continue with Google" button at the top of the dropdown (matching the welcome-gate styling and using `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin, extraParams: { prompt: "select_account" } })`).
  - Show a small inline error message if the call fails.

### 2. Sign-out confirmation dialog
Add a shared confirmation flow so users don't sign out by accident.

- Update `src/components/account-nav.tsx`: clicking "Sign out" opens a small confirm dialog ("Sign out of Crown & Cut?" with Cancel / Sign out actions) instead of calling `signOut()` directly.
- Update `src/routes/auth.tsx`: the "Sign out" button on the "Signed in as…" panel opens the same confirmation before calling `signOut()`.
- Implementation: a lightweight modal component (`src/components/confirm-sign-out.tsx`) reused by both, styled with existing tokens (`glass-panel`, `bg-primary`, etc.). No new dependencies.

No backend or auth-config changes.
