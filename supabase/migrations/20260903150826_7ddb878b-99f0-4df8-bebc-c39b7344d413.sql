CREATE TABLE public.owner_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL UNIQUE REFERENCES public.shops(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_email text,
  owner_name text,
  shop_name text NOT NULL,
  shop_slug text NOT NULL,
  signed_up_at timestamptz NOT NULL DEFAULT now(),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  plan_state text NOT NULL DEFAULT 'none',
  stripe_subscription_id text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT owner_signups_plan_state_check CHECK (
    plan_state IN ('none','trialing','active','past_due','canceled','lifetime')
  )
);

GRANT SELECT ON public.owner_signups TO authenticated;
GRANT ALL ON public.owner_signups TO service_role;

ALTER TABLE public.owner_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their own signup record"
ON public.owner_signups FOR SELECT TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Admins can view all signup records"
ON public.owner_signups FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "No client inserts on owner signups"
ON public.owner_signups FOR INSERT TO authenticated
WITH CHECK (false);

CREATE POLICY "No client updates on owner signups"
ON public.owner_signups FOR UPDATE TO authenticated
USING (false) WITH CHECK (false);

CREATE POLICY "No client deletes on owner signups"
ON public.owner_signups FOR DELETE TO authenticated
USING (false);

CREATE INDEX owner_signups_signed_up_at_idx ON public.owner_signups (signed_up_at DESC);
CREATE INDEX owner_signups_owner_id_idx ON public.owner_signups (owner_id);

CREATE TRIGGER owner_signups_set_updated_at
BEFORE UPDATE ON public.owner_signups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.owner_signups (
  shop_id, owner_id, owner_email, owner_name, shop_name, shop_slug, signed_up_at
)
SELECT s.id, s.owner_id, u.email::text, p.full_name, s.name, s.slug, s.created_at
FROM public.shops s
JOIN auth.users u ON u.id = s.owner_id
LEFT JOIN public.profiles p ON p.id = s.owner_id
ON CONFLICT (shop_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) = 'michael@pandagentic.ai'
ON CONFLICT DO NOTHING;