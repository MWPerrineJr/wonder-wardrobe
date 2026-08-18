-- Google review link on shops
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS google_review_url text;

-- Survey invite delivery tracking + rating prefill
ALTER TABLE public.survey_invites
  ADD COLUMN IF NOT EXISTS rating_hint smallint,
  ADD COLUMN IF NOT EXISTS email_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS email_error text,
  ADD COLUMN IF NOT EXISTS emailed_at timestamptz;

-- Shop-level AI feedback report
CREATE TABLE IF NOT EXISTS public.feedback_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  overall_sentiment numeric,
  summary text,
  praise_themes jsonb NOT NULL DEFAULT '[]'::jsonb,
  complaint_themes jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggestions jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  feedback_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.feedback_reports TO authenticated;
GRANT ALL ON public.feedback_reports TO service_role;
ALTER TABLE public.feedback_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view reports for their shops" ON public.feedback_reports;
CREATE POLICY "Owners can view reports for their shops"
ON public.feedback_reports FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = feedback_reports.shop_id AND s.owner_id = auth.uid()));

CREATE INDEX IF NOT EXISTS feedback_reports_shop_created_idx
  ON public.feedback_reports (shop_id, created_at DESC);

-- Background job state: single-flight lease + circuit breaker
CREATE TABLE IF NOT EXISTS public.ai_job_state (
  job_name text PRIMARY KEY,
  status text NOT NULL DEFAULT 'idle',
  paused_reason text,
  lease_until timestamptz,
  last_run_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.ai_job_state FROM anon, authenticated;
GRANT ALL ON public.ai_job_state TO service_role;
ALTER TABLE public.ai_job_state ENABLE ROW LEVEL SECURITY;

INSERT INTO public.ai_job_state (job_name) VALUES
  ('send-surveys'), ('enrich-feedback'), ('build-reports')
ON CONFLICT (job_name) DO NOTHING;

-- Survey targets: completed bookings that ended 24-72h ago with no invite yet
DROP FUNCTION IF EXISTS public.pending_survey_targets(integer);

CREATE OR REPLACE FUNCTION public.pending_survey_targets()
RETURNS TABLE(
  booking_id uuid,
  shop_id uuid,
  shop_name text,
  shop_address text,
  google_review_url text,
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
SET search_path TO 'public'
AS $function$
  SELECT
    b.id,
    b.shop_id,
    s.name,
    s.address,
    s.google_review_url,
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
    AND b.ends_at <= now() - interval '24 hours'
    AND b.ends_at >= now() - interval '72 hours'
    AND si.id IS NULL
    AND u.email IS NOT NULL
  ORDER BY b.ends_at
  LIMIT 25;
$function$;

REVOKE ALL ON FUNCTION public.pending_survey_targets() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pending_survey_targets() TO service_role;