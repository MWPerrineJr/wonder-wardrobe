-- Security fixes for complimentary access redemption and tokenized surveys.
--
-- comp_grants remains fail-closed to direct client writes. Redemption is only
-- possible through the owner-checked SECURITY DEFINER RPC below.
-- survey_invites remains inaccessible to anonymous table reads. Public survey
-- pages use narrowly-scoped SECURITY DEFINER RPCs that match only the token and
-- return only the fields the survey page needs.

-- =========================================================
-- COMP GRANTS: explicit fail-closed write policies
-- =========================================================
REVOKE INSERT, UPDATE, DELETE ON public.comp_grants FROM anon, authenticated;

DROP POLICY IF EXISTS "Comp grant inserts stay server-managed" ON public.comp_grants;
CREATE POLICY "Comp grant inserts stay server-managed"
ON public.comp_grants FOR INSERT TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "Comp grant updates stay server-managed" ON public.comp_grants;
CREATE POLICY "Comp grant updates stay server-managed"
ON public.comp_grants FOR UPDATE TO authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "Comp grant deletes stay server-managed" ON public.comp_grants;
CREATE POLICY "Comp grant deletes stay server-managed"
ON public.comp_grants FOR DELETE TO authenticated
USING (false);

-- Redemption can now be executed by the signed-in owner through their own
-- RLS-scoped client. The function ignores any client-supplied user id unless it
-- matches auth.uid(), then re-checks shop ownership before writing.
CREATE OR REPLACE FUNCTION public.redeem_comp_code(_shop_id uuid, _code text, _user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  c public.comp_codes;
  v_user_id uuid := auth.uid();
  owns boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN 'not_owner';
  END IF;

  IF _user_id IS NOT NULL AND _user_id <> v_user_id THEN
    RETURN 'not_owner';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = _shop_id AND s.owner_id = v_user_id
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
  VALUES (_shop_id, c.id, v_user_id);

  UPDATE public.comp_codes SET redeemed_count = redeemed_count + 1 WHERE id = c.id;

  RETURN 'ok';
END;
$function$;

REVOKE ALL ON FUNCTION public.redeem_comp_code(uuid, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_comp_code(uuid, text, uuid) TO authenticated, service_role;

-- =========================================================
-- SURVEY INVITES: token-only RPCs, no anonymous table reads
-- =========================================================
REVOKE SELECT ON public.survey_invites FROM anon;

DROP POLICY IF EXISTS "Survey invites stay server-managed anonymously" ON public.survey_invites;
CREATE POLICY "Survey invites stay server-managed anonymously"
ON public.survey_invites FOR SELECT TO anon
USING (false);

CREATE OR REPLACE FUNCTION public.get_survey_invite_by_token(_token uuid)
RETURNS TABLE (
  status text,
  shop_name text,
  provider_name text,
  customer_name character varying,
  rating_hint smallint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  i public.survey_invites%ROWTYPE;
  v_shop_name text;
  v_provider_name text;
BEGIN
  SELECT * INTO i
  FROM public.survey_invites si
  WHERE si.token = _token;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::text, NULL::text, NULL::character varying, NULL::smallint;
    RETURN;
  END IF;

  IF i.responded_at IS NOT NULL THEN
    RETURN QUERY SELECT 'used'::text, NULL::text, NULL::text, NULL::character varying, NULL::smallint;
    RETURN;
  END IF;

  IF i.expires_at <= now() THEN
    RETURN QUERY SELECT 'expired'::text, NULL::text, NULL::text, NULL::character varying, NULL::smallint;
    RETURN;
  END IF;

  SELECT s.name, p.display_name INTO v_shop_name, v_provider_name
  FROM public.shops s
  LEFT JOIN public.providers p ON p.id = i.provider_id
  WHERE s.id = i.shop_id;

  RETURN QUERY
  SELECT 'ok'::text,
         COALESCE(v_shop_name, 'this shop'),
         v_provider_name,
         i.customer_name,
         i.rating_hint;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_survey_invite_by_token(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_survey_invite_by_token(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.submit_survey_feedback(_token uuid, _rating integer, _message text)
RETURNS TABLE (
  feedback_id uuid,
  rating smallint,
  created_at timestamp with time zone,
  google_review_url text,
  prompt_google boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  i public.survey_invites%ROWTYPE;
  v_feedback_id uuid;
  v_feedback_rating smallint;
  v_feedback_created_at timestamp with time zone;
  v_google_review_url text;
BEGIN
  IF _rating IS NULL OR _rating < 1 OR _rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5.';
  END IF;

  IF _message IS NULL OR char_length(btrim(_message)) < 5 OR char_length(btrim(_message)) > 2000 THEN
    RAISE EXCEPTION 'Message must be between 5 and 2000 characters.';
  END IF;

  -- Atomically claim the token. Concurrent submissions cannot both pass the
  -- responded_at IS NULL predicate.
  UPDATE public.survey_invites si
  SET responded_at = now(), rating_hint = _rating
  WHERE si.token = _token
    AND si.responded_at IS NULL
    AND si.expires_at > now()
  RETURNING si.* INTO i;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This survey link is invalid, expired, or already used.';
  END IF;

  INSERT INTO public.customer_feedback (
    shop_id,
    customer_id,
    customer_name,
    customer_email,
    rating,
    message,
    source,
    status
  )
  VALUES (
    i.shop_id,
    i.customer_id,
    i.customer_name,
    i.customer_email,
    _rating::smallint,
    btrim(_message),
    'email_survey',
    'new'
  )
  RETURNING id, customer_feedback.rating, customer_feedback.created_at
  INTO v_feedback_id, v_feedback_rating, v_feedback_created_at;

  UPDATE public.survey_invites si
  SET feedback_id = v_feedback_id
  WHERE si.id = i.id;

  SELECT s.google_review_url INTO v_google_review_url
  FROM public.shops s
  WHERE s.id = i.shop_id;

  RETURN QUERY
  SELECT v_feedback_id,
         v_feedback_rating,
         v_feedback_created_at,
         v_google_review_url,
         (_rating >= 4 AND NULLIF(btrim(COALESCE(v_google_review_url, '')), '') IS NOT NULL);
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_survey_feedback(uuid, integer, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_survey_feedback(uuid, integer, text) TO anon, authenticated, service_role;
