# Stripe billing setup (analytics plan)

Free tier: shop page, calendar, services, bookings.
Paid **analytics** plan (one subscription per shop): Feedback Intelligence
(surveys + AI enrichment) today, the business-analysis tool when it ships —
gate any future analytics feature with the same `shop_has_active_analytics()`
check.

## 1. Stripe dashboard (test mode first)

1. Create a Product: "Standing Chair Analytics".
2. Add a recurring monthly Price (any amount — the app reads the price ID, so
   you can change pricing in Stripe without touching code). Copy the
   `price_...` id.
3. Developers → Webhooks → Add endpoint:
   - URL: `https://<your-app-domain>/api/stripe/webhook`
   - Events: `checkout.session.completed`,
     `customer.subscription.created`, `customer.subscription.updated`,
     `customer.subscription.deleted`
   - Copy the signing secret (`whsec_...`).

## 2. Environment variables (Lovable Cloud secrets)

| Variable | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` (later `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from step 1.3 |
| `STRIPE_PRICE_ID_ANALYTICS` | `price_...` from step 1.2 |
| `STRIPE_TRIAL_DAYS` | optional; default `14`, set `0` for no trial |
| `APP_URL` | deployed app origin (also used by the survey emails) |

## 3. Apply the migration

`supabase/migrations/20260816182918_subscriptions_and_analytics_gating.sql`
creates the `subscriptions` table (owner-readable, service-role-writable),
the `shop_has_active_analytics()` gate, and updates
`pending_survey_targets()` so **surveys only go out for subscribed shops** —
your LLM and email spend only happens for paying customers.

## 4. How it flows

1. Unsubscribed owner opens Feedback Intelligence → server-side gate returns
   `locked` → upgrade panel renders (data never leaves the server).
2. "Upgrade to Analytics" → `createCheckoutSession` verifies shop ownership,
   creates/reuses the Stripe customer, opens Stripe Checkout (with trial).
3. Stripe redirects back to `/owner/feedback?billing=success`; the webhook
   (signature-verified) upserts the subscription row keyed by `shop_id`.
4. Status changes (renewal, card failure, cancellation) arrive via the same
   webhook. `past_due` keeps access for a 3-day grace window; `canceled`
   locks the page and stops surveys.
5. "Manage billing" opens the Stripe Customer Portal (update card, cancel).
   Enable the portal once in Stripe: Settings → Billing → Customer portal.

## 5. Test checklist (test mode, card 4242 4242 4242 4242)

- Subscribe from the upgrade panel → dashboard unlocks after redirect.
- `subscriptions` row exists with status `trialing` and correct `shop_id`.
- Mark a booking completed → survey email arrives (subscription active).
- Cancel via Manage billing → at period end the page locks again and
  `pending_survey_targets` returns nothing for that shop.
- Webhook resilience: Stripe dashboard → Webhooks → send a test event with a
  bad signature → endpoint returns 400 and writes nothing.

## Implementation notes

- No `stripe` npm dependency: the three REST calls are plain form-encoded
  requests and signature verification is Web Crypto HMAC — keeps the bun
  lockfile untouched and runs on the Cloudflare/Nitro target.
- The webhook upsert is idempotent (`onConflict: shop_id`), so Stripe retries
  are safe.
- `checkout.session.completed` fetches the full subscription from Stripe
  rather than trusting the session payload.
