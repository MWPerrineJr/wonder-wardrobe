-- Keep the hardened comp-redemption and survey RPCs service-role only.
-- The public application reaches them through authenticated server functions,
-- never directly from browser clients.

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
  IF _user_id IS NULL THEN
    RETURN 'not_owner';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = _shop_id AND s.owner_id = _user_id
  ) INTO owns;
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

REVOKE ALL ON FUNCTION public.redeem_comp_code(uuid, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_comp_code(uuid, text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_survey_invite_by_token(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_survey_invite_by_token(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.submit_survey_feedback(uuid, integer, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_survey_feedback(uuid, integer, text) TO service_role;
