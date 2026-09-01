-- 1. Payment event ledger (idempotency + retry bookkeeping)
CREATE TABLE public.payment_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id text NOT NULL,
  event_type text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('sandbox', 'live')),
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'processed', 'failed')),
  attempts integer NOT NULL DEFAULT 1,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_events_event_unique UNIQUE (event_id, environment)
);

GRANT ALL ON public.payment_events TO service_role;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: this ledger is backend-only (service_role).

CREATE TRIGGER payment_events_set_updated_at
BEFORE UPDATE ON public.payment_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX payment_events_status_idx ON public.payment_events (status, created_at DESC);

-- 2. Booking holds
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS hold_expires_at timestamptz;
CREATE INDEX IF NOT EXISTS bookings_hold_expiry_idx
  ON public.bookings (hold_expires_at)
  WHERE hold_expires_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.expire_stale_booking_holds()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  WITH expired AS (
    UPDATE public.bookings
    SET status = 'cancelled',
        payment_status = 'failed',
        hold_expires_at = NULL,
        updated_at = now()
    WHERE hold_expires_at IS NOT NULL
      AND hold_expires_at < now()
      AND payment_status = 'awaiting_payment'
      AND status = 'pending'
    RETURNING id
  )
  SELECT count(*) INTO n FROM expired;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_booking_holds() FROM public;
GRANT EXECUTE ON FUNCTION public.expire_stale_booking_holds() TO service_role;

-- 3. Survey invite retry bookkeeping
ALTER TABLE public.survey_invites
  ADD COLUMN IF NOT EXISTS email_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_terminal boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS survey_invites_retry_idx
  ON public.survey_invites (next_attempt_at)
  WHERE next_attempt_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.pending_survey_retries()
RETURNS TABLE(
  invite_id uuid,
  token uuid,
  attempts integer,
  shop_name text,
  shop_address text,
  provider_name text,
  customer_name character varying,
  customer_email character varying,
  service_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    si.id,
    si.token,
    si.email_attempts,
    s.name,
    s.address,
    p.display_name,
    si.customer_name,
    si.customer_email,
    sv.name
  FROM public.survey_invites si
  JOIN public.shops s ON s.id = si.shop_id
  LEFT JOIN public.providers p ON p.id = si.provider_id
  LEFT JOIN public.bookings b ON b.id = si.booking_id
  LEFT JOIN public.services sv ON sv.id = b.service_id
  WHERE si.email_status = 'failed'
    AND si.delivery_terminal = false
    AND si.responded_at IS NULL
    AND si.expires_at > now()
    AND (si.next_attempt_at IS NULL OR si.next_attempt_at <= now())
  ORDER BY si.next_attempt_at NULLS FIRST
  LIMIT 25;
$$;

REVOKE ALL ON FUNCTION public.pending_survey_retries() FROM public;
GRANT EXECUTE ON FUNCTION public.pending_survey_retries() TO service_role;

-- 4. Freeze sensitive provider columns on provider self-service updates
CREATE OR REPLACE FUNCTION public.restrict_provider_self_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  is_owner boolean;
BEGIN
  -- Backend/admin paths and shop owners keep full control.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = OLD.shop_id AND s.owner_id = auth.uid()
  ) INTO is_owner;
  IF is_owner THEN
    RETURN NEW;
  END IF;

  IF OLD.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  IF NEW.shop_id IS DISTINCT FROM OLD.shop_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.is_active IS DISTINCT FROM OLD.is_active
    OR NEW.id IS DISTINCT FROM OLD.id
  THEN
    RAISE EXCEPTION 'Providers may only update their own profile details, not shop, account, or active status';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS providers_restrict_self_update ON public.providers;
CREATE TRIGGER providers_restrict_self_update
BEFORE UPDATE ON public.providers
FOR EACH ROW EXECUTE FUNCTION public.restrict_provider_self_update();

DROP POLICY IF EXISTS "Providers can update their own profile" ON public.providers;
CREATE POLICY "Providers can update their own profile"
ON public.providers FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. Booking update policies: verify the row still belongs to the actor afterwards
DROP POLICY IF EXISTS "Customers can update their own bookings" ON public.bookings;
CREATE POLICY "Customers can update their own bookings"
ON public.bookings FOR UPDATE
TO authenticated
USING (auth.uid() = customer_id)
WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Providers can update their bookings" ON public.bookings;
CREATE POLICY "Providers can update their bookings"
ON public.bookings FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.providers p
  WHERE p.id = bookings.provider_id AND p.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.providers p
  WHERE p.id = bookings.provider_id AND p.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Shop owners can update shop bookings" ON public.bookings;
CREATE POLICY "Shop owners can update shop bookings"
ON public.bookings FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.shops s
  WHERE s.id = bookings.shop_id AND s.owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.shops s
  WHERE s.id = bookings.shop_id AND s.owner_id = auth.uid()
));