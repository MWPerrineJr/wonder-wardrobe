# 90-day free trial + new shop owner tracking

## Where things stand today

- A free trial already exists, but it is **30 days**, and it only starts when an owner
  goes through checkout and enters card details (`TRIAL_DAYS = 30` in
  `src/lib/billing.functions.ts` and `src/lib/stripe.ts`). Copy across the app says
  "1-month free trial".
- New shop owners are only tracked implicitly: a shop row with an `owner_id`, plus an
  `owner` role row. There is no signup registry and no place for you to review who
  joined, when, or where their trial stands.

## What will change

### 1. Trial becomes 90 days

- Single source of truth bumped to 90 days, used by checkout when it creates the
  subscription, so every new shop owner who subscribes gets 90 days free before the
  first charge. Card is still collected up front (your choice), and the trial only
  applies to new subscriptions — existing shops keep their current status.
- All user-facing copy updated from "1-month free trial" to "90-day free trial":
  the analytics upgrade panel, the plan-selection page, the guided demo tour, and the
  subscription status card.

### 2. New shop owner registry

A new `owner_signups` record is created the moment a shop is created (the same
transaction path that already grants the owner role and sends the welcome email).
It captures, per shop:

- Owner name and email, and the shop name and public URL slug
- Signup date
- Trial state: whether they've started a trial, trial start and end dates, whether
  they converted to paid, cancelled, or hold a lifetime comp code
- Last time the record was refreshed from billing

Trial and conversion fields are kept current by the existing payment webhook, so the
registry reflects reality without manual work.

### 3. Admin list to view them

- A new admin-only page at `/admin/owners`: a table of every shop owner signup with
  signup date, shop, email, plan state, trial days remaining, and a headline count of
  signups this week / month and trials expiring in the next 14 days. Sortable by
  signup date, filterable by state (in trial, paid, expired, lifetime).
- Access is gated by a new **admin** role, checked server-side. Your account gets
  that role in the same change; nobody else can see the page or the data.

## Technical notes

- Migration: add `admin` to the `app_role` enum; create `public.owner_signups`
  (`shop_id` unique FK, `owner_id`, `owner_email`, `owner_name`, `shop_name`,
  `shop_slug`, `signed_up_at`, `trial_started_at`, `trial_ends_at`, `plan_state`,
  `stripe_subscription_id`, `last_synced_at`, timestamps) with GRANTs
  (`authenticated` select, `service_role` all), RLS enabled, owner-can-read-own-row
  policy and `has_role(auth.uid(),'admin')` read policy; deny writes from clients
  (writes only via service role). Trigger for `updated_at`. Seed the admin role row
  for the owner account.
- `TRIAL_DAYS` 30 → 90 in `src/lib/stripe.ts`; `src/lib/billing.functions.ts` imports
  it instead of redeclaring, so the constant cannot drift.
- `createOwnerShop` in `src/lib/owner.functions.ts` inserts the `owner_signups` row
  via `supabaseAdmin` after shop insert, non-blocking on failure (like the welcome
  email) but logged.
- `src/lib/payments-webhook.logic.ts` / `.server.ts`: on subscription created/updated
  events, upsert `trial_started_at`, `trial_ends_at`, `plan_state`
  (`none|trialing|active|past_due|canceled|lifetime`) and `last_synced_at` for the
  shop. Comp-code redemption sets `plan_state = 'lifetime'`.
- New `src/lib/admin.functions.ts`: `listOwnerSignups` server fn with
  `requireSupabaseAuth` + `has_role(userId,'admin')` check through
  `context.supabase`, returning a finished DTO (no raw rows, no PII beyond email).
- New route `src/routes/_authenticated/admin_.owners.tsx` using the existing
  `Panel`/token-based styling, loader via `ensureQueryData`, plus `errorComponent`
  and `notFoundComponent`; non-admins see a short "not available" panel.
- Tests: unit coverage for trial-days constant usage and for the plan-state mapping
  from webhook events.
