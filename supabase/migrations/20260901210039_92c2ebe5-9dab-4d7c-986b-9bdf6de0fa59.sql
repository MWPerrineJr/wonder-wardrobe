REVOKE ALL ON FUNCTION public.validate_booking() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_booking() TO postgres, service_role;
