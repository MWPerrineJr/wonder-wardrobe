CREATE TYPE public.service_category AS ENUM ('hair_barber', 'nails', 'waxing', 'makeup', 'massage', 'skincare_facials', 'brows_lashes', 'spa_wellness');

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS category public.service_category NOT NULL DEFAULT 'hair_barber';

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS categories public.service_category[] NOT NULL DEFAULT '{}';

-- Backfill shop categories from their existing services
UPDATE public.shops
SET categories = sub.cats
FROM (
  SELECT shop_id, array_agg(DISTINCT category) AS cats
  FROM public.services
  GROUP BY shop_id
) sub
WHERE public.shops.id = sub.shop_id AND public.shops.categories = '{}';

-- Rename role value
ALTER TYPE public.app_role RENAME VALUE 'barber' TO 'provider';

-- Rename table and column
ALTER TABLE public.barbers RENAME TO providers;
ALTER TABLE public.providers RENAME CONSTRAINT barbers_shop_id_fkey TO providers_shop_id_fkey;
ALTER TABLE public.providers RENAME CONSTRAINT barbers_user_id_fkey TO providers_user_id_fkey;
ALTER TABLE public.bookings RENAME COLUMN barber_id TO provider_id;
ALTER TABLE public.bookings RENAME CONSTRAINT bookings_barber_id_fkey TO bookings_provider_id_fkey;
ALTER INDEX bookings_barber_starts_idx RENAME TO bookings_provider_starts_idx;

-- Rename trigger function to use provider terminology
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

-- Recreate trigger to be safe
DROP TRIGGER IF EXISTS bookings_validate ON public.bookings;
CREATE TRIGGER bookings_validate
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.validate_booking();

-- Ensure grants are kept on the renamed table
GRANT SELECT ON public.providers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.providers TO authenticated;
GRANT ALL ON public.providers TO service_role;

-- Drop old barber policies and recreate with provider names
DROP POLICY IF EXISTS "Barbers are viewable by everyone" ON public.providers;
DROP POLICY IF EXISTS "Shop owners can manage barbers" ON public.providers;
DROP POLICY IF EXISTS "Barbers can update their own profile" ON public.providers;

CREATE POLICY "Providers are viewable by everyone"
  ON public.providers FOR SELECT
  USING (true);

CREATE POLICY "Shop owners can manage providers"
  ON public.providers FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_id = auth.uid()));

CREATE POLICY "Providers can update their own profile"
  ON public.providers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Update booking policies
DROP POLICY IF EXISTS "Barbers can view their bookings" ON public.bookings;
DROP POLICY IF EXISTS "Barbers can update their bookings" ON public.bookings;

CREATE POLICY "Providers can view their bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.providers p WHERE p.id = provider_id AND p.user_id = auth.uid()));

CREATE POLICY "Providers can update their bookings"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.providers p WHERE p.id = provider_id AND p.user_id = auth.uid()));

-- Ensure service_category array is in the grants for shops (table already granted, nothing to add)
