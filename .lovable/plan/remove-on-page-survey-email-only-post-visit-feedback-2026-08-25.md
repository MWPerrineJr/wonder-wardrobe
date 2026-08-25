# Remove on-page survey; email-only post-visit feedback

Clients no longer see a feedback/survey form on the shop page. Instead, one day after their appointment they get an email with a survey link — and only happy clients (4-5 stars) are asked to post a Google review.

## What changes for a client

- The "Leave feedback" panel on each shop page is removed. Booking a appointment never shows a survey in the browser.
- ~24 hours after the appointment ends, the client receives the existing "How was your visit?" email with a private survey link (no login needed).
- After submitting: 4-5 stars shows the "Review on Google" button (only if the owner set their Google review link); 1-3 stars stays private with the owner. This behavior already exists on the survey page and is unchanged.

## What changes for the owner

- Nothing to manage differently: owners still set the Google review link in shop settings, and Feedback Intelligence still shows every response with AI analysis.

## Work items

1. **Remove the in-browser survey**
   - Remove the `FeedbackForm` panel from `src/routes/shop.$slug.tsx` (import + sidebar render).
   - Delete `src/components/feedback-form.tsx` and the now-unused `submitFeedback` server function in `src/lib/feedback.functions.ts` (verified: nothing else uses them).

2. **Make the email trigger automatic**
   - Today the hourly send job only emails bookings a provider manually marked `completed`. Update the `pending_survey_targets` database function (one migration) so any booking that ended 24-72h ago and wasn't cancelled / no-show gets an invite — no manual step needed. One invite per booking is already enforced, so nothing can double-send.

3. **Enable actual email delivery (needs your action)**
   - No sender domain is configured for this project yet, so survey emails currently can't go out (invites are safely stored as "blocked" and can be re-notified later).
   - After the code changes, I'll open the email domain setup dialog so you can connect a domain you own (e.g. notify@yourdomain.com). Once verified, the hourly job starts sending automatically.

## Technical notes

- Touched files: `src/routes/shop.$slug.tsx`, `src/components/feedback-form.tsx` (deleted), `src/lib/feedback.functions.ts`, one new Supabase migration updating `pending_survey_targets`.
- Unchanged: `src/routes/api/public/jobs/send-surveys.ts`, `src/routes/survey.$token.tsx`, `src/lib/survey.functions.ts`, `src/lib/survey-email.server.ts`, owner Google-review-link field, Feedback Intelligence page.

## Verification

- Shop page renders without the feedback panel; build passes.
- Seed/complete a booking ending ~36h ago with a non-completed status, run the send job, confirm an invite row is created (email marked blocked until the domain is set up).
- Submit the survey at 5 stars (Google button appears) and 2 stars (private thank-you) via the tokenized page.
