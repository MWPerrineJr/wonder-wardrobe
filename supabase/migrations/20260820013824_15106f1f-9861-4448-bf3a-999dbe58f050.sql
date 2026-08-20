ALTER TABLE public.shops
  ALTER COLUMN prepay_mode SET DEFAULT 'deposit',
  ALTER COLUMN deposit_percent SET DEFAULT 50,
  ADD COLUMN IF NOT EXISTS cancel_free_hours smallint NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS late_cancel_fee_percent smallint NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS reschedule_allowed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reschedule_min_hours smallint NOT NULL DEFAULT 24;

UPDATE public.shops
   SET prepay_mode = 'deposit',
       deposit_percent = 50
 WHERE prepay_mode = 'off' OR deposit_percent IS NULL OR deposit_percent = 25;

CREATE OR REPLACE FUNCTION public.validate_shop_policy()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.cancel_free_hours < 0 OR NEW.cancel_free_hours > 168 THEN
    RAISE EXCEPTION 'Free-cancellation window must be between 0 and 168 hours';
  END IF;
  IF NEW.reschedule_min_hours < 0 OR NEW.reschedule_min_hours > 168 THEN
    RAISE EXCEPTION 'Reschedule window must be between 0 and 168 hours';
  END IF;
  IF NEW.late_cancel_fee_percent < 0 OR NEW.late_cancel_fee_percent > 100 THEN
    RAISE EXCEPTION 'Late-cancellation fee must be between 0 and 100 percent';
  END IF;
  IF NEW.deposit_percent < 5 OR NEW.deposit_percent > 100 THEN
    RAISE EXCEPTION 'Deposit percentage must be between 5 and 100';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shops_validate_policy ON public.shops;
CREATE TRIGGER shops_validate_policy
BEFORE INSERT OR UPDATE ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.validate_shop_policy();

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS refunded_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status IN ('not_required','awaiting_payment','paid','refunded','partially_refunded','refund_failed','failed'));

CREATE OR REPLACE FUNCTION public.restrict_customer_booking_update()
RETURNS TRIGGER
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
    OR NEW.refunded_cents IS DISTINCT FROM OLD.refunded_cents
    OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
    OR NEW.amount_paid_cents IS DISTINCT FROM OLD.amount_paid_cents
  THEN
    RAISE EXCEPTION 'Customers may only cancel their booking, not modify other fields';
  END IF;

  RETURN NEW;
END;
$$;