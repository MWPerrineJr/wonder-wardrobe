## Force Google account picker on sign-in

Google is skipping the account chooser and auto-using the last-used account. Fix by passing `prompt: "select_account"` to every `lovable.auth.signInWithOAuth("google", …)` call so users with multiple Gmail accounts always see the picker.

### Changes

Update each Google sign-in call site to include `extraParams: { prompt: "select_account" }`:

- `src/components/welcome-gate.tsx` — `handleGoogle` in the home welcome gate.
- `src/routes/auth.tsx` — the "Continue with Google" button on the auth page.
- Any other call site found during a quick grep for `signInWithOAuth("google"` / `signInWithOAuth('google'`.

No backend or provider config changes required.
