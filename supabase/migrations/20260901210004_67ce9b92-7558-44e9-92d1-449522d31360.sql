-- 1. Calendar sync outbox (backend only)
CREATE TABLE IF NOT EXISTS public.booking_calendar_outbox (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES public.providers(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('upsert', 'delete')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.booking_calendar_outbox TO service_role;
ALTER TABLE public.booking_calendar_outbox ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: backend-only queue (service_role).

DROP TRIGGER IF EXISTS booking_calendar_outbox_set_updated_at ON public.booking_calendar_outbox;
CREATE TRIGGER booking_calendar_outbox_set_updated_at
BEFORE UPDATE ON public.booking_calendar_outbox
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS booking_calendar_outbox_pending_idx
  ON public.booking_calendar_outbox (status, next_attempt_at);

-- 2. Job state rows for every scheduled job
INSERT INTO public.ai_job_state (job_name, status)
VALUES ('send-surveys', 'idle'),
       ('enrich-feedback', 'idle'),
       ('build-reports', 'idle'),
       ('booking-maintenance', 'idle')
ON CONFLICT (job_name) DO NOTHING;

-- 3. Overlap guard must see every conflicting booking, not just readable rows
CREATE OR REPLACE FUNCTION public.validate_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  svc_shop uuid;
  prov_shop uuid;
  conflict_count integer;
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

    SELECT count(*) INTO conflict_count
    FROM public.bookings b
    WHERE b.provider_id = NEW.provider_id
      AND b.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND b.status IN ('pending', 'confirmed')
      AND b.starts_at < NEW.ends_at
      AND b.ends_at > NEW.starts_at;
    IF conflict_count > 0 AND NEW.status IN ('pending', 'confirmed') THEN
      RAISE EXCEPTION 'That time slot is already booked for this provider';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Scheduler launcher accepts the new job slug
CREATE OR REPLACE FUNCTION public.invoke_feedback_job(job_slug text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 5. Schedule the maintenance job
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'booking-maintenance') THEN
    PERFORM cron.unschedule('booking-maintenance');
  END IF;
  PERFORM cron.schedule('booking-maintenance', '*/5 * * * *', $cmd$SELECT public.invoke_feedback_job('booking-maintenance')$cmd$);
END $$;
