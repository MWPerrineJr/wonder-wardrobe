CREATE OR REPLACE FUNCTION public.provision_job_scheduler(_secret text, _app_url text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing uuid;
BEGIN
  IF _secret IS NULL OR length(btrim(_secret)) < 32 THEN
    RAISE EXCEPTION 'scheduler secret is missing or too short';
  END IF;
  IF _app_url IS NULL OR btrim(_app_url) NOT LIKE 'https://%' THEN
    RAISE EXCEPTION 'app url must be an https origin';
  END IF;

  SELECT id INTO existing FROM vault.secrets WHERE name = 'job_secret' LIMIT 1;
  IF existing IS NULL THEN
    PERFORM vault.create_secret(btrim(_secret), 'job_secret', 'Bearer token for scheduled feedback jobs');
  ELSE
    PERFORM vault.update_secret(existing, btrim(_secret));
  END IF;

  INSERT INTO public.app_runtime_settings (key, value)
  VALUES ('app_url', btrim(_app_url))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.provision_job_scheduler(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_job_scheduler(text, text) TO postgres, service_role;
