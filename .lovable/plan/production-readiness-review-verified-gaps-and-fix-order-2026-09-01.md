# Production readiness review — verified gaps and fix order

I reviewed the payment webhook, booking flow, checkout redirect handling, database access rules, background jobs, lint, tests, and dependencies against the live database. Findings below are confirmed by reading the code and querying the live policies — not guesses. Dependencies are clean (no high/critical vulnerabilities).

## What is already solid

- Scheduled jobs require a private bearer token; the public key is rejected.
- Booking prices and durations are recomputed server-side, never trusted from the client.
- Overlapping appointments are blocked by a database trigger.
- Stripe webhook signatures are verified on every request.
- Root-level error and not-found screens exist.
- Email verification, branded auth emails, and the survey flow are in place.

## Confirmed gaps, highest risk first

### 1. Payment webhook silently drops failures (money correctness)

Every database write in the webhook logs its error and continues, then the handler
returns success. Stripe treats the event as delivered and never retries, so a
transient database hiccup permanently loses a payment update.

Also missing:

- No record of processed events, so a replayed event re-runs its effects.
- `checkout.session.completed` is treated as paid without checking that the session
  actually reports a paid status — a delayed payment method can confirm an unpaid booking.
- The booking and shop in the event payload are not cross-checked against the stored
  booking, and the paid amount is not compared with the amount due.
- An expiration event arriving late can cancel a booking that already paid.

Fix: add a processed-events table keyed by the provider's event id; fail the request
with a retryable error when a write fails; verify booking/shop/amount/environment before
applying; only treat a session as paid when it reports paid; never downgrade a paid booking.

### 2. Checkout and onboarding accept any return address (phishing risk)

Booking checkout, subscription checkout, the billing portal, and payout onboarding all
accept a full absolute URL from the browser and hand it to Stripe unchanged. A crafted
link can send your customers to an attacker's site after payment. The booking flow also
falls back to `https://example.com` when no address is supplied.

Fix: accept only a relative path from the client, build the final address server-side from
the canonical site origin, and reject anything else.

### 3. A provider can move themselves between shops (authorization boundary)

The provider self-update rule checks who owns the row being edited but places no limit on
what the row may become. A provider can reassign their own record to a different shop,
point it at another user, or re-activate a deactivated profile.

Fix: restrict self-service edits to display name, bio, avatar, and specialties, and freeze
shop, user, and active status. The same missing-limit pattern applies to booking updates
and should be tightened at the same time.

### 4. A failed checkout leaves a permanent slot block (booking integrity)

The appointment row is created — and mirrored to the provider's Google Calendar — before
Stripe checkout is created. If checkout creation fails, or the customer simply closes the
tab and no expiration event ever arrives, the pending appointment keeps holding that time
slot forever and the calendar entry stays behind.

Fix: give unpaid holds an expiry, create checkout before calendar mirroring, clean up
expired holds on a schedule, and remove the calendar entry when a hold dies.

### 5. A failed survey email is never retried (delivery)

The hourly job only looks at appointments with no invite yet. Once an invite row exists,
a send that failed is recorded and then never attempted again — and the eligibility window
closes 72 hours after the appointment, so the customer never gets the survey.

Fix: also pick up invites whose delivery failed, with an attempt count, backoff, a maximum
attempt limit, and a visible list of dead letters for you to see.

### 6. Payment mode is inferred rather than declared (configuration safety)

Which Stripe environment runs is derived from which credentials happen to exist. A
half-configured deployment can silently take real money or silently take none.

Fix: require an explicit sandbox/live setting, validate the matching credentials and
webhook secret at startup, and surface the active mode in the owner dashboard.

### 7. No safety net and noisy code quality

- One test file exists (scheduled-job authentication). Nothing covers payments, access
  rules, double booking, deposits, refunds, or the survey flow.
- Lint reports 1,722 errors: 1,698 are pure formatting, leaving ~24 real findings
  (loose types, a stale effect dependency, two mutable-binding nits).
- Both an npm and a Bun lockfile are committed with no declared package manager, so a
  clean install elsewhere is not reproducible.

Fix: format the repo once so real findings are visible, resolve the ~24 substantive ones,
keep a single lockfile with the package manager declared, and add tests in this order —
payment webhook behavior, access rules per role, double booking, deposit and refund math,
survey retries.

## Suggested delivery order

```text
1. Webhook durability + idempotency   (money)
2. Return-address restriction          (customers)
3. Provider/booking update limits      (data)
4. Booking holds + cleanup             (schedule)
5. Survey retries                      (delivery)
6. Explicit payment mode               (config)
7. Formatting, lockfile, tests         (safety net)
```

Items 1–3 are the ones I would not launch real traffic without. Items 4–6 are correctness
issues that will surface as support tickets. Item 7 is what keeps them from coming back.

## Technical notes

- Webhook ledger: new `payment_events` table with a unique provider event id, event type,
  environment, attempt count, status, and sanitized error; `src/routes/api/public/payments/webhook.ts`
  returns 5xx on internal failure, 400 only on signature or payload problems.
- Return addresses: change the validators in `src/lib/booking.functions.ts`,
  `src/lib/billing.functions.ts`, and `src/lib/payouts.functions.ts` from a full URL to a
  relative path, composed against `src/lib/site-origin.ts` / `APP_URL` server-side.
- Provider edits: replace the broad update rule with a narrow authenticated server
  function, and add explicit write predicates to the provider and booking update rules.
- Holds: add `hold_expires_at` to bookings plus a cleanup step in the existing hourly job;
  move calendar mirroring after successful checkout creation.
- Surveys: add attempt/backoff columns to `survey_invites` and widen the job's selection
  in `src/routes/api/public/jobs/send-surveys.ts`.
- Tooling: `packageManager` in `package.json`, drop one lockfile, split format checking
  from semantic lint, expand the `test` script beyond the single job-auth file.
