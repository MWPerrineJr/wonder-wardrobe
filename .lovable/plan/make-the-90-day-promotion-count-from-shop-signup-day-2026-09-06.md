# Make the 90-day promotion count from shop signup day

## What I checked

- The recorded signup window already starts on the day the shop is created: the signup record stores that moment as the signup date and sets the end date to signup + 90 days. The campaign click time is stored separately, purely for attribution, and is never used as the trial start. So the "clicked the link" date is not driving anything today.
- The billing side is different, and this is the real gap: when an owner reaches checkout and adds a card, the payment provider is told "give this subscription 90 free days" starting at that moment. An owner who creates their shop today and subscribes 30 days later effectively gets 120 free days, and the two end dates disagree.

## What will change

The paid trial gets anchored to the shop's signup day instead of the checkout day:

- At checkout, the free period ends 90 days after the shop was created, not 90 days after the card is added.
- If a shop signs up and subscribes on the same day, nothing changes — a full 90 days.
- If the 90 days from signup have already passed (or end within the next two days), no free period is applied and billing starts right away. The plan page will say so before they confirm, so it is never a surprise.
- The admin owners list keeps showing one consistent end date for a shop, whether the trial is the recorded signup window or the paid one.

## Copy

The plan page and upgrade panel will state the promotion as "90 days free from the day you created your shop", with the actual remaining days shown for that shop.

## Technical notes

- `src/lib/billing.functions.ts` (`createCheckoutSession`): replace `subscription_data.trial_period_days: TRIAL_DAYS` with an absolute `trial_end` (unix seconds) derived from the shop's `owner_signups.signed_up_at` (fall back to `shops.created_at` when no signup row exists). Read it through the existing authenticated `supabase` client alongside the current shop lookup.
- New pure helper in `src/lib/trial.ts` (unit-tested): `stripeTrialEndFromSignup(signedUpAt, now)` returning `{ trialEndUnix: number } | { trialEndUnix: null; reason: 'elapsed' }`. Uses the same `TRIAL_DAYS = 90`; returns `null` when signup + 90 days is less than 48 hours away, since Stripe requires a trial end at least 48 hours out. When `null`, omit `trial_end` entirely so billing starts immediately.
- Keep `signupTrialEndsAt` in `src/lib/trial-events.ts` as the single formula and have the new helper reuse it, so signup-side and billing-side dates cannot drift.
- Webhook path unchanged: `syncOwnerSignup` still records `trial_source='stripe'` and the provider's `trial_start`/`trial_end`, which will now match the signup-anchored dates.
- `src/lib/admin.functions.ts` needs no schema change; its existing "stripe wins, else signup window" selection now yields the same date either way.
- Copy updates: `src/components/analytics-upgrade-panel.tsx`, `src/routes/_authenticated/owner_.subscribe.tsx` (heading/meta description), `src/components/subscription-status-card.tsx`, plus the remaining-days line sourced from the shop's signup date.
- Tests: new cases in `src/lib/trial-events.test.ts` (or a sibling) for same-day signup (90 days), mid-window signup (remaining days only), and elapsed window (no trial).
