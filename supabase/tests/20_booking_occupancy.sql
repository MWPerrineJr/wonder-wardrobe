DO $$
DECLARE
  first_id uuid;
  expired_id uuid;
  expired_count integer;
  seen int;
BEGIN
  -- Two customers cannot occupy the same provider slot.
  PERFORM tests.as_user(tests.uid('customer_a'));
  SET LOCAL ROLE authenticated;
  INSERT INTO public.bookings (
    shop_id, provider_id, service_id, customer_id, starts_at, ends_at, price_cents, status, payment_status
  ) VALUES (
    tests.uid('shop_a'),
    tests.uid('chair_a'),
    tests.uid('service_a'),
    tests.uid('customer_a'),
    '2030-01-15 15:00:00+00',
    '2030-01-15 16:00:00+00',
    5000,
    'pending',
    'not_required'
  ) RETURNING id INTO first_id;
  RESET ROLE;

  PERFORM tests.as_user(tests.uid('customer_b'));
  SET LOCAL ROLE authenticated;
  PERFORM tests.throws(
    format(
      $sql$INSERT INTO public.bookings (
        shop_id, provider_id, service_id, customer_id, starts_at, ends_at, price_cents, status, payment_status
      ) VALUES (
        %L, %L, %L, %L,
        '2030-01-15 15:00:00+00',
        '2030-01-15 16:00:00+00',
        5000, 'pending', 'not_required'
      )$sql$,
      tests.uid('shop_a'),
      tests.uid('chair_a'),
      tests.uid('service_a'),
      tests.uid('customer_b')
    ),
    '%already booked%'
  );
  RESET ROLE;

  -- An expired prepaid hold does not occupy the chair.
  INSERT INTO public.bookings (
    shop_id, provider_id, service_id, customer_id, starts_at, ends_at, price_cents,
    status, payment_status, hold_expires_at
  ) VALUES (
    tests.uid('shop_a'),
    tests.uid('chair_a'),
    tests.uid('service_a'),
    tests.uid('customer_a'),
    '2030-01-16 15:00:00+00',
    '2030-01-16 16:00:00+00',
    5000,
    'pending',
    'awaiting_payment',
    now() - interval '1 minute'
  ) RETURNING id INTO expired_id;

  PERFORM tests.as_user(tests.uid('customer_b'));
  SET LOCAL ROLE authenticated;
  INSERT INTO public.bookings (
    shop_id, provider_id, service_id, customer_id, starts_at, ends_at, price_cents, status, payment_status
  ) VALUES (
    tests.uid('shop_a'),
    tests.uid('chair_a'),
    tests.uid('service_a'),
    tests.uid('customer_b'),
    '2030-01-16 15:00:00+00',
    '2030-01-16 16:00:00+00',
    5000,
    'pending',
    'not_required'
  );
  RESET ROLE;

  SELECT public.expire_booking_holds() INTO expired_count;
  PERFORM tests.assert(expired_count >= 1, 'expire_booking_holds should cancel unpaid holds');
  SELECT count(*) INTO seen
  FROM public.bookings
  WHERE id = expired_id AND status = 'cancelled' AND payment_status = 'failed';
  PERFORM tests.assert(seen = 1, 'expired hold row should be cancelled');
END;
$$;
