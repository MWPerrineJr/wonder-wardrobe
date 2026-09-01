SELECT cron.unschedule('feedback-send-surveys');
SELECT cron.unschedule('feedback-enrich');
SELECT cron.unschedule('feedback-build-reports');

SELECT cron.schedule(
  'feedback-send-surveys',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--cb8ddcf9-1e7f-46aa-9db6-91cb52002384.lovable.app/api/public/jobs/send-surveys',
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
    url := 'https://project--cb8ddcf9-1e7f-46aa-9db6-91cb52002384.lovable.app/api/public/jobs/enrich-feedback',
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
    url := 'https://project--cb8ddcf9-1e7f-46aa-9db6-91cb52002384.lovable.app/api/public/jobs/build-reports',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_Vm3RB6S4uAtE3fj_MwYBjg_t3yqxZzj"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);