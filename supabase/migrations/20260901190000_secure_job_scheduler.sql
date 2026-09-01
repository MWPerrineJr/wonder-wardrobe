-- Phase 1: stop invoking jobs with the public Supabase publishable key.
-- Historical cron migrations keep their committed SQL; this replaces the live
-- schedules. Destination URL and bearer token are read at run time.

CREATE TABLE IF NOT EXISTS public.app_runtime_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_runtime_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.app_runtime_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.app_runtime_settings TO service_role;

INSERT INTO public.app_runtime_settings (key, value)
VALUES ('app_url', '')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.invoke_feedback_job(job_slug text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  app_url text;
  secret text;
  request_id bigint;
BEGIN
  IF job_slug NOT IN ('send-surveys', 'enrich-feedback', 'build-reports') THEN
    RAISE EXCEPTION 'unknown job %', job_slug;
  END IF;

  SELECT s.value INTO app_url
  FROM public.app_runtime_settings s
  WHERE s.key = 'app_url';

  IF app_url IS NULL OR btrim(app_url) = '' THEN
    RAISE EXCEPTION 'app_runtime_settings.app_url is not set';
  END IF;

  SELECT ds.decrypted_secret INTO secret
  FROM vault.decrypted_secrets ds
  WHERE ds.name = 'job_secret'
  LIMIT 1;

  IF secret IS NULL OR btrim(secret) = '' THEN
    RAISE EXCEPTION 'vault secret job_secret is not set';
  END IF;

  SELECT net.http_post(
    url := rtrim(app_url, '/') || '/api/public/jobs/' || job_slug,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || secret
    ),
    body := '{}'::jsonb
  ) INTO request_id;

  RETURN request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_feedback_job(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_feedback_job(text) TO postgres, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    GRANT EXECUTE ON FUNCTION public.invoke_feedback_job(text) TO supabase_admin;
  END IF;
END $$;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname IN ('feedback-send-surveys', 'feedback-enrich', 'feedback-build-reports');

SELECT cron.schedule(
  'feedback-send-surveys',
  '0 * * * *',
  $$SELECT public.invoke_feedback_job('send-surveys')$$
);

SELECT cron.schedule(
  'feedback-enrich',
  '*/5 * * * *',
  $$SELECT public.invoke_feedback_job('enrich-feedback')$$
);

SELECT cron.schedule(
  'feedback-build-reports',
  '30 6 * * *',
  $$SELECT public.invoke_feedback_job('build-reports')$$
);
