CREATE SCHEMA IF NOT EXISTS tests;

CREATE TABLE IF NOT EXISTS tests.fixtures (
  key text PRIMARY KEY,
  value uuid NOT NULL
);

CREATE OR REPLACE FUNCTION tests.fail(msg text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'regression: %', msg;
END;
$$;

CREATE OR REPLACE FUNCTION tests.assert(cond boolean, msg text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT cond THEN
    PERFORM tests.fail(msg);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION tests.throws(p_sql text, p_like text DEFAULT '%')
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION
    WHEN OTHERS THEN
      IF p_like = '%' OR SQLERRM LIKE p_like THEN
        RETURN;
      END IF;
      RAISE EXCEPTION 'regression: expected error matching %, got %', p_like, SQLERRM;
  END;
  RAISE EXCEPTION 'regression: expected query to fail: %', p_sql;
END;
$$;

CREATE OR REPLACE FUNCTION tests.as_user(uid uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', uid::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid::text, 'role', 'authenticated')::text,
    true
  );
END;
$$;

CREATE OR REPLACE FUNCTION tests.create_user(p_email text, p_id uuid DEFAULT gen_random_uuid())
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    p_id,
    'authenticated',
    'authenticated',
    p_email,
    extensions.crypt('regression-pass', extensions.gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    '{}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  BEGIN
    INSERT INTO auth.identities (
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      p_id::text,
      p_id,
      jsonb_build_object('sub', p_id::text, 'email', p_email),
      'email',
      now(),
      now(),
      now()
    );
  EXCEPTION
    WHEN undefined_table OR undefined_column OR not_null_violation OR unique_violation THEN
      NULL;
  END;

  RETURN p_id;
END;
$$;

CREATE OR REPLACE FUNCTION tests.uid(p_key text)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT value FROM tests.fixtures WHERE key = p_key;
$$;

GRANT USAGE ON SCHEMA tests TO postgres, authenticated, anon, service_role;
GRANT SELECT ON tests.fixtures TO postgres, authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION tests.fail(text) TO postgres, authenticated, anon;
GRANT EXECUTE ON FUNCTION tests.assert(boolean, text) TO postgres, authenticated, anon;
GRANT EXECUTE ON FUNCTION tests.throws(text, text) TO postgres, authenticated, anon;
GRANT EXECUTE ON FUNCTION tests.as_user(uuid) TO postgres, authenticated, anon;
GRANT EXECUTE ON FUNCTION tests.uid(text) TO postgres, authenticated, anon, service_role;

REVOKE ALL ON FUNCTION tests.create_user(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tests.create_user(text, uuid) TO postgres;

DO $$
DECLARE
  owner_a uuid;
  owner_b uuid;
  owner_c uuid;
  provider_a uuid;
  customer_a uuid;
  customer_b uuid;
  shop_a uuid;
  shop_b uuid;
  service_a uuid;
  service_b uuid;
  chair_a uuid;
BEGIN
  owner_a := tests.create_user('rls-owner-a@example.test');
  owner_b := tests.create_user('rls-owner-b@example.test');
  owner_c := tests.create_user('rls-owner-c@example.test');
  provider_a := tests.create_user('rls-provider-a@example.test');
  customer_a := tests.create_user('rls-customer-a@example.test');
  customer_b := tests.create_user('rls-customer-b@example.test');

  INSERT INTO public.user_roles (user_id, role) VALUES
    (owner_a, 'owner'),
    (owner_b, 'owner'),
    (owner_c, 'owner'),
    (provider_a, 'provider');

  INSERT INTO public.shops (owner_id, slug, name)
  VALUES (owner_a, 'regression-shop-a', 'Regression Shop A')
  RETURNING id INTO shop_a;

  INSERT INTO public.shops (owner_id, slug, name)
  VALUES (owner_b, 'regression-shop-b', 'Regression Shop B')
  RETURNING id INTO shop_b;

  INSERT INTO public.providers (shop_id, user_id, display_name)
  VALUES (shop_a, provider_a, 'Regression Provider')
  RETURNING id INTO chair_a;

  INSERT INTO public.services (shop_id, name, duration_minutes, price_cents)
  VALUES
    (shop_a, 'Cut', 60, 5000),
    (shop_b, 'Trim', 30, 3000);

  SELECT id INTO service_a FROM public.services WHERE shop_id = shop_a;
  SELECT id INTO service_b FROM public.services WHERE shop_id = shop_b;

  INSERT INTO tests.fixtures (key, value) VALUES
    ('owner_a', owner_a),
    ('owner_b', owner_b),
    ('owner_c', owner_c),
    ('provider_user', provider_a),
    ('customer_a', customer_a),
    ('customer_b', customer_b),
    ('shop_a', shop_a),
    ('shop_b', shop_b),
    ('service_a', service_a),
    ('service_b', service_b),
    ('chair_a', chair_a);
END;
$$;
