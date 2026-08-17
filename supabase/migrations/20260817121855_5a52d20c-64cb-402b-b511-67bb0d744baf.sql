ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'sandbox';

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_shop_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_shop_env_key
  ON public.subscriptions (shop_id, environment);

DROP FUNCTION IF EXISTS public.pending_survey_targets(integer);
DROP FUNCTION IF EXISTS public.shop_has_active_analytics(uuid);

CREATE OR REPLACE FUNCTION public.shop_has_active_analytics(_shop_id uuid, _env text DEFAULT 'live')
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions sub
    WHERE sub.shop_id = _shop_id
      AND sub.environment = _env
      AND (
        sub.status IN ('trialing', 'active')
        OR (sub.status = 'past_due'
            AND sub.current_period_end IS NOT NULL
            AND sub.current_period_end > now() - interval '3 days')
        OR (sub.status = 'canceled'
            AND sub.current_period_end IS NOT NULL
            AND sub.current_period_end > now())
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.pending_survey_targets(lookback_days integer DEFAULT 7)
RETURNS TABLE(booking_id uuid, shop_id uuid, shop_name text, provider_id uuid, provider_name text, customer_id uuid, customer_name text, customer_email text, service_name text, ends_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    b.id,
    b.shop_id,
    s.name,
    b.provider_id,
    p.display_name,
    b.customer_id,
    COALESCE(b.customer_name, pr.full_name),
    u.email::text,
    sv.name,
    b.ends_at
  FROM public.bookings b
  JOIN public.shops s ON s.id = b.shop_id
  JOIN public.services sv ON sv.id = b.service_id
  LEFT JOIN public.providers p ON p.id = b.provider_id
  LEFT JOIN public.profiles pr ON pr.id = b.customer_id
  JOIN auth.users u ON u.id = b.customer_id
  LEFT JOIN public.survey_invites si ON si.booking_id = b.id
  WHERE b.status = 'completed'
    AND b.ends_at >= now() - make_interval(days => lookback_days)
    AND si.id IS NULL
    AND u.email IS NOT NULL
    AND public.shop_has_active_analytics(b.shop_id, 'live')
  ORDER BY b.ends_at;
$function$;