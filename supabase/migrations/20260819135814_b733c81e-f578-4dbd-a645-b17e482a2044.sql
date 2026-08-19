CREATE TABLE public.comp_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  note text,
  max_redemptions integer NOT NULL DEFAULT 1,
  redeemed_count integer NOT NULL DEFAULT 0,
  expires_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.comp_codes TO service_role;
ALTER TABLE public.comp_codes ENABLE ROW LEVEL SECURITY;
-- No policies: codes are never readable or writable from the client.

CREATE TABLE public.comp_grants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id uuid NOT NULL UNIQUE REFERENCES public.shops(id) ON DELETE CASCADE,
  code_id uuid REFERENCES public.comp_codes(id) ON DELETE SET NULL,
  redeemed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.comp_grants TO authenticated;
GRANT ALL ON public.comp_grants TO service_role;
ALTER TABLE public.comp_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their shop's lifetime access"
ON public.comp_grants FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = comp_grants.shop_id AND s.owner_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.shop_has_active_analytics(_shop_id uuid, _env text DEFAULT 'live'::text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.comp_grants g WHERE g.shop_id = _shop_id
  ) OR EXISTS (
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

CREATE OR REPLACE FUNCTION public.redeem_comp_code(_shop_id uuid, _code text, _user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  c public.comp_codes;
  owns boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.shops s WHERE s.id = _shop_id AND s.owner_id = _user_id) INTO owns;
  IF NOT owns THEN
    RETURN 'not_owner';
  END IF;

  IF EXISTS (SELECT 1 FROM public.comp_grants g WHERE g.shop_id = _shop_id) THEN
    RETURN 'already_granted';
  END IF;

  SELECT * INTO c FROM public.comp_codes
   WHERE code = upper(btrim(_code))
   FOR UPDATE;

  IF c.id IS NULL
     OR NOT c.is_active
     OR (c.expires_at IS NOT NULL AND c.expires_at <= now())
     OR c.redeemed_count >= c.max_redemptions THEN
    RETURN 'invalid';
  END IF;

  INSERT INTO public.comp_grants (shop_id, code_id, redeemed_by)
  VALUES (_shop_id, c.id, _user_id);

  UPDATE public.comp_codes SET redeemed_count = redeemed_count + 1 WHERE id = c.id;

  RETURN 'ok';
END;
$function$;

REVOKE ALL ON FUNCTION public.redeem_comp_code(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_comp_code(uuid, text, uuid) TO service_role;

INSERT INTO public.comp_codes (code, note, max_redemptions)
VALUES ('FOUNDER-7QK2M9', 'First lifetime comp code', 1);