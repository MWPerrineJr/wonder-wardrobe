# Production-ready playbook — verified state and execution plan

I checked the actual project tree and the live backend before writing this. The brief assumes "phases 1–10 are already in Git"; that is only partly true for what this editor holds.

## Verified now

| Item | State |
|---|---|
| Cron jobs | 3 jobs, all `SELECT public.invoke_feedback_job(...)` — the old publishable-key `http_post` commands are gone |
| Vault `job_secret` | Exists |
| `app_runtime_settings.app_url` | `https://thestandingchair.com` |
| `payment_events` ledger, webhook idempotency, return-path validation, booking holds (`expire_stale_booking_holds`) | In code and applied |
| Secrets present | `JOB_SECRET`, `APP_URL`, `PAYMENTS_ENV`, both Stripe connections, both webhook secrets, Maps, Calendar connector, connection key, `LOVABLE_API_KEY` |
| `health.ts`, `ready.ts`, `jobs/booking-maintenance.ts` | **Missing** |
| `/owner/diagnostics` | **Missing** |
| `src/lib/log.ts`, `docs/OPERATIONS.md`, `docs/UPGRADES.md` | **Missing** |
| `booking_calendar_outbox` table + `booking-maintenance` cron job | **Missing** |
| `validate_booking` | Exists as the overlap trigger but is **not** `SECURITY DEFINER` |
| `VITE_PAYMENTS_ENV` | **Not set**; `PAYMENTS_ENV` is currently `live` |

So the missing Phase 7–10 pieces will be built here as new commits (no history rewrite), then configuration and verification follow.

## Part A — build the missing pieces

1. `src/lib/log.ts` — JSON-line logger with redaction of `Authorization`, `JOB_SECRET`, Stripe secrets; `x-request-id` propagation.
2. `src/routes/api/public/health.ts` — always-200 liveness with `{status:"ok"}`; never touches payments config.
3. `src/routes/api/public/ready.ts` — readiness: Supabase reachable, payments config complete, job secret sane. 200 `{status:"ok",payments:"ok"}` or 503 with a machine-readable `issues` array (names only, no values).
4. `src/routes/api/public/jobs/booking-maintenance.ts` — `JOB_SECRET`-authenticated: expires stale holds via `expire_stale_booking_holds()`, retries failed survey invites via `pending_survey_retries()`, drains the calendar outbox.
5. `/owner/diagnostics` (owner-only route) — payments env + readiness, Stripe connection/webhook secret configured, webhook counts (completed 24h / processing / failed), cron job list and last run, calendar outbox pending, email domain status. Never renders secret values.
6. Migration (new, additive): `booking_calendar_outbox` table (service_role only, RLS on, no client policies), `validate_booking` recreated as `SECURITY DEFINER` with fixed `search_path`, `invoke_feedback_job` slug allowlist extended with `booking-maintenance`, and the fourth cron job scheduled `*/5 * * * *`.
7. Response headers on published responses: `x-request-id`, CSP, `referrer-policy`, `x-content-type-options`.
8. `docs/OPERATIONS.md` (runbook: probes, log alerts, backups, rollback) and `docs/UPGRADES.md` (pinned `@react-email/*` and `recharts` with reasons).

No changes to generated Supabase files, `routeTree.gen.ts`, or `n8n workflow/`.

## Part B — configuration (sandbox first)

- Set `PAYMENTS_ENV=sandbox` and `VITE_PAYMENTS_ENV=sandbox`; leave live names untouched until the end.
- Confirm `APP_URL` matches the origin actually serving the worker; add preview origins to `APP_URL_ALLOWLIST` if Stripe returns must hit a preview host.
- Auth: confirmations on / auto-confirm off, Google enabled, redirect URLs for apex, www, preview, plus `/auth`, `/reset-password`, `/oauth/google-calendar/return`.
- Email: confirm `notify.pandagentic.ai` verification; if still pending, hand you the exact DNS records and stop email feature work there.
- Maps: verify server key, Embed API enabled, referrer list covers apex, www, `*.lovable.app`.
- Calendar: verify connector redirect URI, scopes, offline access; do not rotate `APP_USER_CONNECTION_KEY_SECRET`.

## Part C — verification (evidence, not assertions)

- `/api/public/health` 200, `/api/public/ready` 200 with `payments:"ok"`; `/` and `/auth` render.
- Jobs: publishable key → 401, real `JOB_SECRET` → 2xx, for all four job routes.
- `select public.invoke_feedback_job('booking-maintenance')` returns a request id.
- Cron listing shows four jobs, all via `invoke_feedback_job`.
- Sandbox Stripe: `4242…` checkout → webhook delivered, ledger row `processed`, replay is a no-op duplicate; unpaid checkout does **not** confirm a booking and the hold expires.
- Overlapping booking for the same provider is rejected.
- Survey invite send + `/survey/{token}` single use.
- Supabase advisors run; each remaining finding explained (locked internal tables and intentional `SECURITY DEFINER` stay as they are).
- `curl -sI` on the published origin for `x-request-id`, CSP, referrer-policy, nosniff, HSTS.

## Part D — go-live (only on your explicit go-ahead)

Live webhook `?env=live`, then set `PAYMENTS_ENV=live`, `VITE_PAYMENTS_ENV=live`, live client token and webhook secret together, `APP_URL=https://thestandingchair.com`, confirm `app_runtime_settings.app_url` matches `CANONICAL_ORIGIN`, diagnostics shows live + Ready. No real charge without your authorization.

## Human actions I cannot do

DNS records (apex/www, `notify.pandagentic.ai`), Stripe identity verification, Google Cloud console changes (Embed API, referrers, OAuth client, consent publish), the external uptime monitor account, and Supabase backup/PITR confirmation. I will hand these to you as a punch list with exact values.

## Reporting

I finish with a section-by-section status table (done / blocked / skipped + reason) and the outstanding human punch list. Nothing is marked production-ready while `/api/public/ready` is 503 or a job route accepts the publishable key.
