# Public owner landing page for campaign links

The three campaign links currently point directly at `/onboarding/owner`, which is behind the auth gate, so unauthenticated visitors are redirected to the sign-in page first. The user wants a public, owner-focused landing page that explains the value proposition before asking them to sign in or create an account.

## What happens after this change

1. The three campaign links will land on a new public route (`/owners`) that captures the same UTM parameters.
2. The landing page shows an owner-focused headline, value props, and a clear CTA to become a shop owner.
3. Clicking the CTA preserves the campaign parameters and navigates to `/onboarding/owner`, where the auth gate will redirect to sign-in if needed. Because the campaign was already captured on the landing page, the attribution survives the round trip.
4. After sign-in, the user lands on the owner onboarding form with the matching “How did you hear about us?” pill pre-selected.

## Proposed route

`/owners` (public, owner-facing marketing page)

- Keeps `/owner` reserved for the authenticated owner dashboard.
- Keeps `/onboarding/owner` as the authenticated onboarding flow.

## Plan

1. Update `src/lib/campaign.ts`:
   - Change `CAMPAIGN_LINKS` to point to `/owners` instead of `/onboarding/owner`.
   - Keep the same `utm_source`, `utm_medium`, `utm_campaign`, and `utm_content` values.

2. Create `src/routes/owners.tsx`:
   - Public `createFileRoute("/owners")`.
   - `head()` with owner-specific title, description, og:title, og:description.
   - Read the current `search` query string and forward it to the CTA button (`/onboarding/owner${search}`).
   - Hero headline, short value propositions, and a primary CTA button.
   - Use the existing design tokens (Warm Stone palette, Outfit/Figtree typography, semantic Tailwind classes) so it matches the rest of the app.
   - Add a secondary link for users who already have an account.

3. Update `src/router.tsx` / `src/routes/__root.tsx`:
   - No changes needed; the existing `captureCampaign()` call already runs on every public entry point, so `/owners` will capture the UTM parameters before the CTA click.
   - Sanity-check that the capture runs on the first page view regardless of route.

4. Verify the flow:
   - Typecheck and build pass.
   - Each of the three updated links loads `/owners` and captures the UTM parameters.
   - Clicking the CTA preserves the parameters through `/onboarding/owner` → `/auth` → back to `/onboarding/owner`.
   - The onboarding form shows the pre-selected “How did you hear about us?” pill.

## Technical notes

- No new database schema or migration is needed.
- The route file is public, so it does not use `requireSupabaseAuth` or the `_authenticated` layout.
- Reuses existing `getCampaign()` / `captureCampaign()` logic from `src/lib/campaign.ts`; no new storage keys needed.
- The CTA link uses TanStack `<Link>` with `search` preserved from the current URLSearchParams.
