-- Phase 5: freeze provider identity columns and close related RLS gaps.
-- RLS cannot see OLD row values, so identity and booking-field freezes live in
-- BEFORE UPDATE triggers. Policies get explicit WITH CHECK predicates so a
-- rewritten row must still belong to the same actor.

-- =========================================================
-- Providers: self-update cannot change shop, user, or active flag
-- =========================================================
CREATE OR REPLACE FUNCTION public.restrict_provider_identity_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- service_role / SQL console typically have no JWT; leave those writes alone.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = OLD.shop_id AND s.owner_id = auth.uid()
  ) THEN
    IF NEW.shop_id IS DISTINCT FROM OLD.shop_id
      AND NOT EXISTS (
        SELECT 1 FROM public.shops s
        WHERE s.id = NEW.shop_id AND s.owner_id = auth.uid()
      )
    THEN
      RAISE EXCEPTION 'Providers can only be moved to a shop you own';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.shop_id IS DISTINCT FROM OLD.shop_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.is_active IS DISTINCT FROM OLD.is_active
    OR NEW.id IS DISTINCT FROM OLD.id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Providers cannot change shop assignment, account link, or active status';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS providers_restrict_identity_update ON public.providers;
CREATE TRIGGER providers_restrict_identity_update
BEFORE UPDATE ON public.providers
FOR EACH ROW EXECUTE FUNCTION public.restrict_provider_identity_update();

DROP POLICY IF EXISTS "Providers can update their own profile" ON public.providers;
CREATE POLICY "Providers can update their own profile"
  ON public.providers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- Shops: owners cannot transfer ownership through the Data API
-- =========================================================
CREATE OR REPLACE FUNCTION public.restrict_shop_owner_transfer()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Shop ownership cannot be transferred this way';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shops_restrict_owner_transfer ON public.shops;
CREATE TRIGGER shops_restrict_owner_transfer
BEFORE UPDATE ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.restrict_shop_owner_transfer();

DROP POLICY IF EXISTS "Owners can update their own shops" ON public.shops;
CREATE POLICY "Owners can update their own shops"
  ON public.shops FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- =========================================================
-- Profiles: updated row must still be the caller
-- =========================================================
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =========================================================
-- Bookings: customers still cancel-only; providers status-only
-- =========================================================
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
  THEN
    RAISE EXCEPTION 'Providers can only update booking status';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_restrict_provider_update ON public.bookings;
CREATE TRIGGER bookings_restrict_provider_update
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.restrict_provider_booking_update();

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
  USING (EXISTS (SELECT 1 FROM public.providers p WHERE p.id = provider_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.providers p WHERE p.id = provider_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Shop owners can update shop bookings" ON public.bookings;
CREATE POLICY "Shop owners can update shop bookings"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_id = auth.uid()));
