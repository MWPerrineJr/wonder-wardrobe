# Walk-in sign-in page, demo data, and video ad

## 1. Walk-in sign-in page (per shop)
- New public page at `/shop/<slug>/walk-in`, made to run full-screen on a tablet at the front desk (big buttons, no site navigation).
- Flow: pick a provider (every active provider in the shop is listed, or "First available") -> pick a service -> see **only open time slots for today** (and the next few days if today is full) -> enter name and phone -> confirm.
- Slots come from the same calendar logic the online booking uses, so walk-ins can never double-book, and the new appointment appears on the provider's calendar right away.
- After confirming, a "You're checked in" screen shows for a few seconds, then the page resets for the next client.
- Owner dashboard gets a "Walk-in sign-in page" card with the link, a copy button, and a QR code.

## 2. A month of demo appointments (The Standing Chair Studio)
- Add 2 more sample providers so the multi-provider list has something to show.
- Add about 60–80 past appointments spread over the last 30 days: mixed services, providers, times of day, a few cancellations and no-shows, ~15 repeat and new sample clients.
- Add matching post-visit survey results (mostly positive, a few mixed) so the Analytics and Feedback pages fill in.
- All sample clients use made-up names and fake 555 phone numbers; no emails get sent.

## 3. Video ad (generated scenes)
Follows the video-ad steps, with a stop for your approval at each:
1. Brief: highlight the calendar, post-visit surveys, and analytics; ends on The Standing Chair brand card and the 90-day free trial. Placement and length (I'll suggest 9:16, ~20 s for social) confirmed with you.
2. Reference pack: real screenshots of the calendar, survey email, and analytics pages (after the demo data is in), plus the logo. You approve it.
3. Scene plan (about 4–5 scenes, one sound plan). You approve it.
4. Scene stills, you approve them; then each is animated and stitched into the final ad, saved in Files.

## Technical details
- Route `src/routes/shop.$slug_.walk-in.tsx` (separate page, not nested in the shop page), `noindex`, own head metadata.
- New public server function to create a walk-in booking (status `confirmed`, source tag `walk_in`), validated with Zod, reusing existing slot/overlap checks and the `validate_booking` trigger; rate-limited per shop.
- Small migration only if a `source` column on bookings is needed for tagging walk-ins.
- Demo data inserted through database queries (not a migration), scoped to the demo shop id.
- Test for the rule "walk-in page only offers free slots" next to existing booking tests.
- Video: stills via image edit from real screenshots, clips via video generation, stitched with the skill's stitch script into `/mnt/documents/ads/videos/`.
