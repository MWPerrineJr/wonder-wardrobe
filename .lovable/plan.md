# Customer feedback + Google review system

Turn completed appointments into a next-day review request, analyze every response with AI, and give owners a sentiment report with concrete improvement suggestions. It runs inside the app — no n8n, no Gmail, no third-party AI key.

## How it works for a client

1. A day after their appointment ends, the customer gets an email from the shop: "How was your visit with <provider> at <shop>?" with a 1-5 star row that links into the app.
2. The link opens the existing private survey page (token in the link, no login needed) where they pick a rating and write a comment.
3. After they submit:
   - 4-5 stars: thank-you screen with a prominent "Leave a Google review" button pointing at the shop's Google review link.
   - 1-3 stars: thank-you screen saying the owner will follow up privately — no Google prompt.

This keeps every visit's feedback private-first while sending happy customers to Google, so the public rating is protected.

## How it works for the owner

- New **Google review link** field in shop settings. If it's empty, emails and thank-you screens simply omit the Google ask. A short helper explains where to find the link.
- Feedback Intelligence page (subscription tier, gating unchanged) gains:
  - Per-review AI analysis: sentiment, emotion, urgency, one-line summary, key phrases, and a suggested reply — the fields the dashboard already renders, now filled by the app itself.
  - A new **Shop report** panel: rolling summary with overall sentiment trend, top praise themes, top complaint themes, and a ranked list of improvement suggestions with the evidence behind each. Regenerates on demand and as new reviews arrive.
- Delivery visibility: an invite list showing who was emailed, who responded, and any send failures.

## Timing and safeguards

- Reminders go to bookings marked `completed` whose end time is 24-72 hours ago, one invite per booking ever, max 25 per run.
- Free-tier shops still get survey emails and the Google prompt; the AI analysis and report stay on the subscription tier.
- Every send and analysis is recorded before the next item is processed, so retries never double-send or double-charge.

## Technical plan

### Database (one migration)
- `shops.google_review_url text` (nullable, `https://` validated on write).
- `survey_invites`: add `rating_hint smallint`, `email_status text default 'pending'`, `email_error text`, `emailed_at timestamptz`. Service-role-only grants stay.
- `feedback_reports`: `id, shop_id, window_start, window_end, overall_sentiment numeric, summary text, praise_themes jsonb, complaint_themes jsonb, suggestions jsonb, model text, feedback_count int, created_at`. GRANT SELECT to `authenticated`, ALL to `service_role`; RLS policy: shop owner can select.
- `ai_job_state`: `job_name text primary key, status text, paused_reason text, lease_until timestamptz, last_run_at timestamptz` — single-flight lease plus 402/403 circuit breaker. `service_role` only.
- Replace `pending_survey_targets(lookback_days)` with a version returning completed bookings whose `ends_at` is 24-72h old and have no invite, joined to shop name, provider name, customer email and `google_review_url`. Security definer, service-role execute only.

### Email
- Provision transactional email for the project and scaffold a `survey-invite` template (branded, shop name in the from-name, 5 star links to `/survey/<token>?r=<n>`, address in the footer). Sends log to `email_send_log`.

### Scheduled server routes (pg_cron calls these)
- `src/routes/api/public/jobs/send-surveys.ts` — shared-secret header check, acquire lease from `ai_job_state`, call the RPC, insert invite, send email, mark `email_status`, cap 25 per run.
- `src/routes/api/public/jobs/enrich-feedback.ts` — same guard/lease; up to 10 rows where `enriched_at is null`, one Lovable AI call each (`openai/gpt-5.6-sol`) with a strict schema for sentiment/urgency/summary/key phrases/suggested reply, written back with an `enriched_at is null` re-check. Halts and records `paused_reason` on 402/403, backs off on 429, resumes via a single probe item on a later run.
- `src/routes/api/public/jobs/build-reports.ts` — for each shop with an active analytics subscription and new feedback, generate the rolling report into `feedback_reports`.
- Cron entries registered in the migration with `pg_cron` + `pg_net` against the stable project URL, authorized by a new `JOB_SHARED_SECRET`.

### App code
- `src/lib/ai.server.ts` — Lovable AI Gateway provider helper (streamed, run-id aware).
- `src/lib/feedback-analysis.server.ts` — per-review and per-shop prompts and schemas.
- `src/lib/survey.functions.ts` — accept the rating prefill; after submit return `{ googleReviewUrl, promptGoogle: rating >= 4 }`.
- `src/routes/survey.$token.tsx` — prefill stars from `?r=`, two thank-you paths.
- `src/lib/owner.functions.ts` + `src/routes/_authenticated/owner.tsx` — Google review URL field, invite delivery list.
- `src/lib/feedback.functions.ts` + `src/routes/_authenticated/owner_.feedback.tsx` — latest report fetch, "Regenerate report" action, Shop report panel.
- Remove the two `n8n/*.workflow.json` files and replace `n8n/SETUP.md` with `docs/FEEDBACK-PIPELINE.md` describing the in-app pipeline.

### Verification
Seed a completed booking ~36h old, run the send job, confirm the invite row and email log entry, submit through the tokenized page at 5 stars and at 2 stars to check both thank-you paths, run the enrichment and report jobs, and confirm the dashboard renders the analysis and suggestions.