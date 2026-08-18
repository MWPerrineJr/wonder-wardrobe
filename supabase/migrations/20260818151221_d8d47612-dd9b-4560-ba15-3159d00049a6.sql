CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

INSERT INTO public.ai_job_state (job_name)
VALUES ('send-surveys'), ('enrich-feedback'), ('build-reports')
ON CONFLICT (job_name) DO NOTHING;

SELECT cron.unschedule('feedback-send-surveys') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='feedback-send-surveys');
SELECT cron.unschedule('feedback-enrich') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='feedback-enrich');
SELECT cron.unschedule('feedback-build-reports') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='feedback-build-reports');

SELECT cron.schedule(
  'feedback-send-surveys',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--cb8ddcf9-1e7f-46aa-9db6-91cb52002384-dev.lovable.app/api/public/jobs/send-surveys',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_Vm3RB6S4uAtE3fj_MwYBjg_t3yqxZzj"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'feedback-enrich',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--cb8ddcf9-1e7f-46aa-9db6-91cb52002384-dev.lovable.app/api/public/jobs/enrich-feedback',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_Vm3RB6S4uAtE3fj_MwYBjg_t3yqxZzj"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'feedback-build-reports',
  '30 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--cb8ddcf9-1e7f-46aa-9db6-91cb52002384-dev.lovable.app/api/public/jobs/build-reports',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_Vm3RB6S4uAtE3fj_MwYBjg_t3yqxZzj"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);