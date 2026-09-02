DO $$
DECLARE
  seen int;
  booking_a uuid;
  feedback_a uuid;
BEGIN
  -- Customers cannot create shops.
  PERFORM tests.as_user(tests.uid('customer_a'));
  SET LOCAL ROLE authenticated;
  PERFORM tests.throws(
    format(
      $sql$INSERT INTO public.shops (owner_id, slug, name) VALUES (%L, 'stolen-shop', 'Nope')$sql$,
      tests.uid('customer_a')
    ),
    '%'
  );
  RESET ROLE;

  -- An owner role can insert a shop they own.
  PERFORM tests.as_user(tests.uid('owner_c'));
  SET LOCAL ROLE authenticated;
  INSERT INTO public.shops (owner_id, slug, name)
  VALUES (tests.uid('owner_c'), 'regression-shop-c', 'Regression Shop C');
  RESET ROLE;

  -- Owners cannot transfer a shop through the Data API.
  PERFORM tests.as_user(tests.uid('owner_a'));
  SET LOCAL ROLE authenticated;
  PERFORM tests.throws(
    format(
      $sql$UPDATE public.shops SET owner_id = %L WHERE id = %L$sql$,
      tests.uid('owner_b'),
      tests.uid('shop_a')
    ),
    '%ownership%'
  );
  RESET ROLE;

  -- Providers cannot deactivate themselves or leave the shop.
  PERFORM tests.as_user(tests.uid('provider_user'));
  SET LOCAL ROLE authenticated;
  PERFORM tests.throws(
    format($sql$UPDATE public.providers SET is_active = false WHERE id = %L$sql$, tests.uid('chair_a')),
    '%active status%'
  );
  RESET ROLE;

  -- Customer A books at shop A.
  PERFORM tests.as_user(tests.uid('customer_a'));
  SET LOCAL ROLE authenticated;
  INSERT INTO public.bookings (
    shop_id, provider_id, service_id, customer_id, starts_at, ends_at, price_cents, status, payment_status
  ) VALUES (
    tests.uid('shop_a'),
    tests.uid('chair_a'),
    tests.uid('service_a'),
    tests.uid('customer_a'),
    '2030-02-01 15:00:00+00',
    '2030-02-01 16:00:00+00',
    5000,
    'pending',
    'not_required'
  ) RETURNING id INTO booking_a;

  SELECT count(*) INTO seen FROM public.bookings WHERE id = booking_a;
  PERFORM tests.assert(seen = 1, 'customer A should see their own booking');
  RESET ROLE;

  -- Customer B cannot see or cancel customer A's booking. RLS makes the
  -- update a no-op (zero rows) rather than an error.
  PERFORM tests.as_user(tests.uid('customer_b'));
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO seen FROM public.bookings WHERE id = booking_a;
  PERFORM tests.assert(seen = 0, 'customer B must not see customer A bookings');
  UPDATE public.bookings SET status = 'cancelled' WHERE id = booking_a;
  RESET ROLE;
  SELECT count(*) INTO seen FROM public.bookings WHERE id = booking_a AND status = 'pending';
  PERFORM tests.assert(seen = 1, 'customer B must not cancel customer A bookings');

  -- Customer A cannot change price, only cancel.
  PERFORM tests.as_user(tests.uid('customer_a'));
  SET LOCAL ROLE authenticated;
  PERFORM tests.throws(
    format($sql$UPDATE public.bookings SET price_cents = 1 WHERE id = %L$sql$, booking_a),
    '%cancel%'
  );
  UPDATE public.bookings SET status = 'cancelled' WHERE id = booking_a;
  RESET ROLE;

  -- Shop B's owner cannot read shop A's remaining booking rows (the cancelled one
  -- is still isolated by shop owner policy).
  PERFORM tests.as_user(tests.uid('owner_b'));
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO seen FROM public.bookings WHERE shop_id = tests.uid('shop_a');
  PERFORM tests.assert(seen = 0, 'owner B must not see shop A bookings');
  RESET ROLE;

  -- Owner A can still see shop A bookings.
  PERFORM tests.as_user(tests.uid('owner_a'));
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO seen FROM public.bookings WHERE shop_id = tests.uid('shop_a');
  PERFORM tests.assert(seen = 1, 'owner A should see shop A bookings');
  RESET ROLE;

  -- Ledger and job tables are not granted to signed-in users.
  PERFORM tests.as_user(tests.uid('owner_a'));
  SET LOCAL ROLE authenticated;
  PERFORM tests.throws($sql$SELECT * FROM public.stripe_webhook_events$sql$, '%');
  PERFORM tests.throws($sql$SELECT * FROM public.booking_calendar_outbox$sql$, '%');
  PERFORM tests.throws($sql$SELECT * FROM public.ai_job_state$sql$, '%');
  PERFORM tests.throws($sql$SELECT * FROM public.app_runtime_settings$sql$, '%');
  RESET ROLE;

  -- Feedback is isolated by customer and by shop owner.
  PERFORM tests.as_user(tests.uid('customer_a'));
  SET LOCAL ROLE authenticated;
  INSERT INTO public.customer_feedback (shop_id, customer_id, customer_name, rating, message)
  VALUES (tests.uid('shop_a'), tests.uid('customer_a'), 'A', 5, 'Great cut')
  RETURNING id INTO feedback_a;
  RESET ROLE;

  PERFORM tests.as_user(tests.uid('customer_b'));
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO seen FROM public.customer_feedback WHERE id = feedback_a;
  PERFORM tests.assert(seen = 0, 'customer B must not see customer A feedback');
  RESET ROLE;

  PERFORM tests.as_user(tests.uid('owner_b'));
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO seen FROM public.customer_feedback WHERE id = feedback_a;
  PERFORM tests.assert(seen = 0, 'owner B must not see shop A feedback');
  RESET ROLE;

  PERFORM tests.as_user(tests.uid('owner_a'));
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO seen FROM public.customer_feedback WHERE id = feedback_a;
  PERFORM tests.assert(seen = 1, 'owner A should see shop A feedback');
  RESET ROLE;

  -- Roles are not readable across accounts.
  PERFORM tests.as_user(tests.uid('customer_a'));
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO seen FROM public.user_roles WHERE user_id = tests.uid('owner_a');
  PERFORM tests.assert(seen = 0, 'customers must not read another account''s roles');
  RESET ROLE;
END;
$$;
