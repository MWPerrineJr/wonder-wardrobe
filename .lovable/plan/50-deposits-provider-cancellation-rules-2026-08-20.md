# 50% deposits + provider cancellation rules

## What changes for users

**Clients booking an appointment**

- Every shop now asks for a 50% deposit by default when it books, with the rest paid in person.
- Before confirming, the booking page shows the shop's cancellation policy in plain language: how long before the appointment they can cancel for a full refund, what fee applies after that, and whether they can reschedule.
- Cancelling from the account page applies that policy automatically: inside the free window the deposit is refunded in full; after it, the shop keeps the stated fee percentage and the rest is refunded. The confirmation dialog says exactly what they'll get back before they confirm.

**Shop owners / providers**

- The Payments tab starts at "Deposit at booking — 50%" for new and existing shops, and owners can still change the percentage or switch to full/no prepayment.
- A new **Cancellation policy** section on the Payments tab lets owners set:
  - free-cancellation window (hours before the appointment)
  - late-cancellation fee (percent of the deposit kept)
  - reschedule window (allowed or not, and how many hours before)
  - Policy text is generated from those settings and displayed on the public booking page.

## Technical outline

**Database (one migration)**

- `shops`: default `prepay_mode` to `'deposit'` and `deposit_percent` to `50`; backfill existing shops that are still on `off`/`25` to the new defaults.
- `shops`: add `cancel_free_hours smallint not null default 24`, `late_cancel_fee_percent smallint not null default 50`, `reschedule_allowed boolean not null default true`, `reschedule_min_hours smallint not null default 24`, with a validation trigger for sane ranges (0–168 hours, 0–100 percent).
- `bookings`: add `refunded_cents integer not null default 0`, `cancelled_at timestamptz`, `cancellation_reason text` so refund outcomes are auditable; extend the allowed `payment_status` values with `refunded` and `partially_refunded`.
- No new tables, so existing grants/RLS stay as they are.

**Server**

- `src/lib/booking.functions.ts`: `getBookingContext` returns the shop's cancellation policy alongside `prepay`; deposit math already reads `deposit_percent`, so 50% flows through unchanged.
- `src/lib/account.functions.ts` (`cancelMyBooking`): after the status update, compute the refund from `starts_at`, `amount_paid_cents` and the shop's policy, call `stripe.refunds.create` on the stored payment intent through `src/lib/stripe.server.ts`, then record `refunded_cents`, `cancelled_at` and the new `payment_status`. Stripe failures return a clear message and leave the booking cancelled with a flagged refund for the owner to retry.
- `src/lib/owner.functions.ts` (`updateShop`): accept the four new policy fields with Zod bounds matching the DB trigger.
- A shared `src/lib/cancellation.ts` holds the refund calculation and the human-readable policy sentence so client and server render the same text.

**UI**

- `src/components/payments-panel.tsx`: default the deposit UI to 50% and add the Cancellation policy fields (saved through the same `updateShop` call).
- `src/components/booking-panel.tsx`: replace the generic "you agree to our cancellation policy" line with the shop's actual policy and the deposit amount due.
- `src/routes/_authenticated/account.tsx`: cancel dialog shows the computed refund before confirming, and history rows show refunded amounts.
- `src/routes/shop.$slug.tsx`: policy shown on the public shop page.
- `docs/data-mapping.md` updated with the new columns.
