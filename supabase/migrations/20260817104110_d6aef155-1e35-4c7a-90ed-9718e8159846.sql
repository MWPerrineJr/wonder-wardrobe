-- Billing: per-shop analytics subscription (Stripe) + plan gating
--
-- Free tier: shop page, calendar, services, bookings.
-- Paid "analytics" plan (one Stripe subscription per shop): Feedback
-- Intelligence (surveys + AI enrichment) and future business-analysis tools.
--
-- Writes come only from the Stripe webhook handler (service role). Owners can
-- read their own shop's subscription row for the billing UI.

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL UNIQUE REFERENCES public.shops(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text UNIQUE,
  plan text NOT NULL DEFAULT 'analytics',
  -- Mirrors Stripe subscription status: trialing | active | past_due |
  -- canceled | unpaid | incomplete | incomplete_expired | paused
  status text NOT NULL DEFAULT 'incomplete',
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX subscriptions_stripe_customer_idx ON public.subscriptions (stripe_customer_id);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their shop subscription"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = subscriptions.shop_id AND s.owner_id = auth.uid()));

CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Single source of truth for "does this shop get analytics?".
-- trialing/active pay states count; past_due gets a 3-day grace window based on
-- the last known period end so a failed card doesn't hard-cut the dashboard
-- mid-retry.
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
    WHERE sub.shop_id = _shop_id
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

-- Surveys are a paid feature: only invite customers of subscribed shops.
-- (LLM + email spend should only happen for shops that pay for it.)
CREATE OR REPLACE FUNCTION public.pending_survey_targets(lookback_days integer DEFAULT 7)
RETURNS TABLE (
  booking_id uuid,
  shop_id uuid,
  shop_name text,
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
SET search_path = public
AS $$
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
    AND public.shop_has_active_analytics(b.shop_id)
  ORDER BY b.ends_at;
$$;

REVOKE EXECUTE ON FUNCTION public.pending_survey_targets(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pending_survey_targets(integer) TO service_role;