## Goal
Add an easy-to-test flow that (1) forces the Google account picker and (2) clearly shows which Google email is signed in after the redirect completes.

## New route: `/auth/google-test`
A dedicated, public page for verifying the Google sign-in round trip end to end without touching the marketplace gate or header.

Contents:
- Heading: "Google sign-in test"
- Signed-out state: single "Continue with Google" button that calls `lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/auth/google-test`, extraParams: { prompt: "select_account" } })` so the account chooser is always shown.
- Signed-in state: a card showing
  - "Signed in as" + the Google email (from `supabase.auth.getUser()` → `user.email`)
  - Provider + avatar/display name when present (`user.user_metadata.full_name`, `avatar_url`)
  - Raw `identities[0].identity_data.email` as a fallback confirmation that it came from Google
  - "Try another account" button → signs out then immediately re-invokes Google sign-in with `prompt: "select_account"`
  - "Sign out" button (uses existing `ConfirmSignOutDialog`)
- Small status line: last event from `onAuthStateChange` (e.g. `SIGNED_IN`, `SIGNED_OUT`) so testers can see the transition.

## Header entry point
Add a "Test Google sign-in" link to `src/components/account-nav.tsx` dropdown (visible in both signed-in and signed-out states) that navigates to `/auth/google-test`. This keeps the flow discoverable without altering existing auth surfaces.

## Behavior details
- Uses the already-enabled managed Google provider and existing `lovable.auth.signInWithOAuth` helper — no new backend config.
- Reads user via `supabase.auth.getUser()` on mount and subscribes to `onAuthStateChange` so the picked email appears immediately after redirect.
- Renders inside the current light theme; no design token changes.

## Files
- New: `src/routes/auth.google-test.tsx` (public route, TanStack file route).
- Edit: `src/components/account-nav.tsx` — add link to the test page.

## How to test
1. Sign out.
2. Open `/auth/google-test` → click "Continue with Google" → Google account chooser appears.
3. Pick an account → redirected back → page shows "Signed in as <that email>".
4. Click "Try another account" → chooser appears again → pick a different account → email updates.
