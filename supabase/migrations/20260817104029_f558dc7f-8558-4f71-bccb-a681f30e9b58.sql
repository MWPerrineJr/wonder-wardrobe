-- Tier 1: email-survey pipeline + AI enrichment metadata
--
-- 1. survey_invites: one row per survey email sent. The email link carries the
--    invite token; the public submission endpoint validates it (unexpired,
--    unused) and inserts customer_feedback with the service role. Also gives
--    response-rate analytics (sent_at vs responded_at) for free.
-- 2. Enrichment metadata on customer_feedback so every AI classification is
--    auditable and re-runnable: which model, when, and the raw LLM output.

-- =========================================================
-- SURVEY INVITES
-- =========================================================
CREATE TABLE public.survey_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- token is a separate high-entropy secret so the primary key never leaves the server
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name varchar(100),
  customer_email varchar(255) NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
  responded_at timestamptz,
  feedback_id uuid REFERENCES public.customer_feedback(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX survey_invites_shop_id_idx ON public.survey_invites (shop_id);
CREATE INDEX survey_invites_booking_id_idx ON public.survey_invites (booking_id);
CREATE INDEX survey_invites_provider_id_idx ON public.survey_invites (provider_id);
CREATE INDEX survey_invites_customer_id_idx ON public.survey_invites (customer_id);
CREATE INDEX survey_invites_feedback_id_idx ON public.survey_invites (feedback_id);
-- n8n's "who needs a survey?" query: bookings completed but not yet invited
CREATE UNIQUE INDEX survey_invites_one_per_booking ON public.survey_invites (booking_id)
  WHERE booking_id IS NOT NULL;

-- Service role only: invites are created by n8n and consumed by the server-side
-- submission endpoint. No anon/authenticated grants -> the token can never be
-- enumerated through the public API.
GRANT ALL ON public.survey_invites TO service_role;

ALTER TABLE public.survey_invites ENABLE ROW LEVEL SECURITY;

-- Owners may see invite stats for their own shops (dashboard response rates).
GRANT SELECT ON public.survey_invites TO authenticated;
CREATE POLICY "Owners can view survey invites for their shops"
  ON public.survey_invites FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = survey_invites.shop_id AND s.owner_id = auth.uid()));

CREATE TRIGGER survey_invites_set_updated_at
  BEFORE UPDATE ON public.survey_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- ENRICHMENT METADATA on customer_feedback
-- =========================================================
ALTER TABLE public.customer_feedback
  ADD COLUMN IF NOT EXISTS enrichment_model text,
  ADD COLUMN IF NOT EXISTS enriched_at timestamptz,
  ADD COLUMN IF NOT EXISTS enrichment_raw jsonb;

-- Enrichment worklist: new rows the pipeline hasn't touched yet.
CREATE INDEX IF NOT EXISTS customer_feedback_unenriched_idx
  ON public.customer_feedback (created_at)
  WHERE enriched_at IS NULL;

-- Allow 'email_survey' alongside 'web' as a source (source is free-form varchar,
-- documented here for the dashboard filter list).
COMMENT ON COLUMN public.customer_feedback.source IS
  'Origin of the feedback: web | email_survey | (future: sms, google, yelp)';
COMMENT ON COLUMN public.customer_feedback.enrichment_raw IS
  'Raw LLM classification output (auditable; enables re-runs when the prompt/model changes)';

-- =========================================================
-- RPC for n8n: which completed bookings still need a survey?
-- =========================================================
-- Security definer so it can read auth.users for the customer email; EXECUTE
-- is revoked from public/anon/authenticated -> only the service role (n8n)
-- can call it through PostgREST.
CREATE OR REPLACE FUNCTION public.pending_survey_targets(lookback_days integer DEFAULT 7)
RETURNS TABLE (
  booking_id uuid,
  shop_id uuid,
  shop_name text,
  provider_id uuid,
  provider_name text,
  customer_id uuid,
  customer_name text,
  customer_email text,
  service_name text,
  ends_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id,
    b.shop_id,
    s.name,
    b.provider_id,
    p.display_name,
    b.customer_id,
    COALESCE(b.customer_name, pr.full_name),
    u.email::text,
    sv.name,
    b.ends_at
  FROM public.bookings b
  JOIN public.shops s ON s.id = b.shop_id
  JOIN public.services sv ON sv.id = b.service_id
  LEFT JOIN public.providers p ON p.id = b.provider_id
  LEFT JOIN public.profiles pr ON pr.id = b.customer_id
  JOIN auth.users u ON u.id = b.customer_id
  LEFT JOIN public.survey_invites si ON si.booking_id = b.id
  WHERE b.status = 'completed'
    AND b.ends_at >= now() - make_interval(days => lookback_days)
    AND si.id IS NULL
    AND u.email IS NOT NULL
  ORDER BY b.ends_at;
$$;

REVOKE EXECUTE ON FUNCTION public.pending_survey_targets(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pending_survey_targets(integer) TO service_role;