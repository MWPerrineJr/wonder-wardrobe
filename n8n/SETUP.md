# Feedback pipeline setup (Tier 1)

Two n8n workflows + one database migration + one new app route turn completed
bookings into email surveys, and every piece of feedback into AI-enriched rows
the Feedback Intelligence dashboard can display.

```
booking completed ──(hourly poll)──> survey_invites row ──> email with /survey/<token> link
customer submits ──> customer_feedback (source=email_survey)
new feedback ──(5-min poll)──> LLM classification ──> sentiment/urgency/summary written back
```

## 1. Apply the migration

`supabase/migrations/20260816174023_survey_invites_and_enrichment_metadata.sql`

Push this branch to the Lovable-connected repo (Lovable applies migrations on
sync), or run it through Lovable's cloud tab. It creates:

- `survey_invites` — one row per survey email; token-gated, service-role only
- `customer_feedback.enrichment_model / enriched_at / enrichment_raw` — audit
  trail so classifications are re-runnable when the prompt or model changes
- `pending_survey_targets(lookback_days)` RPC — the "who needs a survey?"
  query, callable only by the service role

## 2. App code (already in this branch)

- `src/lib/survey.functions.ts` — public tokenized endpoints (no login needed):
  validate invite, atomically claim it, insert feedback as `email_survey`
- `src/routes/survey.$token.tsx` — the survey page the email links to
- Feedback dashboard source filter now includes `web` and `email_survey`

## 3. n8n credentials (create once, Settings → Credentials)

| Credential | Type | Value |
|---|---|---|
| Supabase service role | Header Auth | Header name `apikey`, value = the **service role secret** (Lovable Cloud → Supabase settings). Never the publishable key. |
| Anthropic API | Header Auth | Header name `x-api-key`, value = your Anthropic API key |
| Gmail account | Gmail OAuth2 | Sign in with the account surveys should come from |

Environment variables on the n8n instance (Settings → Variables, or the host
environment):

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://<your-lovable-cloud-project-ref>.supabase.co` |
| `APP_URL` | Your deployed app origin, e.g. `https://thestandingchair.com` |

## 4. Import the workflows

n8n → Workflows → Import from File:

- `survey-sender.workflow.json` — hourly: RPC for completed-but-uninvited
  bookings → insert invite (unique per booking, so re-runs can't double-send)
  → email the tokenized link
- `feedback-enrichment.workflow.json` — every 5 min: fetch rows where
  `enriched_at IS NULL` → Claude classifies (fixed label vocabulary matching
  the dashboard filters) → PATCH the row. The PATCH itself re-checks
  `enriched_at=is.null`, so concurrent runs can't double-write; parse failures
  are left unenriched and retried next cycle.

After importing, open each HTTP node and select the credentials created in
step 3 (the placeholders are named `REPLACE_WITH_...`). Then activate both
workflows.

## 5. Verify end-to-end

1. Mark a test booking `completed` (with a real email you control).
2. Within the hour (or run the sender manually) you get the survey email.
3. Submit the survey → row appears in `customer_feedback` with
   `source = 'email_survey'`.
4. Within 5 minutes the enrichment run fills `sentiment_label`, `urgency`,
   `summary`, `recommended_response`, `enriched_at`.
5. The Feedback Intelligence dashboard now shows badges and KPIs for the row.

## Design notes

- **Why polling instead of database webhooks?** Lovable Cloud doesn't expose
  the Supabase dashboard's webhook config. Polling on
  `customer_feedback_unenriched_idx` (a partial index on `enriched_at IS NULL`)
  is cheap, needs no dashboard access, and gives retries for free. If you later
  get webhook access, point it at an n8n Webhook trigger and drop the schedule.
- **Why store `enrichment_raw` + `enrichment_model`?** So you can measure
  classifier quality against human labels later, and re-run enrichment for
  old rows when you improve the prompt — standard MLOps hygiene.
- **Token security**: invite tokens are random uuids that exist only in a
  service-role-only table and the recipient's inbox; the app validates and
  single-uses them server-side. Expired links degrade gracefully.
- **Idempotency**: unique partial index = one invite per booking; atomic
  claim on `responded_at` = one feedback row per invite; `enriched_at`
  filter on PATCH = one enrichment per row.
