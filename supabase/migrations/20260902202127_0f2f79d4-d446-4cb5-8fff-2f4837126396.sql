-- Bring the database in line with code that was shipped ahead of its schema.

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  stripe_event_id text PRIMARY KEY,
  environment text NOT NULL CHECK (environment IN ('sandbox', 'live')),
  event_type text NOT NULL,
  stripe_created_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('processing', 'completed', 'failed', 'ignored')),
  attempts integer NOT NULL DEFAULT 1,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stripe_webhook_events_status_idx
  ON public.stripe_webhook_events (status, created_at DESC);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_webhook_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.stripe_webhook_events TO service_role;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS last_stripe_event_at timestamptz;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS amount_due_cents integer,
  ADD COLUMN IF NOT EXISTS payment_environment text;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_payment_environment_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_environment_check
  CHECK (payment_environment IS NULL OR payment_environment IN ('sandbox', 'live'));

ALTER TABLE public.ai_job_state
  ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS items_today integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS items_on_date date;

ALTER TABLE public.booking_calendar_outbox
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;

UPDATE public.booking_calendar_outbox
SET attempt_count = attempts
WHERE attempt_count = 0 AND attempts > 0;