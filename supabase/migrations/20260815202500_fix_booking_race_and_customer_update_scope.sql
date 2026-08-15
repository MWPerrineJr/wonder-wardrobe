-- Fix 1: close a race-condition window in validate_booking().
-- The prior version's overlap check (SELECT count(*) ...) ran without any
-- locking, so two concurrent INSERTs for the same provider/time slot could
-- both read a snapshot with zero conflicts and both commit, double-booking
-- the provider. A session-level advisory lock scoped to the provider id
-- serializes concurrent attempts for the same provider without blocking
-- bookings for other providers.
CREATE OR REPLACE FUNCTION public.validate_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
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

    IF NEW.status IN ('pending', 'confirmed') THEN
      -- Serialize concurrent booking attempts for this provider so the
      -- conflict check below can't race with another transaction that
      -- hasn't committed yet. Held for the rest of this transaction.
      PERFORM pg_advisory_xact_lock(hashtextextended(NEW.provider_id::text, 0));

      SELECT count(*) INTO conflict_count
      FROM public.bookings b
      WHERE b.provider_id = NEW.provider_id
        AND b.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND b.status IN ('pending', 'confirmed')
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

-- Fix 2: "Customers can update their own bookings" has no column
-- restriction, so a customer's session can call the Supabase client
-- directly (bypassing the app's UI) and rewrite ANY column on their own
-- booking row -- price_cents, starts_at/ends_at, status to "confirmed",
-- etc. RLS is row-level only, so the restriction has to live in a trigger:
-- when the acting user is the booking's own customer (not a provider or
-- shop owner acting on it), the only change allowed is a status transition
-- to 'cancelled' from 'pending' or 'confirmed', with every other column
-- left untouched.
CREATE OR REPLACE FUNCTION public.restrict_customer_booking_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Service-role/admin connections bypass RLS entirely and never fire this
  -- check; this only runs for requests authenticated as the customer.
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
  THEN
    RAISE EXCEPTION 'Customers may only cancel their booking, not modify other fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_restrict_customer_update ON public.bookings;
CREATE TRIGGER bookings_restrict_customer_update
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.restrict_customer_booking_update();
