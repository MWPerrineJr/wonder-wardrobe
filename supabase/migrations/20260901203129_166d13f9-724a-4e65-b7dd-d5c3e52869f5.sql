REVOKE ALL ON FUNCTION public.expire_stale_booking_holds() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.pending_survey_retries() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_booking_holds() TO service_role;
GRANT EXECUTE ON FUNCTION public.pending_survey_retries() TO service_role;