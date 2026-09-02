-- Phase 7: prepaid bookings are temporary holds. Checkout happens before
-- calendar sync. Expired holds stop occupying chairs immediately (the
-- occupancy predicate ignores hold_expires_at in the past), and a job
-- cancels those rows. No-provider-preference bookings occupy shop capacity.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS hold_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS bookings_hold_expiry_idx
  ON public.bookings (hold_expires_at)
  WHERE status = 'pending'
    AND payment_status = 'awaiting_payment'
    AND hold_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS bookings_slot_occupancy_idx
  ON public.bookings (shop_id, starts_at, ends_at)
  WHERE status IN ('pending', 'confirmed');

UPDATE public.bookings
SET hold_expires_at = created_at + interval '30 minutes'
WHERE status = 'pending'
  AND payment_status = 'awaiting_payment'
  AND hold_expires_at IS NULL;

CREATE OR REPLACE FUNCTION public.booking_occupies_slot(
  p_status public.booking_status,
  p_hold_expires_at timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p_status IN ('pending', 'confirmed')
    AND (p_hold_expires_at IS NULL OR p_hold_expires_at > now());
$$;

CREATE OR REPLACE FUNCTION public.validate_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  svc_shop uuid;
  prov_shop uuid;
  conflict_count integer;
  occupancy_count integer;
  active_providers integer;
BEGIN
  IF NEW.ends_at <= NEW.starts_at THEN
    RAISE EXCEPTION 'Appointment must end after it starts';
  END IF;

  SELECT shop_id INTO svc_shop FROM public.services WHERE id = NEW.service_id;
  IF svc_shop IS NULL OR svc_shop <> NEW.shop_id THEN
    RAISE EXCEPTION 'Selected service does not belong to this shop';
  END IF;

  IF NEW.provider_id IS NOT NULL THEN
    SELECT shop_id INTO prov_shop FROM public.providers WHERE id = NEW.provider_id;
    IF prov_shop IS NULL OR prov_shop <> NEW.shop_id THEN
      RAISE EXCEPTION 'Selected provider does not belong to this shop';
    END IF;
  END IF;

  IF public.booking_occupies_slot(NEW.status, NEW.hold_expires_at) THEN
    -- Serialize every occupying insert/update for this shop so two concurrent
    -- requests cannot both pass the occupancy checks below. Held for the rest
    -- of this transaction.
    PERFORM pg_advisory_xact_lock(hashtextextended('shop:' || NEW.shop_id::text, 0));

    SELECT count(*) INTO active_providers
    FROM public.providers p
    WHERE p.shop_id = NEW.shop_id
      AND p.is_active;

    SELECT count(*) INTO occupancy_count
    FROM public.bookings b
    WHERE b.shop_id = NEW.shop_id
      AND b.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND public.booking_occupies_slot(b.status, b.hold_expires_at)
      AND b.starts_at < NEW.ends_at
      AND b.ends_at > NEW.starts_at;

    IF occupancy_count >= GREATEST(active_providers, 0) THEN
      RAISE EXCEPTION 'No providers are free at that time';
    END IF;

    IF NEW.provider_id IS NOT NULL THEN
      SELECT count(*) INTO conflict_count
      FROM public.bookings b
      WHERE b.provider_id = NEW.provider_id
        AND b.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND public.booking_occupies_slot(b.status, b.hold_expires_at)
        AND b.starts_at < NEW.ends_at
        AND b.ends_at > NEW.starts_at;
      IF conflict_count > 0 THEN
        RAISE EXCEPTION 'That time slot is already booked for this provider';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_booking_holds()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count integer;
BEGIN
  UPDATE public.bookings
  SET
    status = 'cancelled',
    payment_status = 'failed',
    hold_expires_at = NULL
  WHERE status = 'pending'
    AND payment_status = 'awaiting_payment'
    AND hold_expires_at IS NOT NULL
    AND hold_expires_at < now();
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_booking_holds() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_booking_holds() TO postgres, service_role;

CREATE OR REPLACE FUNCTION public.restrict_customer_booking_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> OLD.customer_id THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'cancelled' OR OLD.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Customers can only cancel a pending or confirmed booking';
  END IF;

  IF NEW.shop_id IS DISTINCT FROM OLD.shop_id
    OR NEW.service_id IS DISTINCT FROM OLD.service_id
    OR NEW.provider_id IS DISTINCT FROM OLD.provider_id
    OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
    OR NEW.starts_at IS DISTINCT FROM OLD.starts_at
    OR NEW.ends_at IS DISTINCT FROM OLD.ends_at
    OR NEW.price_cents IS DISTINCT FROM OLD.price_cents
    OR NEW.customer_name IS DISTINCT FROM OLD.customer_name
    OR NEW.customer_phone IS DISTINCT FROM OLD.customer_phone
    OR NEW.notes IS DISTINCT FROM OLD.notes
    OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
    OR NEW.amount_paid_cents IS DISTINCT FROM OLD.amount_paid_cents
    OR NEW.amount_due_cents IS DISTINCT FROM OLD.amount_due_cents
    OR NEW.payment_environment IS DISTINCT FROM OLD.payment_environment
    OR NEW.refunded_cents IS DISTINCT FROM OLD.refunded_cents
    OR NEW.stripe_checkout_session_id IS DISTINCT FROM OLD.stripe_checkout_session_id
    OR NEW.stripe_payment_intent_id IS DISTINCT FROM OLD.stripe_payment_intent_id
    OR NEW.google_event_id IS DISTINCT FROM OLD.google_event_id
    OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason
    OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
    OR NEW.hold_expires_at IS DISTINCT FROM OLD.hold_expires_at
  THEN
    RAISE EXCEPTION 'Customers may only cancel their booking, not modify other fields';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.restrict_provider_booking_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = OLD.shop_id AND s.owner_id = auth.uid()
  ) THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.providers p
    WHERE p.id = OLD.provider_id AND p.user_id = auth.uid()
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.shop_id IS DISTINCT FROM OLD.shop_id
    OR NEW.service_id IS DISTINCT FROM OLD.service_id
    OR NEW.provider_id IS DISTINCT FROM OLD.provider_id
    OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
    OR NEW.starts_at IS DISTINCT FROM OLD.starts_at
    OR NEW.ends_at IS DISTINCT FROM OLD.ends_at
    OR NEW.price_cents IS DISTINCT FROM OLD.price_cents
    OR NEW.customer_name IS DISTINCT FROM OLD.customer_name
    OR NEW.customer_phone IS DISTINCT FROM OLD.customer_phone
    OR NEW.notes IS DISTINCT FROM OLD.notes
    OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
    OR NEW.amount_paid_cents IS DISTINCT FROM OLD.amount_paid_cents
    OR NEW.amount_due_cents IS DISTINCT FROM OLD.amount_due_cents
    OR NEW.payment_environment IS DISTINCT FROM OLD.payment_environment
    OR NEW.refunded_cents IS DISTINCT FROM OLD.refunded_cents
    OR NEW.stripe_checkout_session_id IS DISTINCT FROM OLD.stripe_checkout_session_id
    OR NEW.stripe_payment_intent_id IS DISTINCT FROM OLD.stripe_payment_intent_id
    OR NEW.google_event_id IS DISTINCT FROM OLD.google_event_id
    OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason
    OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
    OR NEW.hold_expires_at IS DISTINCT FROM OLD.hold_expires_at
  THEN
    RAISE EXCEPTION 'Providers can only update booking status';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.booking_calendar_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES public.providers(id) ON DELETE CASCADE,
  action text NOT NULL DEFAULT 'upsert' CHECK (action IN ('upsert', 'delete')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  CONSTRAINT booking_calendar_outbox_booking_id_key UNIQUE (booking_id)
);

CREATE INDEX IF NOT EXISTS booking_calendar_outbox_due_idx
  ON public.booking_calendar_outbox (next_attempt_at)
  WHERE processed_at IS NULL;

ALTER TABLE public.booking_calendar_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booking_calendar_outbox FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.booking_calendar_outbox TO service_role;

INSERT INTO public.ai_job_state (job_name, status)
VALUES ('booking-maintenance', 'idle')
ON CONFLICT (job_name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.invoke_feedback_job(job_slug text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  app_url text;
  secret text;
  request_id bigint;
BEGIN
  IF job_slug NOT IN ('send-surveys', 'enrich-feedback', 'build-reports', 'booking-maintenance') THEN
    RAISE EXCEPTION 'unknown job %', job_slug;
  END IF;

  SELECT s.value INTO app_url
  FROM public.app_runtime_settings s
  WHERE s.key = 'app_url';

  IF app_url IS NULL OR btrim(app_url) = '' THEN
    RAISE EXCEPTION 'app_runtime_settings.app_url is not set';
  END IF;

  SELECT ds.decrypted_secret INTO secret
  FROM vault.decrypted_secrets ds
  WHERE ds.name = 'job_secret'
  LIMIT 1;

  IF secret IS NULL OR btrim(secret) = '' THEN
    RAISE EXCEPTION 'vault secret job_secret is not set';
  END IF;

  SELECT net.http_post(
    url := rtrim(app_url, '/') || '/api/public/jobs/' || job_slug,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || secret
    ),
    body := '{}'::jsonb
  ) INTO request_id;

  RETURN request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_feedback_job(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_feedback_job(text) TO postgres, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    GRANT EXECUTE ON FUNCTION public.invoke_feedback_job(text) TO supabase_admin;
  END IF;
END $$;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'booking-maintenance';

SELECT cron.schedule(
  'booking-maintenance',
  '*/5 * * * *',
  $$SELECT public.invoke_feedback_job('booking-maintenance')$$
);
