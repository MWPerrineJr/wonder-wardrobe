CREATE TABLE public.client_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  author_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX client_notes_shop_customer_idx ON public.client_notes (shop_id, customer_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.client_notes TO authenticated;
GRANT ALL ON public.client_notes TO service_role;
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read client notes" ON public.client_notes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_id = auth.uid()));
CREATE POLICY "Owners add client notes" ON public.client_notes FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_id = auth.uid()));
CREATE POLICY "Owners delete client notes" ON public.client_notes FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_id = auth.uid()));

ALTER TABLE public.customer_feedback
  ADD COLUMN fraud_score smallint NOT NULL DEFAULT 0,
  ADD COLUMN fraud_flags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN is_quarantined boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.score_feedback_fraud()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _flags text[] := '{}';
  _score int := 0;
  _norm text := lower(regexp_replace(coalesce(NEW.message, ''), '\s+', ' ', 'g'));
  _recent int;
BEGIN
  IF NEW.customer_id IS NULL AND coalesce(NEW.source, '') <> 'survey' THEN
    _flags := _flags || 'unverified_customer'; _score := _score + 25;
  END IF;
  IF NEW.customer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.bookings b WHERE b.shop_id = NEW.shop_id AND b.customer_id = NEW.customer_id
      AND b.status IN ('completed','confirmed') AND b.starts_at <= now()) THEN
    _flags := _flags || 'no_completed_visit'; _score := _score + 30;
  END IF;
  IF length(_norm) >= 15 AND EXISTS (
    SELECT 1 FROM public.customer_feedback f WHERE f.shop_id = NEW.shop_id AND f.id <> NEW.id
      AND f.created_at > now() - interval '90 days'
      AND lower(regexp_replace(coalesce(f.message, ''), '\s+', ' ', 'g')) = _norm) THEN
    _flags := _flags || 'duplicate_text'; _score := _score + 40;
  END IF;
  IF NEW.customer_id IS NOT NULL THEN
    SELECT count(*) INTO _recent FROM public.customer_feedback f
      WHERE f.shop_id = NEW.shop_id AND f.customer_id = NEW.customer_id AND f.id <> NEW.id
        AND f.created_at > now() - interval '7 days';
    IF _recent >= 2 THEN _flags := _flags || 'review_burst'; _score := _score + 30; END IF;
  END IF;
  IF _norm ~ '(https?://|www\.|\.com\b|bit\.ly)' THEN
    _flags := _flags || 'contains_link'; _score := _score + 25;
  END IF;
  IF length(coalesce(NEW.message, '')) >= 12 AND NEW.message = upper(NEW.message) AND NEW.message ~ '[A-Z]' THEN
    _flags := _flags || 'all_caps'; _score := _score + 10;
  END IF;
  IF NEW.rating IS NOT NULL AND NEW.rating <= 2 AND length(trim(coalesce(NEW.message, ''))) < 10 THEN
    _flags := _flags || 'low_effort_negative'; _score := _score + 15;
  END IF;
  NEW.fraud_flags := _flags;
  NEW.fraud_score := least(_score, 100);
  NEW.is_quarantined := _score >= 50;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.score_feedback_fraud() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER customer_feedback_fraud_score BEFORE INSERT ON public.customer_feedback
  FOR EACH ROW EXECUTE FUNCTION public.score_feedback_fraud();