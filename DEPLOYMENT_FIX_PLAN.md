# The Standing Chair — Deployment Fix Plan

This plan turns the deployment-readiness review into an ordered implementation backlog. Work from the top down: later phases depend on the security and release foundations established earlier.

## Current release decision

**Do not deploy to production yet.** The production build and TypeScript compilation pass, but scheduled-job authentication and reproducible installation are release blockers. Payment reliability, redirect validation, database authorization, retry behavior, and automated testing must also be addressed before launch.

## Phase 0 — Establish a safe working baseline

### Tasks

- Create a remediation branch without rewriting Lovable's published Git history.
- Record the current deployment URLs, Supabase environments, Stripe webhook registrations, cron schedules, and required environment variables.
- Establish a staging deployment using Stripe sandbox and non-production email/calendar connections.
- Freeze production releases until Phases 1–3 pass.

### Exit criteria

- All fixes can be tested without affecting production customers, payments, or email recipients.
- Existing production configuration and rollback information are documented.

## Phase 1 — Secure scheduled jobs

**Priority: P0 — release blocker**

### Problem

`src/lib/jobs.server.ts` authenticates administrative jobs using `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY`. Those keys are public by design. The publishable key and environment-specific Lovable URL are also embedded in cron migrations.

Affected jobs:

- `/api/public/jobs/send-surveys`
- `/api/public/jobs/enrich-feedback`
- `/api/public/jobs/build-reports`

### Tasks

1. Generate a dedicated high-entropy `JOB_SECRET`.
2. Store it only in deployment secrets and Supabase Vault or an equivalent secret store.
3. Change job authorization to require `Authorization: Bearer <JOB_SECRET>`.
4. Compare the presented secret safely; do not log either value.
5. Update all three scheduled calls to send the new authorization header.
6. Remove literal credentials and environment-specific deployment URLs from migration SQL.
7. Move cron destination configuration into environment-aware deployment automation or database settings.
8. Add rate limiting and structured invocation logging.
9. Rotate the secret after staging verification.

### Tests

- Missing credential returns 401.
- Supabase publishable key returns 401.
- Incorrect secret returns 401.
- Correct scheduler secret succeeds.
- Concurrent requests allow only one lease holder.
- Repeated requests cannot duplicate work or cause unbounded email/AI spend.

### Exit criteria

- Public Supabase credentials cannot invoke administrative jobs.
- No scheduler secret is present in Git history or client bundles.

## Phase 2 — Make installs and deployments reproducible

**Priority: P0 — release blocker**

### Problem

`package.json` and `package-lock.json` are out of sync, so `npm ci` fails. The repository also contains `bun.lock` without declaring Bun as the required package manager.

### Tasks

1. Choose npm or Bun as the only supported package manager.
2. Add an exact `packageManager` field to `package.json`.
3. Regenerate the selected lockfile from the reviewed dependency set.
4. Remove the competing lockfile.
5. Verify installation from a clean clone with frozen lockfile behavior.
6. Add CI gates for:
   - Frozen clean install
   - Format check
   - Semantic lint
   - TypeScript compilation
   - Automated tests
   - Migration replay
   - Production build
   - Dependency audit

### Exit criteria

- A fresh clone installs and builds without changing the lockfile.
- CI blocks merges when any release gate fails.

## Phase 3 — Protect payment and subscription state

**Priority: P1 — financial correctness**

### Problem

The payment webhook logs database failures but still returns HTTP 200. Stripe then considers the event delivered and will not retry. Webhook processing also lacks an event ledger for idempotency and ordering.

### Tasks

1. Add a `stripe_webhook_events` table keyed by unique Stripe `event.id`.
2. Record event type, environment, timestamps, status, attempts, and sanitized failure details.
3. Make processing idempotent and transactional where practical.
4. Throw on every failed or unexpectedly zero-row database mutation.
5. Return:
   - 2xx only after successful or previously completed processing
   - 5xx for retryable internal failures
   - 400 for invalid signatures or malformed events
6. For booking events, verify:
   - Booking ID
   - Shop ID
   - Checkout session ID
   - Payment environment
   - Expected amount and currency
7. Process `checkout.session.completed` as paid only when `payment_status === "paid"`.
8. Wait for `checkout.session.async_payment_succeeded` for delayed payment methods.
9. Prevent expired or failed events from canceling an already-paid booking.
10. For subscription events, verify shop/customer metadata and prevent older events from overwriting newer state.

### Tests

- Duplicate event delivery is harmless.
- Out-of-order events preserve the newest valid state.
- A Supabase failure returns 5xx and succeeds on Stripe retry.
- An unpaid asynchronous checkout does not confirm a booking.
- Invalid booking/shop metadata cannot change unrelated records.
- A late expiration event cannot cancel a paid booking.

### Exit criteria

- Payment and subscription state recovers automatically after transient failures.
- Replayed webhooks never duplicate financial effects.

## Phase 4 — Restrict financial-flow return URLs

**Priority: P1 — phishing and open-redirect prevention**

### Affected flows

- Booking Checkout
- Subscription Checkout
- Billing Portal
- Stripe Connect onboarding

### Tasks

1. Stop accepting unrestricted absolute return URLs from clients.
2. Prefer accepting only a relative return path.
3. Construct the final URL server-side using the configured canonical `APP_URL`.
4. If preview deployments must be supported, maintain an explicit origin allowlist.
5. Reject:
   - External origins
   - Non-HTTPS production URLs
   - Credential-bearing URLs
   - Non-HTTP protocols
   - Protocol-relative URLs

### Exit criteria

- Users cannot create Stripe-hosted flows that redirect to attacker-controlled sites.

## Phase 5 — Tighten Supabase authorization

**Priority: P1 — authorization boundary**

### Problem

The provider self-update policy allows updates to the provider row without restricting sensitive columns such as `shop_id`, `user_id`, or `is_active`.

### Tasks

1. Replace broad direct provider-table updates with a narrow RPC or authenticated server function.
2. Permit providers to change only approved fields, such as display name, bio, avatar, and specialties.
3. Freeze provider-controlled changes to:
   - `shop_id`
   - `user_id`
   - `is_active`
   - Ownership and administrative fields
4. Add explicit `USING` and `WITH CHECK` predicates as defense in depth.
5. Review every exposed table, view, function, grant, and RLS policy.
6. Pay special attention to every `SECURITY DEFINER` function and its `EXECUTE` grants.
7. Replay all migrations against a new local Supabase database.
8. Run Supabase security and performance advisors against staging.
9. Add integration tests for anon, customer, provider, owner, and service-role behavior.

### Exit criteria

- Each role can access only its intended rows and columns through the Data API.
- Supabase advisors have no unresolved security findings.

## Phase 6 — Repair background-job reliability

**Priority: P1/P2 — data delivery and cost control**

### Survey delivery

1. Select both new invitations and retryable `pending` or `failed` invitations.
2. Track attempt count, last attempt, next attempt, sanitized error, and terminal/dead-letter status.
3. Add exponential backoff and a maximum attempt count.
4. Preserve one stable email idempotency key per invite.
5. Add an operational view for failed and dead-letter invitations.

### AI jobs

1. Track per-item status instead of only aggregate counts.
2. Add retry scheduling and terminal failure states.
3. Enforce spending and invocation limits.
4. Alert when a job remains paused or repeatedly fails.

### Exit criteria

- A temporary email or AI-provider outage recovers without duplicate delivery or processing.

## Phase 7 — Make booking creation recoverable

**Priority: P2 — booking integrity**

### Problem

A booking is inserted and calendar synchronization begins before Stripe Checkout is successfully created. Failures can leave pending bookings that continue holding appointment slots.

### Tasks

1. Add an explicit booking-hold state and `hold_expires_at`.
2. Create Stripe Checkout before Google Calendar synchronization.
3. Check the result of every database mutation, including storing the checkout session ID.
4. Cancel or expire the hold when Checkout creation fails.
5. Add scheduled cleanup for expired and orphaned holds.
6. Move calendar synchronization behind confirmed booking state, preferably through an outbox job.
7. Add database concurrency tests proving two requests cannot reserve the same provider and time.
8. Define how no-provider-preference bookings reserve capacity.

### Exit criteria

- Failed checkout or calendar operations cannot leave permanent slot blocks or inconsistent bookings.

## Phase 8 — Make the payment environment explicit

**Priority: P2 — configuration safety**

### Tasks

1. Require an explicit `PAYMENTS_ENV=sandbox|live` environment variable.
2. Validate all related Stripe credentials and webhook secrets during startup.
3. Fail startup when configuration is incomplete or contradictory.
4. Expose the selected environment in an authenticated diagnostics view.
5. Prevent live mode from being enabled merely because a live secret exists.

### Exit criteria

- Every deployment has one intentional, visible, and validated payment mode.

## Phase 9 — Build the regression suite

Implement tests in this risk order:

1. RLS, grants, and role-authorization integration tests
2. Stripe webhook and payment-state tests
3. Double-booking concurrency tests
4. Deposit and refund calculations
5. Survey retry and idempotency tests
6. Timezone and daylight-saving booking tests
7. Authentication and account-isolation tests
8. Browser smoke tests covering:
   - Sign up and sign in
   - Shop creation
   - Provider and service creation
   - Appointment booking
   - Sandbox Checkout completion
   - Cancellation and refund
   - Owner and provider schedules
   - Feedback submission

### Exit criteria

- Critical business and authorization paths fail CI when behavior regresses.

## Phase 10 — Restore engineering and operational gates

### Code quality

1. Format the repository once.
2. Separate `format:check` from semantic lint.
3. Resolve all remaining lint errors and warnings.
4. Upgrade the vulnerable transitive `esbuild` dependency.
5. Plan React Email and Recharts upgrades with visual regression checks.

### Operations

Add:

- Structured, redacted logs
- Request correlation IDs
- Error tracking and alerts
- Health and readiness endpoints
- Webhook event and job dashboards
- Uptime monitoring
- Backup and restore verification
- Deployment rollback instructions
- Post-deployment smoke checklist
- Verification of CSP, HSTS, referrer policy, TLS, DNS, and canonical origin

### Exit criteria

- All release gates are green and production failures are detectable, diagnosable, and recoverable.

## Critical implementation order

```text
Job security
  -> reproducible install and CI
  -> webhook correctness and idempotency
  -> return-URL validation
  -> Supabase authorization
  -> background-job retries
  -> booking recovery
  -> comprehensive tests
  -> staging validation
  -> production deployment
```

## Production go-live checklist

Do not approve production deployment until all of the following are true:

- [ ] Job endpoints reject public Supabase credentials.
- [ ] No scheduler secrets or environment-specific credentials are committed to Git.
- [ ] Frozen clean installation passes.
- [ ] Format, lint, typecheck, tests, migration replay, build, and audit pass in CI.
- [ ] Stripe processing is idempotent and returns retryable failures correctly.
- [ ] Financial return URLs are restricted to approved application origins.
- [ ] Supabase RLS, grants, RPCs, and `SECURITY DEFINER` functions have passing role tests.
- [ ] Supabase advisors have no unresolved security findings.
- [ ] Booking holds expire and orphan cleanup has been verified.
- [ ] Survey and AI failures retry safely without duplication.
- [ ] Staging passes with Stripe sandbox, email, Google authentication, and Google Calendar.
- [ ] Production payment environment and secrets have been verified independently.
- [ ] Monitoring, alerts, backups, security headers, DNS/TLS, and rollback procedures are verified.

## Baseline verification results

At the time this plan was created:

- Production build: passed
- TypeScript compilation: passed
- Clean `npm ci`: failed because the lockfile is out of sync
- Lint: failed with 1,739 findings
- Dependency audit: one low-severity transitive issue
- Automated test suite: not present
- Live Supabase advisors and production integrations: not tested
