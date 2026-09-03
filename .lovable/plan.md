# Campaign link tracking (UTM) for owner signups

Your three links point at `/onboarding/owner`, which sits behind sign-in. Today the auth gate
redirects unauthenticated visitors to `/auth` and the `?utm_...` parameters are lost, so a click
from LinkedIn, Instagram, or Facebook is indistinguishable from any other signup. This change
captures the campaign on the first page view, carries it through sign-in and email verification,
and records it with the owner signup.

## What happens after this change

1. Someone clicks a campaign link. The app captures `utm_source`, `utm_medium`, `utm_campaign`,
   `utm_content`, `utm_term`, plus the referrer and first-touch timestamp, and remembers them in
   the browser for 30 days (first touch wins, so a later direct visit doesn't overwrite it).
2. They get redirected to sign in / verify email as usual. The campaign survives the round trip.
3. On the shop setup form, "How did you hear about us?" is pre-selected from the campaign source
   when it matches a known choice (linkedin, instagram, facebook, tiktok, google). They can still
   change it — their own answer wins.
4. When the shop is created, the campaign is stored on the owner signup record and the attribution
   is cleared from the browser.

## What you see

On `/admin/owners`:

- A "Campaigns" summary strip: signups per campaign source and per campaign name, highest first,
  with a "Direct / none" bucket.
- New "Campaign" column in the table (source · medium, campaign name and content on hover).
- Existing "How they heard" self-reported strip and state filters stay as they are — self-reported
  and measured attribution are shown side by side.

## Testing the three links

An automated end-to-end check drives a real browser through each of the three URLs and asserts:

- the link loads (no 404/503) and lands on sign-in with the campaign preserved,
- the captured attribution matches the exact `utm_source` / `utm_campaign` / `utm_content`,
- a signed-in visit lands on the shop setup form with the matching "How did you hear about us?"
  pill pre-selected.

Results are reported back to you per link. Both the preview URL and the live
`thestandingchair.com` links are checked for a 200 response.

## Technical notes

- Migration on `public.owner_signups`: add nullable `utm_source`, `utm_medium`, `utm_campaign`,
  `utm_content`, `utm_term` (all text, length-capped via CHECK), `landing_referrer` text, and
  `first_touch_at timestamptz`. No new table, no policy changes — existing owner-read/admin-read
  SELECT policies and client-write denials cover the new columns.
- `src/lib/campaign.ts` (new, browser-safe): the tracked param list, a `readCampaignFromSearch`
  parser, `captureCampaign()` / `getCampaign()` / `clearCampaign()` over `localStorage` with a
  30-day TTL and first-touch precedence, a `campaignSourceToHeardAbout()` map onto
  `HEARD_ABOUT_SOURCES`, and a `CAMPAIGN_LINKS` list of the canonical campaign URLs.
- `src/routes/__root.tsx`: a small client-side effect (inside the existing shell component) calls
  `captureCampaign(window.location.search, document.referrer)` on mount and on route change, so
  any entry point works, not just `/onboarding/owner`. No SSR involvement, no render change.
- `src/lib/owner.functions.ts`: extend `CreateShopInput` with an optional `campaign` object
  (Zod-validated, trimmed, capped, unknown keys stripped) and write those columns into the existing
  non-blocking `owner_signups` insert. Shop creation still succeeds if tracking fails.
- `src/routes/_authenticated/onboarding.owner.tsx`: read the stored campaign once on mount, seed
  `heardAbout` from it when unset, pass `campaign` to `createOwnerShop`, and clear storage on
  success.
- `src/lib/admin.functions.ts`: select the new columns, return `utm*` fields per row plus
  `campaignSources` and `campaigns` count arrays in the DTO (finished numbers, sorted desc, unknown
  last).
- `src/routes/_authenticated/admin_.owners.tsx`: render the Campaigns strip and Campaign column
  with existing semantic tokens and `Panel` styling.
- Tests: unit coverage for the parser, TTL/first-touch precedence, and source→heard-about mapping;
  a Playwright spec in `e2e/` covering the three campaign URLs.
- Verification: typecheck, unit tests, build, plus the live-link 200 check.
