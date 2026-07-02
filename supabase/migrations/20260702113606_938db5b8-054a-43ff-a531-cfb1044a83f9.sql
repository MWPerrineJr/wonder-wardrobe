
CREATE TABLE public.shop_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  open_time time NOT NULL DEFAULT '09:00',
  close_time time NOT NULL DEFAULT '18:00',
  is_closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, weekday)
);

GRANT SELECT ON public.shop_hours TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_hours TO authenticated;
GRANT ALL ON public.shop_hours TO service_role;

ALTER TABLE public.shop_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop hours are viewable by everyone"
  ON public.shop_hours FOR SELECT
  USING (true);

CREATE POLICY "Shop owners can manage hours"
  ON public.shop_hours FOR ALL
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_hours.shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_hours.shop_id AND s.owner_id = auth.uid()));

CREATE TRIGGER shop_hours_set_updated_at
  BEFORE UPDATE ON public.shop_hours
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
