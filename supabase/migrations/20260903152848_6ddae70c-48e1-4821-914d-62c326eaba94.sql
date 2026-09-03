ALTER TABLE public.owner_signups
  ADD COLUMN trial_source text NOT NULL DEFAULT 'none',
  ADD COLUMN signup_trial_ends_at timestamptz,
  ADD COLUMN trial_expires_notified_at timestamptz;

ALTER TABLE public.owner_signups
  ADD CONSTRAINT owner_signups_trial_source_check
  CHECK (trial_source IN ('none', 'signup', 'stripe'));

CREATE TABLE public.owner_trial_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  owner_id uuid,
  event text NOT NULL,
  plan_state text,
  source text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT owner_trial_events_event_check CHECK (event IN (
    'signup_trial_started','stripe_trial_started','converted_paid',
    'past_due','canceled','lifetime','backfilled'
  ))
);

CREATE INDEX owner_trial_events_shop_idx ON public.owner_trial_events (shop_id, occurred_at DESC);

GRANT SELECT ON public.owner_trial_events TO authenticated;
GRANT ALL ON public.owner_trial_events TO service_role;

ALTER TABLE public.owner_trial_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their own shop trial history"
  ON public.owner_trial_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = owner_trial_events.shop_id AND s.owner_id = auth.uid()
  ));

CREATE POLICY "Admins read all trial history"
  ON public.owner_trial_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "No client inserts on trial history"
  ON public.owner_trial_events FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "No client updates on trial history"
  ON public.owner_trial_events FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "No client deletes on trial history"
  ON public.owner_trial_events FOR DELETE TO authenticated
  USING (false);

UPDATE public.owner_signups
SET trial_source = 'signup',
    signup_trial_ends_at = signed_up_at + interval '90 days',
    plan_state = CASE WHEN plan_state = 'none' THEN 'trialing' ELSE plan_state END
WHERE trial_started_at IS NULL
  AND stripe_subscription_id IS NULL;

INSERT INTO public.owner_trial_events (shop_id, owner_id, event, plan_state, source, occurred_at)
SELECT os.shop_id, os.owner_id, 'backfilled', os.plan_state, 'migration', os.signed_up_at
FROM public.owner_signups os;