REVOKE EXECUTE ON FUNCTION public.pending_survey_targets(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pending_survey_targets(integer) TO service_role;