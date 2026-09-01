-- Occupancy must see every shop's bookings, not only the inserting customer's
-- rows. validate_booking() is a trigger, so without SECURITY DEFINER it runs as
-- the authenticated customer and RLS hides everyone else's occupying slots.

CREATE OR REPLACE FUNCTION public.validate_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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
