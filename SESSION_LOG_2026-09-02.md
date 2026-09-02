# The Standing Chair — Session Log

**Session dates:** September 1–2, 2026  
**Repository:** `MWPerrineJr/wonder-wardrobe`  
**Reviewed branch:** `main`  
**Starting commit:** `a3de453` (`Audited GitHub export deps`)

## Objective

Review The Standing Chair application for errors, logic defects, security weaknesses, and deployment-readiness risks; produce a prioritized remediation plan suitable for implementation in Cursor; and explain the remaining external deployment tasks.

## Work completed

### 1. Repository and architecture review

- Cloned the GitHub repository into the local Codex workspace.
- Read the repository's `AGENTS.md` instructions and preserved Lovable's published Git history.
- Mapped the application architecture and deployment-sensitive integrations:
  - TanStack Start and React
  - Cloudflare/Nitro deployment output
  - Supabase Auth, Database, RLS, RPCs, migrations, `pg_cron`, and `pg_net`
  - Stripe subscriptions, Connect payouts, booking payments, refunds, and webhooks
  - Google OAuth and Calendar integration
  - Google Maps Embed and planned browser Places integration
  - Lovable email and AI connector workflows
  - Scheduled survey, feedback-enrichment, and report-generation jobs

### 2. Local verification

The following checks were run against the reviewed checkout:

| Check                         |        Result | Notes                                                                                       |
| ----------------------------- | ------------: | ------------------------------------------------------------------------------------------- |
| Production build              |        Passed | Generated Cloudflare-module Nitro output                                                    |
| TypeScript (`tsc --noEmit`)   |        Passed | No compilation errors                                                                       |
| Clean install (`npm ci`)      |        Failed | `package.json` and `package-lock.json` are out of sync                                      |
| Lint                          |        Failed | 1,739 findings: 1,722 errors and 17 warnings; predominantly formatting                      |
| Dependency audit              |       Warning | One low-severity transitive `esbuild` advisory; no moderate, high, or critical findings     |
| Automated tests               |   Unavailable | No test script or test suite was present                                                    |
| CI workflow                   |   Unavailable | No repository CI workflow was present                                                       |
| Live integration verification | Not performed | Production credentials, live Supabase access, and external account access were not supplied |

The production build automatically modified generated file `src/routeTree.gen.ts`. No manual application-code fixes were made during this review.

### 3. Deployment-readiness findings

The app was assessed as **not ready for production deployment**.

#### P0 release blockers

1. **Scheduled-job authentication uses a public Supabase key.**
   - `src/lib/jobs.server.ts` accepts `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY` as job authentication.
   - The publishable key and environment-specific Lovable URLs are embedded in cron migrations.
   - Anyone with the public key could trigger service-role-backed email and AI jobs.

2. **Clean, reproducible installation is broken.**
   - `npm ci` fails because the npm lockfile does not match `package.json`.
   - Both npm and Bun lockfiles exist without one declared package-manager standard.

#### P1 high-priority risks

- Stripe webhook handlers log database failures but still acknowledge delivery, preventing Stripe retries.
- Webhooks lack a durable event ledger for idempotency and event ordering.
- `checkout.session.completed` may confirm a booking without explicitly verifying that the session is paid.
- Failed survey emails are recorded but excluded from future job runs, so they are never retried.
- Booking, subscription, billing-portal, and Stripe Connect flows accept unrestricted client-provided return URLs.
- The provider self-update RLS policy does not restrict changes to sensitive columns such as `shop_id`, `user_id`, or `is_active`.

#### P2 correctness and operations risks

- Booking creation, Stripe Checkout creation, database updates, and calendar synchronization are not atomic or outbox-driven.
- A failed Checkout operation can leave a pending booking holding an appointment slot.
- Payment mode is inferred from whether a live Stripe key exists instead of an explicit `PAYMENTS_ENV` setting.
- Cron migrations contain deployment-specific infrastructure configuration.
- There is no automated RLS, payment, concurrency, retry, timezone, or browser regression suite.
- There is no repository-owned health endpoint in the reviewed checkout.
- Structured monitoring, webhook/job dashboards, backup restore testing, and rollback documentation need verification or implementation.
- Deprecated React Email packages, Recharts 2.x, and a low-severity `esbuild` advisory require planned maintenance.

### 4. Remediation plan created

Created `DEPLOYMENT_FIX_PLAN.md` in the repository root. It contains:

- A phased implementation plan ordered by criticality
- Affected systems and files
- Required security and correctness changes
- Tests and acceptance criteria for each phase
- A production go-live checklist

The prescribed implementation order is:

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

### 5. External deployment guidance provided

Guidance was provided for the remaining account-level tasks that cannot be completed through a code-only review:

#### Google Maps

- Restrict the map-embed key to approved website referrers.
- Permit the production domain, optional `www` domain, required Lovable preview domains, and localhost only during development.
- Restrict that key to Maps Embed API.
- Use a separate browser key for Maps JavaScript API and Places API (New).
- Confirmed that the current reviewed code checks for `VITE_GOOGLE_MAPS_BROWSER_KEY` but does not yet initialize Places autocomplete.

#### Google OAuth

- Configure production branding, support email, homepage, privacy policy, terms, authorized domain, audience, scopes, and production redirect URIs.
- Publish the consent screen from Testing to In production.
- Submit verification if the requested Google Calendar scopes require it.
- Noted that dedicated privacy-policy and terms routes were not found in the reviewed checkout and should be present before verification.

#### Uptime monitoring

- Recommended a public `GET /api/public/health` endpoint that returns a minimal, non-sensitive 200 response.
- Recommended monitoring every one to five minutes with status/body checks and alerts after consecutive failures.
- Confirmed that `/api/public/health` was not present in the reviewed checkout.

#### Supabase backups and PITR

- Directed verification through Supabase Dashboard → Database → Backups.
- Explained the distinction between daily backups and Point-in-Time Recovery.
- Noted that database backups do not restore deleted Storage objects.
- Recommended enabling PITR if the business cannot tolerate up to roughly 24 hours of database loss.
- Recommended performing restoration tests in a staging/recovery project rather than overwriting production.

## Files created

- `DEPLOYMENT_FIX_PLAN.md` — implementation backlog and go-live criteria
- `SESSION_LOG_2026-09-02.md` — this session record

A separate detailed review was also saved in the surrounding Codex workspace under `outputs/deployment-readiness-review.md`; it is not currently part of the Git repository.

## Repository state at log creation

```text
Branch: main, tracking origin/main
Modified: src/routeTree.gen.ts
Untracked: DEPLOYMENT_FIX_PLAN.md
Untracked: SESSION_LOG_2026-09-02.md
```

No commit or push was performed.

## Recommended next action

Create a remediation branch and begin with Phase 1 in `DEPLOYMENT_FIX_PLAN.md`: replace public-key scheduled-job authentication with a dedicated secret stored outside Git. Commit the plan and session log separately from generated build output and application-code fixes.
