# Operations runbook — The Standing Chair

Everything an operator needs to run, watch, and recover this deployment.

## 1. Endpoints

| Path | Auth | Purpose |
|---|---|---|
| `/api/public/health` | none | Liveness. Always `200` while the worker runs. |
| `/api/public/ready` | none | Readiness. `200` when payments, `APP_URL`, `JOB_SECRET` and the database are all usable; `503` with an `issues[]` list of names otherwise. |
| `/api/public/jobs/send-surveys` | `Authorization: Bearer $JOB_SECRET` | Hourly post-visit survey dispatch. |
| `/api/public/jobs/enrich-feedback` | bearer | AI sentiment/suggestion enrichment. |
| `/api/public/jobs/build-reports` | bearer | Daily shop reports. |
| `/api/public/jobs/booking-maintenance` | bearer | Every 5 min: expire unpaid holds, retry failed survey emails, drain the calendar outbox. |
| `/api/public/payments/webhook` | Stripe signature | Payment ledger + booking payment state. |
| `/lovable/email/auth/webhook` | provider hook secret | Branded auth emails. |
| `/owner/diagnostics` | shop owner sign-in | Human-readable view of everything below. |

Uptime monitors should watch `/api/public/health` (page on failure) and
`/api/public/ready` (warn on failure — the app is up but misconfigured).

## 2. Required configuration

Server secrets: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `JOB_SECRET`, `PAYMENTS_ENV`
(`sandbox` | `live`), `STRIPE_SANDBOX_API_KEY` / `STRIPE_LIVE_API_KEY`,
`PAYMENTS_SANDBOX_WEBHOOK_SECRET` / `PAYMENTS_LIVE_WEBHOOK_SECRET`,
`LOVABLE_API_KEY`, `GOOGLE_MAPS_API_KEY`,
`GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY`,
`APP_USER_CONNECTION_KEY_SECRET`.

Database-side: `vault` secret `job_secret` (same value as `JOB_SECRET`) and
`public.app_runtime_settings.app_url` (the origin cron should call). Set both
with:

```sql
select public.provision_job_scheduler('<job secret>', 'https://thestandingchair.com');
```

`JOB_SECRET` must be ≥32 chars and must never equal the publishable key —
`src/lib/jobs.auth.ts` fails closed on both.

## 3. Scheduled jobs

```text
send-surveys         hourly        0 * * * *
enrich-feedback      every 5 min   */5 * * * *
build-reports        daily 06:30   30 6 * * *
booking-maintenance  every 5 min   */5 * * * *
```

All four are scheduled through `public.invoke_feedback_job(slug)`, which reads
the destination from `app_runtime_settings` and the token from the vault — no
URL or credential is stored in a cron command.

Inspect / repoint:

```sql
select jobname, schedule, command from cron.job order by jobname;
update public.app_runtime_settings set value = 'https://<new-origin>' where key = 'app_url';
```

Each job takes a lease in `public.ai_job_state`, so overlapping runs are
skipped rather than duplicated. To pause one:

```sql
update public.ai_job_state
   set status = 'paused', paused_reason = 'incident #123'
 where job_name = 'enrich-feedback';
```

Resume by setting `status = 'active'` and `paused_reason = null`.

## 4. Logging

The worker writes one JSON object per line (`src/lib/log.ts`), redacting
bearer tokens, Stripe keys, Supabase keys and JWT-shaped values. Alert on:

- `"level":"error"` — anything unexpected.
- `"event":"job.alert"` — dead-lettered survey email or calendar sync.
- `"event":"webhook.failed"` — payment event left for Stripe to retry.

Every response carries `x-request-id` (inbound value reused when present) —
quote it in support threads.

## 5. Recovery playbooks

**Payments show as not ready.** `/api/public/ready` lists the missing names.
Set them, redeploy, re-check. Never "fix" it by flipping `PAYMENTS_ENV` — the
declared environment must match the credentials.

**Webhook events stuck in `processing`.** They hold a claim from a crashed
attempt; Stripe retries automatically. If a row is older than an hour:

```sql
update public.payment_events set status = 'pending', claimed_at = null
 where status = 'processing' and created_at < now() - interval '1 hour';
```

Then replay the event from the Stripe dashboard. Handling is idempotent by
provider event id.

**A booking is paid but still `pending`.** Replay the
`checkout.session.completed` event. The handler never downgrades a paid
booking, so replays are safe.

**Slots blocked by dead holds.** `booking-maintenance` expires them every 5
minutes. Force it: `select public.expire_stale_booking_holds();`

**Calendar events missing.** Check `booking_calendar_outbox`:

```sql
select status, count(*) from public.booking_calendar_outbox group by 1;
update public.booking_calendar_outbox
   set status = 'pending', attempts = 0, next_attempt_at = now()
 where status = 'failed';
```

A provider who revoked Google access must reconnect from the owner
dashboard's Calendar tab; retries cannot fix a revoked grant.

**Surveys not arriving.** `delivery_terminal = true` rows exhausted five
attempts. Confirm the sender domain is verified, then reset:

```sql
update public.survey_invites
   set delivery_terminal = false, email_attempts = 0, next_attempt_at = now()
 where delivery_terminal and responded_at is null and expires_at > now();
```

**Full rollback.** Redeploy the previous build; migrations in this project are
additive, so no schema rollback is required. If a release must be neutralised
fast, pause the jobs above and set `PAYMENTS_ENV=sandbox` to stop taking money.

## 6. Release checklist

1. `/api/public/ready` returns `200` on the target deployment.
2. `app_runtime_settings.app_url` equals the live origin (diagnostics flags a
   mismatch).
3. An unauthenticated `POST` to a job path returns `401`; with the bearer,
   `200`.
4. Stripe webhook endpoint registered for the active environment; send a test
   event and confirm a `payment_events` row.
5. A booking, a payment, and a cancellation complete end to end.
6. `/owner/diagnostics` shows zero failed webhooks and no dead letters.
