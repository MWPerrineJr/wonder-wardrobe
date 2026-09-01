# Require email verification, with branded auth emails

## Where things stand

- Sign-up already asks for a confirmation link back to your site, but the page immediately tells people "You're signed in" — so if confirmation is enforced, that message is wrong and they end up stuck.
- Both existing accounts signed in with Google, which Google verifies itself. Google sign-in stays instant and is unaffected by everything below.
- There is no "forgot password" flow or password-reset page yet.
- Your sending domain (notify.pandagentic.ai) is still finishing DNS verification. Branded emails go out automatically once that completes.

## What changes for a new user

1. Someone signs up with email and password.
2. They see a clear "Check your email to confirm your address" state instead of being told they're signed in.
3. They get a branded email from The Standing Chair with a confirm button; clicking it signs them in and returns them where they started.
4. Signing in before confirming shows a friendly "please confirm your email first" message with a "resend link" button.
5. Forgot your password? A reset link email, a new password page, and back to signing in.

## Work items

1. **Turn on email verification** — set new email/password accounts to require confirmation. Google sign-ins remain instant.

2. **Fix the sign-up screen** (`src/routes/auth.tsx`)
   - Replace the false "you're signed in" success with a check-your-inbox panel showing the address and a resend button.
   - On sign-in, detect the unconfirmed-email error and show the confirm-first message plus resend.
   - Add a "Forgot password?" link that emails a reset link.

3. **New password-reset page** (`/reset-password`, public route)
   - Accepts the recovery link, collects a new password, then sends them to sign in.

4. **Branded auth emails**
   - Generate the auth email templates (confirm signup, magic link, password reset, invite, email change, re-auth) and style them to match the app: Warm Stone background, gold accent, Outfit/Figtree typography, The Standing Chair wordmark, support address in the footer.

## Technical notes

- Auth setting: `auto_confirm_email: false` via the auth config tool.
- Touched files: `src/routes/auth.tsx`, new `src/routes/reset-password.tsx`, new auth email templates under the email templates folder.
- Resend uses `supabase.auth.resend({ type: 'signup' })`; reset uses `resetPasswordForEmail` with a redirect to `/reset-password`.
- Verification/reset emails only actually deliver once notify.pandagentic.ai finishes DNS verification; until then Google sign-in is the reliable path, so I'll note that in the UI copy nowhere — it's a temporary infrastructure state, not app behavior.

## Verification

- Sign up with a test address: no false "signed in" toast, inbox panel appears, resend works.
- Attempt sign-in before confirming: confirm-first message shown.
- Password reset: email link lands on `/reset-password`, new password works.
- Google sign-in still signs in immediately.
