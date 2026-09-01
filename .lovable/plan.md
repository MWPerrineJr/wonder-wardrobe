# Go-live checklist + fix the release blockers

Your latest Git commits (JOB_SECRET job auth, deployment fix plan) are in the workspace and the tree is clean. I checked the live backend against them and found the Phase 1 work is **in code but not activated**.

## What I verified just now

| Check | State |
|---|---|
| Email sender `notify.pandagentic.ai` | Verified, auth emails enabled |
| Security scans | No open findings |
| `JOB_SECRET` in project secrets | **Missing** — all three job endpoints will refuse every call (503) |
| `APP_URL` in env | **Not set** — survey email dispatch returns "blocked" |
| Migration `20260901190000_secure_job_scheduler.sql` | **Not applied** — `app_runtime_settings` and `invoke_feedback_job()` do not exist in the database |
| Live cron jobs | Still POST the **public publishable key** to the dev project URL |

So today: surveys, AI feedback enrichment, and daily reports are all effectively dead in production, and the old insecure cron commands are still scheduled.

## Deliverable 1 — Go-live checklist document

Write `LOVABLE_GO_LIVE.md` to your documents (downloadable) covering only what has to be configured in Lovable/hosting:

- Secrets that must exist and what each one is for, flagging the missing `JOB_SECRET`
- Env values: `APP_URL`, payments client token (test vs live), optional `LOVABLE_SEND_URL`
- Database: migrations to apply, `pg_cron` + `pg_net`, the three cron schedules and how to repoint them at the live domain
- Webhooks to register: Stripe payments webhook, auth email hook
- Auth: email confirmation on, Google provider, the exact redirect URLs
- Domains: `thestandingchair.com` + `www`, published Lovable URL, `notify.pandagentic.ai`, canonical origin in `src/lib/site-origin.ts`
- Payments go-live: sandbox vs live keys and webhook secrets, Connect onboarding
- Post-deploy smoke checks with pass criteria for each

## Deliverable 2 — Fix the blockers

1. Generate a high-entropy `JOB_SECRET` and store it as a project secret (never in code or migrations).
2. Store the same value as the Vault secret `job_secret` that `invoke_feedback_job()` reads.
3. Set `APP_URL` to the live origin so survey links and job callbacks resolve.
4. Apply `20260901190000_secure_job_scheduler.sql` so `app_runtime_settings` + `invoke_feedback_job()` exist and the three cron jobs are rescheduled without the publishable key.
5. Set `app_runtime_settings.app_url` to the live domain (`https://thestandingchair.com`).
6. Verify: the old cron commands are gone, a call without the bearer token returns 401, and one with it returns 200.

## Technical notes

- `src/lib/jobs.auth.ts` already fails closed on a missing/short secret or a secret equal to the publishable key, so nothing in the request path needs changing — only configuration and the migration.
- The migration reads the destination URL from `public.app_runtime_settings` and the token from `vault.decrypted_secrets`, so no credential or environment URL is written into SQL.
- Deeper phases from `DEPLOYMENT_FIX_PLAN.md` (webhook idempotency ledger, return-URL allowlist, provider RLS column freeze, job retries, booking holds) stay out of scope here and remain listed in that file.
