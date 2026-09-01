# Customer feedback + Google reviews

Everything runs inside the app. The old n8n workflows were removed — running both
would double-spend AI calls on the same rows.

## Flow

1. A booking is marked `completed`.
2. **`/api/public/jobs/send-surveys`** (hourly) finds completed bookings that ended
   24–72h ago with no invite yet, creates a `survey_invites` row, and emails the
   customer a link to `/survey/<token>`.
3. The customer rates 1–5 and writes a comment. 4–5 stars → they're invited to post
   a Google review (shop's **Google review link**). 1–3 stars stays private so the
   owner can fix it first.
4. **`/api/public/jobs/enrich-feedback`** (every 5 min) analyses new feedback:
   sentiment, emotion, urgency, summary, key phrases, suggested reply.
5. **`/api/public/jobs/build-reports`** (daily 06:30 UTC) writes a rolling 90-day
   report per subscribed shop: praise themes, complaint themes, improvement
   suggestions. Owners can also hit **Refresh report** on Feedback Intelligence.

Model: `openai/gpt-5.6-sol` via the Lovable AI Gateway.

## Safety rails

Each job takes a single-flight lease in `ai_job_state`, processes a bounded batch,
and pauses itself on a billing/policy denial — then probes with a single item per
run until it recovers.

Survey delivery selects **new** invitations and retryable `pending` / `failed` /
`blocked` rows. Each invite keeps one idempotency key (`survey-invite-<token>`),
an attempt count, last/next attempt timestamps, and a sanitized error. After 8
failures the row is `dead_letter`. Owners can inspect `survey_invite_delivery_problems`
(or the extra columns on the invite list) for stuck mail.

AI enrichment stores per-row `enrichment_status` (`pending` / `failed` / `done` /
`dead_letter`) with exponential backoff so a gateway outage does not hammer the
same 10 rows. Daily caps default to 200 enrichments and 40 reports
(`AI_MAX_ENRICH_PER_DAY`, `AI_MAX_REPORTS_PER_DAY`). Jobs emit a `job.alert` log
when they stay paused for more than an hour or fail five items in a row.

## Schedules

`pg_cron` calls `public.invoke_feedback_job(job_slug)`, which POSTs to the job
routes with `Authorization: Bearer <JOB_SECRET>`. The public Supabase key is
not accepted. Slugs: `send-surveys`, `enrich-feedback`, `build-reports`,
`booking-maintenance` (expire unpaid holds + Google Calendar outbox).

Set these before the jobs will run:

1. Deployment secret `JOB_SECRET` — `openssl rand -base64 32` (32+ characters).
   Put it in `.env.local` / the host secret store. Do not commit it.
2. The same value in Supabase Vault as name `job_secret`:
   `select vault.create_secret('paste-the-secret', 'job_secret');`
3. Public app origin in `app_runtime_settings`:
   `insert into public.app_runtime_settings (key, value) values ('app_url', 'https://your-app.example')
    on conflict (key) do update set value = excluded.value, updated_at = now();`

Inspect schedules with `select jobname, schedule from cron.job;`. After rotating
`JOB_SECRET`, update the Vault secret to match; cron already reads Vault at
run time.

To rotate: generate a new secret, update the deployment env, then
`select vault.update_secret((select id from vault.secrets where name = 'job_secret'), 'new-secret');`
Verify one job with a Bearer header, then discard the old secret.

## Owner setup

Owner dashboard → Shop details → **Google review link**: paste the Google
"write a review" URL. Without it, happy customers just see a thank-you.

## Email

Survey emails require an email domain configured for the project. Until then
`/api/public/emails/survey-invite` answers 501 and each invite is stored with
`email_status = 'blocked'` and retried with backoff until email is live or the
invite is dead-lettered.
