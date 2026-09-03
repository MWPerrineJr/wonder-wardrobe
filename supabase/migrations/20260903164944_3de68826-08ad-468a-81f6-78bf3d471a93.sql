-- has_role() self-guards (raises unless _user_id = auth.uid() or caller is postgres/service_role),
-- so signed-in users may execute it. Without this grant, admin RLS policies and the
-- /admin/owners role check fail with 42501 permission denied.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;