CREATE OR REPLACE FUNCTION public.invoke_feedback_job(job_slug text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  app_url text;
  secret text;
  request_id bigint;
BEGIN
  IF job_slug NOT IN ('send-surveys', 'enrich-feedback', 'build-reports', 'booking-maintenance') THEN
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
$function$;

INSERT INTO public.ai_job_state (job_name, status)
VALUES ('booking-maintenance', 'active')
ON CONFLICT (job_name) DO NOTHING;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'booking-maintenance';
SELECT cron.schedule('booking-maintenance', '*/5 * * * *', $$SELECT public.invoke_feedback_job('booking-maintenance')$$);