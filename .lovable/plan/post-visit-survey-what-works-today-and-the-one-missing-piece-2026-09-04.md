# Post-visit survey: what works today and the one missing piece

The survey system does not need a rebuild. Everything is in place and running except the final step that actually hands the email off for delivery.

## Verified working right now

- The hourly survey job is alive and healthy: it last ran at 17:00 today, with no errors and no failure streak.
- The rule for who gets a survey is in place: any visit that ended 24–72 hours ago and wasn't cancelled or marked a no-show, one survey per visit, never twice.
- The private survey page works: rating, comment, and the "Review on Google" prompt for 4–5 stars only.
- The AI analysis job and the daily report job are both running clean.
- Your sending domain is verified and ready.

## The gap

The job builds the survey email and hands it to an internal delivery step that was never created. Because that step is missing, the app treats the message as "email not set up yet" and stores the invitation as blocked instead of sending. There is also no survey email design registered yet — only the owner welcome email exists.

Nothing is lost while this is broken: every blocked invitation is kept with a retry schedule and will send once delivery works.

Also worth knowing: there are currently zero bookings in the database, so even with delivery fixed nothing would go out until real appointments finish.

## Work to make it send

1. Create the survey invitation email design ("How was your visit?") in the app's email folder, matching the existing branded look, with the 1–5 star links and the private survey link.
2. Register it so the app can send it by name.
3. Create the missing delivery step the survey job calls, using the app's existing verified-domain sender.
4. Confirm the deployment has the two settings the job needs to call itself (app address and job secret) in the published environment.
5. Re-send the stored blocked invitations by letting the hourly job pick them up on its normal retry schedule.

## How I'll verify it

- Send one test survey email to an address you choose and confirm it arrives with working links.
- Open the link, submit 5 stars (Google prompt appears) and 2 stars (stays private).
- Confirm the invitation row flips from blocked to sent, and the response shows up on Feedback Intelligence with AI analysis.

## Technical notes

- Add `src/lib/email-templates/survey-invite.tsx`, register in `registry.ts`.
- Add `src/routes/lovable/email/transactional/send.ts` (POST) that validates the payload and calls `sendTemplateEmail`; `src/routes/api/public/emails/survey-invite.ts` already posts to that path and already verifies the job bearer token.
- No database migration needed; `pending_survey_targets`, retry columns, and `survey_invites` policies are already correct.
- Confirm `APP_URL` and `JOB_SECRET` (32+ chars) exist in the published environment — `sendSurveyInviteEmail` blocks without them.
