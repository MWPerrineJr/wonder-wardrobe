CREATE OR REPLACE FUNCTION public.shop_has_active_analytics(_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions sub
    WHERE sub.shop_id = _shop_id
      AND (
        sub.status IN ('trialing', 'active')
        OR (sub.status = 'past_due'
            AND sub.current_period_end IS NOT NULL
            AND sub.current_period_end > now() - interval '3 days')
      )
  );
$$;

REVOKE ALL ON FUNCTION public.shop_has_active_analytics(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_has_active_analytics(uuid) TO authenticated, service_role;