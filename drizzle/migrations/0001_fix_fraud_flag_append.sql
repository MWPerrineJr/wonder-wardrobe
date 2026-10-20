CREATE OR REPLACE FUNCTION public.score_feedback_fraud()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _flags text[] := '{}';
  _score int := 0;
  _norm text := lower(regexp_replace(coalesce(NEW.message, ''), '\s+', ' ', 'g'));
  _recent int;
BEGIN
  IF NEW.customer_id IS NULL AND coalesce(NEW.source, '') <> 'survey' THEN
    _flags := array_append(_flags, 'unverified_customer'); _score := _score + 25;
  END IF;
  IF NEW.customer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.bookings b WHERE b.shop_id = NEW.shop_id AND b.customer_id = NEW.customer_id
      AND b.status IN ('completed','confirmed') AND b.starts_at <= now()) THEN
    _flags := array_append(_flags, 'no_completed_visit'); _score := _score + 30;
  END IF;
  IF length(_norm) >= 15 AND EXISTS (
    SELECT 1 FROM public.customer_feedback f WHERE f.shop_id = NEW.shop_id AND f.id <> NEW.id
      AND f.created_at > now() - interval '90 days'
      AND lower(regexp_replace(coalesce(f.message, ''), '\s+', ' ', 'g')) = _norm) THEN
    _flags := array_append(_flags, 'duplicate_text'); _score := _score + 40;
  END IF;
  SELECT count(*) INTO _recent FROM public.customer_feedback f
    WHERE f.shop_id = NEW.shop_id AND f.id <> NEW.id
      AND f.created_at > now() - interval '7 days'
      AND ((NEW.customer_id IS NOT NULL AND f.customer_id = NEW.customer_id)
        OR (NEW.customer_email IS NOT NULL AND lower(f.customer_email) = lower(NEW.customer_email)));
  IF _recent >= 2 THEN _flags := array_append(_flags, 'review_burst'); _score := _score + 30; END IF;
  IF _norm ~ '(https?://|www\.|\.com\b|bit\.ly)' THEN
    _flags := array_append(_flags, 'contains_link'); _score := _score + 25;
  END IF;
  IF length(coalesce(NEW.message, '')) >= 12 AND NEW.message = upper(NEW.message) AND NEW.message ~ '[A-Z]' THEN
    _flags := array_append(_flags, 'all_caps'); _score := _score + 10;
  END IF;
  IF NEW.rating IS NOT NULL AND NEW.rating <= 2 AND length(trim(coalesce(NEW.message, ''))) < 10 THEN
    _flags := array_append(_flags, 'low_effort_negative'); _score := _score + 15;
  END IF;
  NEW.fraud_flags := _flags;
  NEW.fraud_score := least(_score, 100);
  NEW.is_quarantined := _score >= 50;
  RETURN NEW;
END $function$;