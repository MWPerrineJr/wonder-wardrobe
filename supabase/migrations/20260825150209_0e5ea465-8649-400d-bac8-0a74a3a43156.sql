CREATE OR REPLACE FUNCTION public.pending_survey_targets()
RETURNS TABLE(
  booking_id uuid,
  shop_id uuid,
  shop_name text,
  shop_address text,
  google_review_url text,
  provider_id uuid,
  provider_name text,
  customer_id uuid,
  customer_name text,
  customer_email text,
  service_name text,
  ends_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    b.id,
    b.shop_id,
    s.name,
    s.address,
    s.google_review_url,
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
  WHERE b.status NOT IN ('cancelled', 'no_show')
    AND b.ends_at <= now() - interval '24 hours'
    AND b.ends_at >= now() - interval '72 hours'
    AND si.id IS NULL
    AND u.email IS NOT NULL
  ORDER BY b.ends_at
  LIMIT 25;
$function$;

REVOKE ALL ON FUNCTION public.pending_survey_targets() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pending_survey_targets() TO service_role;