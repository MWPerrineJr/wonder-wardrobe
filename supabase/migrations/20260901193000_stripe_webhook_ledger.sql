-- Ledger for Stripe webhook deliveries: unique event id, attempt tracking,
-- and a status that lets retries stay idempotent.

CREATE TABLE public.stripe_webhook_events (
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

CREATE INDEX stripe_webhook_events_status_idx
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
