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
marks progress per row, and pauses itself on a billing/policy denial — then probes
with a single item per run until it recovers.

## Schedules

`pg_cron` calls the three routes with the project's publishable key in an `apikey`
header. Inspect with `select jobname, schedule from cron.job;`.

## Owner setup

Owner dashboard → Shop details → **Google review link**: paste the Google
"write a review" URL. Without it, happy customers just see a thank-you.

## Email

Survey emails require an email domain configured for the project. Until then
`/api/public/emails/survey-invite` answers 501 and each invite is stored with
`email_status = 'blocked'`, so nothing is lost — once email is live those
customers can be re-notified.
