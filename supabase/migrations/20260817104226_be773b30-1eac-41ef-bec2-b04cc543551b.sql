-- Restrict the analytics-plan helper to the caller's own shops.
CREATE OR REPLACE FUNCTION public.shop_has_active_analytics(_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions sub
    JOIN public.shops sh ON sh.id = sub.shop_id
    WHERE sub.shop_id = _shop_id
      AND (current_user IN ('postgres', 'service_role') OR sh.owner_id = auth.uid())
      AND (
        sub.status IN ('trialing', 'active')
        OR (sub.status = 'past_due'
            AND sub.current_period_end IS NOT NULL
            AND sub.current_period_end > now() - interval '3 days')
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.shop_has_active_analytics(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_has_active_analytics(uuid) TO authenticated, service_role;

-- Stop signed-in users from calling the role helper directly; inline the
-- owner-role check in the policy instead (user_roles RLS already limits each
-- user to their own role rows).
DROP POLICY IF EXISTS "Owners can insert their own shops" ON public.shops;
CREATE POLICY "Owners can insert their own shops"
  ON public.shops FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'owner'::app_role
    )
  );

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;