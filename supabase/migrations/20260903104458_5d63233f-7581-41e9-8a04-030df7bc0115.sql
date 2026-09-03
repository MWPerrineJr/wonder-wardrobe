CREATE TABLE public.analytics_insights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  range_days integer NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  input_fingerprint text NOT NULL,
  payload jsonb NOT NULL,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, range_days)
);

GRANT SELECT, INSERT, UPDATE ON public.analytics_insights TO authenticated;
GRANT ALL ON public.analytics_insights TO service_role;

ALTER TABLE public.analytics_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read their shop insights"
  ON public.analytics_insights FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = analytics_insights.shop_id AND s.owner_id = auth.uid()));

CREATE POLICY "Owners can create their shop insights"
  ON public.analytics_insights FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = analytics_insights.shop_id AND s.owner_id = auth.uid()));

CREATE POLICY "Owners can refresh their shop insights"
  ON public.analytics_insights FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = analytics_insights.shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = analytics_insights.shop_id AND s.owner_id = auth.uid()));

CREATE TRIGGER update_analytics_insights_updated_at
  BEFORE UPDATE ON public.analytics_insights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX analytics_insights_shop_idx ON public.analytics_insights (shop_id, range_days);