# Track the 90-day free trial in the database

Today the 90-day clock lives only in Stripe: it starts when an owner completes checkout with a card, and `owner_signups` gets `trial_started_at` / `trial_ends_at` only from the payment webhook. A shop that signs up but never reaches checkout has no trial record at all, so there is nothing to report on.

This adds a signup-side trial window plus a per-shop trial history, without changing how billing works.

## How the trial works after this change

- Card is still required for analytics access. The paid trial that actually gates analytics is the Stripe one created at checkout (90 days, card up front, first charge on day 91) — unchanged.
- Every new shop also gets a recorded 90-day signup window from the day the shop is created: start date, end date, and state `trialing`. This is for tracking and outreach, not access.
- When the owner completes checkout, Stripe's dates take over and the record is updated by the existing payment webhook, so the two can never disagree about billing.

## What you will see on /admin/owners

- Trial column shows the trial's source: "Signup" (recorded window, no card yet) or "Paid" (Stripe trial with card), plus days remaining.
- New stats: shops in a signup trial with no card yet, and signup trials expiring in the next 14 days — the outreach list.
- Existing "How they heard about us" strip, state filters and Source column stay as they are.
- A per-shop trial history: each state change (signup trial started, checkout trial started, converted to paid, past due, canceled, lifetime) with its timestamp, so you can see conversion date and outcome per shop.

## Existing shops

Shops created before this change get a backfilled trial record based on their signup date, marked so you can tell backfilled rows from live ones. Their access is unchanged.

## Technical notes

- Migration:
  - `public.owner_signups`: add `trial_source text` (`none | signup | stripe`, default `none`), `trial_expires_notified_at timestamptz`, and `signup_trial_ends_at timestamptz`. Keep `trial_started_at` / `trial_ends_at` as the Stripe-authoritative fields.
  - New `public.owner_trial_events` (`id`, `shop_id` FK → `shops`, `owner_id`, `event` text with CHECK in `signup_trial_started | stripe_trial_started | converted_paid | past_due | canceled | lifetime | backfilled`, `plan_state` text, `occurred_at timestamptz default now()`, `source text`, `created_at`). GRANT `SELECT` to `authenticated`, `ALL` to `service_role`; enable RLS; policies: owner reads own shop's rows, `has_role(auth.uid(),'admin')` reads all, no client writes (writes go through service role only).
  - Backfill: set `trial_source='signup'` and `signup_trial_ends_at = signed_up_at + 90 days` for existing rows with no Stripe trial, and insert one `backfilled` event per shop.
- `src/lib/trial.ts`: keep `TRIAL_DAYS = 90` as the single source; add `signupTrialEndsAt(signedUpAt)` helper used by both the insert and the backfill logic so the window is computed one way only.
- `src/lib/owner.functions.ts`: the existing non-blocking `owner_signups` insert also sets `plan_state='trialing'`, `trial_source='signup'`, `signup_trial_ends_at`, and writes a `signup_trial_started` event. Failures stay logged and non-blocking; shop creation is never blocked.
- `src/lib/payments-webhook.server.ts`: `syncOwnerSignup` additionally sets `trial_source='stripe'` when a Stripe trial arrives and appends the matching `owner_trial_events` row for each state transition (mapped from the existing `ownerPlanState`), skipping duplicates when the state has not changed.
- Access gate untouched: `shop_has_active_analytics` still keys off `subscriptions` and `comp_grants`, so a signup-only trial does not unlock analytics.
- `src/lib/admin.functions.ts`: return `trialSource`, `signupTrialEndsAt`, the derived trial label/days-left, plus totals for signup-trials-without-card and signup trials ending within 14 days; add a `listOwnerTrialEvents` server fn (admin-checked) for the per-shop history.
- `src/routes/_authenticated/admin_.owners.tsx`: trial source badge in the Trial column, two new stat tiles, and an expandable per-shop trial history row.
- Tests: unit coverage for `signupTrialEndsAt`, for the plan-state → trial-event mapping, and for the "no duplicate event when state unchanged" rule.
