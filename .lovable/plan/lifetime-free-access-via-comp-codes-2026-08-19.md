# Lifetime free access via comp codes

Yes. The cleanest way is a redeemable comp code: you hand a shop owner a code, they
enter it once on the plan screen, and that shop keeps full paid-tier access forever —
no Stripe subscription, no expiry, no provider-count limit.

## How it works for the owner

1. You give them a code (e.g. `FOUNDER-7QK2M9`).
2. On `/owner/subscribe` (and in the upgrade panel on Feedback Intelligence /
   Analytics) there is a "Have a comp code?" field.
3. They enter it → the shop unlocks surveys, AI feedback analysis, and business
   analytics permanently. The plan cards are replaced by a "Lifetime access —
   complimentary" panel, and checkout / Manage billing are hidden.
4. If they already have a paid subscription, they are told to cancel it in Manage
   billing so they stop being charged; the comp access stands either way.

## How codes get created

No admin screen. Codes live in a database table; you ask me for one (with an
optional note, max redemptions, and expiry for the code itself) and I insert it.
The access it grants never expires — only the code's redeem window can.

## Data model

New table `comp_codes`

- `code` (unique, uppercase), `note`, `max_redemptions` (default 1),
  `redeemed_count`, `expires_at` (nullable = never), `is_active`, `created_at`

New table `comp_grants`

- `shop_id` (unique — one lifetime grant per shop), `code_id`, `redeemed_by`,
  `redeemed_at`

RLS/grants

- `comp_codes`: no client access at all (service-role only). Redemption happens
  server-side, so codes can't be enumerated or brute-force probed from the browser.
- `comp_grants`: `SELECT` for the shop owner (`shops.owner_id = auth.uid()`),
  no client insert/update/delete; `ALL` to `service_role`.

## Gating change

`shop_has_active_analytics(_shop_id, _env)` gets one extra `OR`: true when a
`comp_grants` row exists for the shop. Because it is environment-independent, comp
access works in preview and on the published site. Every surface already routes
through this function — Feedback Intelligence, Analytics, and the survey job
(`pending_survey_targets`) — so nothing else needs new logic.

## Server work

`src/lib/billing.functions.ts`

- `redeemCompCode({ shopId, code })` — auth + owner check via RLS, then a
  service-role transaction-style path that validates the code (active, not
  expired, redemptions left), inserts the grant, increments the counter, and
  returns a plain message on failure ("That code isn't valid or has already been
  used."). Rate-limited by requiring shop ownership.
- `getBillingStatus` returns `lifetime: boolean` (plus the grant date) so the UI
  can branch.
- `createCheckoutSession` refuses to open checkout for a shop that already has a
  lifetime grant.

## UI work

- `src/components/analytics-upgrade-panel.tsx` — comp-code input + redeem action;
  when `lifetime` is true, render the complimentary-access state instead of the
  plan cards and hide checkout/portal buttons.
- `src/routes/_authenticated/owner_.subscribe.tsx` — same lifetime state, and the
  "Continue on the free plan" link becomes "Go to dashboard" once redeemed.
- `docs/SETUP-BILLING.md` — document comp codes and how to request one.

## Notes

- Comp access is treated as Enterprise-level: all paid features, any number of
  providers, never expires.
- Revoking is possible (delete the `comp_grants` row) if you ever need it.
