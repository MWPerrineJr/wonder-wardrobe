DROP POLICY IF EXISTS "Shop owners upload shop images" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners update shop images" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners delete shop images" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners read shop images" ON storage.objects;
CREATE POLICY "Shop owners upload shop images" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'shop-images' AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id::text = (storage.foldername(objects.name))[1] AND s.owner_id = auth.uid()));
CREATE POLICY "Shop owners update shop images" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'shop-images' AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id::text = (storage.foldername(objects.name))[1] AND s.owner_id = auth.uid()));
CREATE POLICY "Shop owners delete shop images" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'shop-images' AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id::text = (storage.foldername(objects.name))[1] AND s.owner_id = auth.uid()));
CREATE POLICY "Shop owners read shop images" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'shop-images' AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id::text = (storage.foldername(objects.name))[1] AND s.owner_id = auth.uid()));

CREATE TABLE public.shop_portfolio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  image_url text NOT NULL CHECK (char_length(image_url) <= 2048),
  caption text CHECK (caption IS NULL OR char_length(caption) <= 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shop_portfolio_shop_idx ON public.shop_portfolio(shop_id, created_at DESC);
GRANT SELECT ON public.shop_portfolio TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_portfolio TO authenticated;
GRANT ALL ON public.shop_portfolio TO service_role;
ALTER TABLE public.shop_portfolio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone views portfolio" ON public.shop_portfolio FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owners add portfolio" ON public.shop_portfolio FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_id = auth.uid()));
CREATE POLICY "Owners edit portfolio" ON public.shop_portfolio FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_id = auth.uid()));
CREATE POLICY "Owners remove portfolio" ON public.shop_portfolio FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_id = auth.uid()));