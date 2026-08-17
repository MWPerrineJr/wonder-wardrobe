# Billing: free tier vs Analytics subscription

## Plans

| | Free | Analytics |
|---|---|---|
| Price | $0 | **$120 / month** or **$1,000 / year** (30-day free trial) |
| Public shop page + shareable booking link | ✅ | ✅ |
| Service listings and pricing | ✅ | ✅ |
| Weekly hours + provider calendar | ✅ | ✅ |
| Online bookings and appointment management | ✅ | ✅ |
| Post-visit email surveys | — | ✅ |
| AI sentiment / emotion / urgency analysis | — | ✅ |
| Summaries, key phrases, recommended replies | — | ✅ |
| Feedback KPIs and business analytics | — | ✅ |

One subscription per shop. Gate any future analytics feature with the same
`shop_has_active_analytics()` check.

## How it is wired

- Products/prices live in the built-in payments catalog with stable ids
  `analytics_monthly` (12000 usd/month) and `analytics_yearly` (100000 usd/year),
  tax code `txcd_10103001` (SaaS).
- `src/lib/stripe.server.ts` — server-only client routed through the Lovable
  connector gateway, plus webhook signature verification. No provider secret
  keys live in this project.
- `src/lib/billing.functions.ts` — `getBillingStatus`, `createCheckoutSession`
  (embedded checkout, 30-day trial, end-to-end tax/compliance handling enabled),
  `createPortalSession`. All owner-verified through RLS before any provider call.
- `src/routes/api/public/payments/webhook.ts` — signature-verified receiver that
  upserts `public.subscriptions` keyed by `(shop_id, environment)`.
- `src/components/analytics-upgrade-panel.tsx` — plan comparison, monthly/annual
  toggle, inline checkout form, and Manage billing.

## Test vs live

`subscriptions.environment` separates test and live records. The database gate
`shop_has_active_analytics(shop_id, env)` defaults to `live`, so test-mode
subscriptions unlock analytics in the preview only, never on the published site.
Surveys (`pending_survey_targets`) only ever consider live subscriptions.

## Testing in the preview

1. Owner opens Feedback Intelligence → plan comparison renders (no data leaves the server).
2. Choose Monthly or Annual → Start 30-day free trial → pay with test card
   `4242 4242 4242 4242`.
3. The webhook writes a `trialing` row and the dashboard unlocks.
4. Manage billing opens the customer portal (update card, switch plan, cancel).
5. Cancel → access continues until the period end, then the page locks and
   surveys stop for that shop.

## Going live

Complete the go-live steps in the Payments tab (claim the account, finish
verification, install the app on the live account). Live keys and the live
webhook are provisioned automatically — nothing to configure in code.
