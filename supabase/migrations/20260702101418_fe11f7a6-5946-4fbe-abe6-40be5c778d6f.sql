
-- handle_new_user is only invoked by the auth.users trigger — no one should call it directly
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- has_role is used inside RLS policies; policy evaluation runs as the definer,
-- so end users don't need direct EXECUTE.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
