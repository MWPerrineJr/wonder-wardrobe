ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS prepay_mode text NOT NULL DEFAULT 'off',
  ADD COLUMN IF NOT EXISTS deposit_percent smallint NOT NULL DEFAULT 25;

ALTER TABLE public.shops
  ADD CONSTRAINT shops_prepay_mode_check CHECK (prepay_mode IN ('off','deposit','full')),
  ADD CONSTRAINT shops_deposit_percent_check CHECK (deposit_percent BETWEEN 5 AND 100);

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS amount_paid_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status IN ('not_required','awaiting_payment','paid','refunded','failed'));

CREATE TABLE IF NOT EXISTS public.shop_payout_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  environment text NOT NULL DEFAULT 'sandbox',
  stripe_account_id text NOT NULL,
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  details_submitted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, environment)
);

GRANT SELECT ON public.shop_payout_accounts TO authenticated;
GRANT ALL ON public.shop_payout_accounts TO service_role;

ALTER TABLE public.shop_payout_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their shop payout account"
ON public.shop_payout_accounts FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_payout_accounts.shop_id AND s.owner_id = auth.uid()));

CREATE TRIGGER shop_payout_accounts_set_updated_at
BEFORE UPDATE ON public.shop_payout_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
