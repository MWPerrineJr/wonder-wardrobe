## Add "Continue with Google" to the Welcome Gate

Update `src/components/welcome-gate.tsx` to add a Google sign-in button alongside the existing Sign in / Create account / Continue as guest options.

### Changes

**`src/components/welcome-gate.tsx`**
- Import `lovable` from `@/integrations/lovable/index`.
- Add a `handleGoogle` handler calling `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`, following the standard result/error/redirected pattern.
- Add a "Continue with Google" button (with Google icon) as the primary CTA at the top of the action list, above "Sign in".
- Show a small error message inline if the OAuth call fails.
- Keep guest mode behavior (localStorage flag) unchanged.

### Layout order in the gate
1. Continue with Google (primary, gold)
2. Sign in (secondary)
3. Create an account (secondary)
4. Continue as guest (ghost/link)

No changes to auth config — Google is already enabled from a prior step.
