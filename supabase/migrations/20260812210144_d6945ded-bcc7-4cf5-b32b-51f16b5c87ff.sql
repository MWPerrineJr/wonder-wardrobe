-- 1. Booking validation (trigger, not CHECK, since it depends on other rows)
CREATE OR REPLACE FUNCTION public.validate_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  svc_shop uuid;
  brb_shop uuid;
  conflict_count integer;
BEGIN
  IF NEW.ends_at <= NEW.starts_at THEN
    RAISE EXCEPTION 'Appointment must end after it starts';
  END IF;

  SELECT shop_id INTO svc_shop FROM public.services WHERE id = NEW.service_id;
  IF svc_shop IS NULL OR svc_shop <> NEW.shop_id THEN
    RAISE EXCEPTION 'Selected service does not belong to this shop';
  END IF;

  IF NEW.barber_id IS NOT NULL THEN
    SELECT shop_id INTO brb_shop FROM public.barbers WHERE id = NEW.barber_id;
    IF brb_shop IS NULL OR brb_shop <> NEW.shop_id THEN
      RAISE EXCEPTION 'Selected barber does not belong to this shop';
    END IF;

    SELECT count(*) INTO conflict_count
    FROM public.bookings b
    WHERE b.barber_id = NEW.barber_id
      AND b.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND b.status IN ('pending', 'confirmed')
      AND b.starts_at < NEW.ends_at
      AND b.ends_at > NEW.starts_at;
    IF conflict_count > 0 AND NEW.status IN ('pending', 'confirmed') THEN
      RAISE EXCEPTION 'That time slot is already booked for this barber';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_validate ON public.bookings;
CREATE TRIGGER bookings_validate
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.validate_booking();

-- 2. Feedback value constraints
ALTER TABLE public.customer_feedback
  ADD CONSTRAINT customer_feedback_rating_range CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  ADD CONSTRAINT customer_feedback_status_values CHECK (status IN ('new', 'reviewed', 'responded', 'archived')),
  ADD CONSTRAINT customer_feedback_sentiment_values CHECK (
    sentiment_label IS NULL OR sentiment_label IN ('very_positive','positive','neutral','negative','very_negative')
  ),
  ADD CONSTRAINT customer_feedback_urgency_values CHECK (
    urgency IS NULL OR urgency IN ('low','medium','high')
  );

-- 3. Customer-submitted feedback
ALTER TABLE public.customer_feedback
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS customer_feedback_customer_id_idx ON public.customer_feedback (customer_id);

CREATE POLICY "Customers can submit their own feedback"
ON public.customer_feedback
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can view their own feedback"
ON public.customer_feedback
FOR SELECT
TO authenticated
USING (auth.uid() = customer_id);