ALTER TABLE public.owner_signups
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS landing_referrer text,
  ADD COLUMN IF NOT EXISTS first_touch_at timestamptz;

ALTER TABLE public.owner_signups
  ADD CONSTRAINT owner_signups_utm_lengths CHECK (
    coalesce(length(utm_source), 0) <= 120
    AND coalesce(length(utm_medium), 0) <= 120
    AND coalesce(length(utm_campaign), 0) <= 160
    AND coalesce(length(utm_content), 0) <= 160
    AND coalesce(length(utm_term), 0) <= 160
    AND coalesce(length(landing_referrer), 0) <= 500
  );

CREATE INDEX IF NOT EXISTS owner_signups_utm_source_idx ON public.owner_signups (utm_source);
CREATE INDEX IF NOT EXISTS owner_signups_utm_campaign_idx ON public.owner_signups (utm_campaign);