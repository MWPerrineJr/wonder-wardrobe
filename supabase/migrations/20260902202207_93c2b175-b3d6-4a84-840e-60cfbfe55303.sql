ALTER TABLE public.survey_invites
  ADD COLUMN IF NOT EXISTS email_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_next_attempt_at timestamptz;

ALTER TABLE public.survey_invites
  ADD COLUMN IF NOT EXISTS email_idempotency_key text
  GENERATED ALWAYS AS ('survey-invite-' || token::text) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS survey_invites_email_idempotency_key_idx
  ON public.survey_invites (email_idempotency_key);

ALTER TABLE public.survey_invites DROP CONSTRAINT IF EXISTS survey_invites_email_status_check;
ALTER TABLE public.survey_invites
  ADD CONSTRAINT survey_invites_email_status_check
  CHECK (email_status IN ('pending', 'sent', 'failed', 'blocked', 'dead_letter'));

CREATE INDEX IF NOT EXISTS survey_invites_retry_idx
  ON public.survey_invites (email_status, email_next_attempt_at)
  WHERE email_status IN ('pending', 'failed', 'blocked');

UPDATE public.survey_invites
SET email_next_attempt_at = now()
WHERE email_status IN ('pending', 'failed', 'blocked')
  AND email_next_attempt_at IS NULL
  AND responded_at IS NULL;

CREATE OR REPLACE VIEW public.survey_invite_delivery_problems
WITH (security_invoker = true) AS
SELECT
  id,
  shop_id,
  booking_id,
  customer_email,
  email_status,
  email_attempts,
  email_error,
  email_last_attempt_at,
  email_next_attempt_at,
  sent_at,
  expires_at
FROM public.survey_invites
WHERE email_status IN ('failed', 'blocked', 'dead_letter')
  AND responded_at IS NULL;

GRANT SELECT ON public.survey_invite_delivery_problems TO authenticated, service_role;

ALTER TABLE public.customer_feedback
  ADD COLUMN IF NOT EXISTS enrichment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS enrichment_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrichment_error text,
  ADD COLUMN IF NOT EXISTS enrichment_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS enrichment_next_attempt_at timestamptz;

UPDATE public.customer_feedback
SET enrichment_status = 'done'
WHERE enriched_at IS NOT NULL AND enrichment_status = 'pending';

ALTER TABLE public.customer_feedback DROP CONSTRAINT IF EXISTS customer_feedback_enrichment_status_check;
ALTER TABLE public.customer_feedback
  ADD CONSTRAINT customer_feedback_enrichment_status_check
  CHECK (enrichment_status IN ('pending', 'failed', 'done', 'dead_letter'));

CREATE INDEX IF NOT EXISTS customer_feedback_enrich_retry_idx
  ON public.customer_feedback (enrichment_status, enrichment_next_attempt_at)
  WHERE enrichment_status IN ('pending', 'failed');