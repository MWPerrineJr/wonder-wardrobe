# Billing: free tier vs Analytics subscription

## Plans

|                                                      | Free | Solo (1 provider)    | Team (2 providers)   | Enterprise (3+)      |
| ---------------------------------------------------- | ---- | -------------------- | -------------------- | -------------------- |
| Price                                                | $0   | $120/mo or $1,000/yr | $200/mo or $2,000/yr | $250/mo or $2,500/yr |
| Free trial                                           | —    | 1 month              | 1 month              | 1 month              |
| Public shop page + shareable booking link            | ✅   | ✅                   | ✅                   | ✅                   |
| Service listings, hours, provider calendar, bookings | ✅   | ✅                   | ✅                   | ✅                   |
| Post-visit email surveys                             | —    | ✅                   | ✅                   | ✅                   |
| AI sentiment / emotion / urgency analysis            | —    | ✅                   | ✅                   | ✅                   |
| Summaries, key phrases, recommended replies          | —    | ✅                   | ✅                   | ✅                   |
| Feedback KPIs and business analytics                 | —    | ✅                   | ✅                   | ✅                   |

One subscription per shop. Gate any future analytics feature with the same
`shop_has_active_analytics()` check.

## Lifetime complimentary access (comp codes)

Some shops get paid features free forever — no subscription, no expiry, no
provider limit.

- `public.comp_codes` — the codes you hand out (`code`, `note`,
  `max_redemptions`, `redeemed_count`, `expires_at`, `is_active`). Not readable
  or writable from the client at all; RLS is on with no policies.
- `public.comp_grants` — one row per shop that has lifetime access. Owners can
  read their own row; only server code writes it.
- `shop_has_active_analytics()` returns true whenever a `comp_grants` row
  exists, so comp access works in test and live mode and every gated surface
  (Feedback Intelligence, Analytics, surveys) honours it automatically.
- `redeem_comp_code(shop_id, code, user_id)` is a security-definer function
  granted only to `service_role`; `redeemCompCode` in
  `src/lib/billing.functions.ts` calls it after verifying shop ownership.
- Owners redeem in the "Have a comp code?" field on `/owner/subscribe` and in
  the upgrade panel.

To create a code, ask for one and it gets inserted:

```sql
INSERT INTO public.comp_codes (code, note, max_redemptions, expires_at)
VALUES ('FOUNDER-7QK2M9', 'Beta partner', 1, NULL);
```

Revoke access by deleting the shop's `comp_grants` row.

## How it is wired

- Products/prices live in the built-in payments catalog with stable ids
  `analytics_monthly` / `analytics_yearly`, `analytics_team_monthly` /
  `analytics_team_yearly`, `analytics_enterprise_monthly` /
  `analytics_enterprise_yearly`, tax code `txcd_10103001` (SaaS).
- `src/lib/stripe.ts` — `PLAN_TIERS` plus `tierForProviderCount()`, which
  recommends the tier from the shop's active provider count.
- `src/routes/_authenticated/owner_.subscribe.tsx` — `/owner/subscribe`, the
  subscription screen shown right after owner onboarding and from the
  dashboard "Plans" link.
- `src/lib/stripe.server.ts` — server-only client routed through the Lovable
  connector gateway, plus webhook signature verification. No provider secret
  keys live in this project.
- `src/lib/billing.functions.ts` — `getBillingStatus`, `createCheckoutSession`
  (embedded checkout, 30-day trial, end-to-end tax/compliance handling enabled),
  `createPortalSession`. All owner-verified through RLS before any provider call.
  Stripe `return_url`, `success_url`, and Connect `refresh_url` values are built
  on the server from `APP_URL` (plus optional `APP_URL_ALLOWLIST` for preview
  origins). Clients may send a relative path such as `/owner/feedback`; absolute
  URLs to other sites are rejected.
- `src/routes/api/public/payments/webhook.ts` — signature-verified receiver at
  `/api/public/payments/webhook?env=sandbox|live`. Events are claimed in
  `public.stripe_webhook_events` before any booking or subscription mutation.
  Stripe gets **2xx** for successful or already-completed deliveries, **400**
  for a bad signature or malformed payload, and **5xx** when the database
  fails so Stripe retries. Booking Checkout is marked paid only when
  `payment_status` is `paid` (or `async_payment_succeeded` arrives), and only
  if booking id, shop id, session id, environment, amount, and currency match.
- `src/components/analytics-upgrade-panel.tsx` — plan comparison, monthly/annual
  toggle, inline checkout form, and Manage billing.

## Test vs live

Set `PAYMENTS_ENV=sandbox` or `PAYMENTS_ENV=live` on the host. The process
will not start until that value is set and the matching Stripe connection id,
webhook secret, and `LOVABLE_API_KEY` are present. A live key sitting in the
environment does **not** switch the deployment to live.

Also set `VITE_PAYMENTS_ENV` to the same value (required when
`VITE_PAYMENTS_CLIENT_TOKEN` is not a `pk_test_` / `pk_live_` key). Point
Stripe at `/api/public/payments/webhook?env=<PAYMENTS_ENV>` — a webhook for
the other mode is rejected.

`subscriptions.environment` still separates test and live rows. The database
gate `shop_has_active_analytics(shop_id, env)` is called with this
deployment's `PAYMENTS_ENV`. Surveys (`pending_survey_targets`) only ever
consider live subscriptions.

Owners can confirm the mode at `/owner/diagnostics`.

## Testing in the preview

1. Owner opens Feedback Intelligence → plan comparison renders (no data leaves the server).
2. Choose Monthly or Annual → Start 30-day free trial → pay with test card
   `4242 4242 4242 4242`.
3. The webhook writes a `trialing` row and the dashboard unlocks.
4. Manage billing opens the customer portal (update card, switch plan, cancel).
5. Cancel → access continues until the period end, then the page locks and
   surveys stop for that shop.

## Going live

Complete the go-live steps in the Payments tab, then set `PAYMENTS_ENV=live`
and `VITE_PAYMENTS_ENV=live` with the live connection id and live webhook
secret. Do not rely on `STRIPE_LIVE_API_KEY` existing as the switch.
