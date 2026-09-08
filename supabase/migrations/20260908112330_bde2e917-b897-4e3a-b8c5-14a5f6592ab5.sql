DROP POLICY IF EXISTS "Services are viewable by everyone" ON public.services;

CREATE POLICY "Active services are viewable by everyone"
ON public.services
FOR SELECT
TO anon, authenticated
USING (is_active = true);

CREATE POLICY "Shop owners can view all their services"
ON public.services
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = services.shop_id AND s.owner_id = auth.uid()
  )
);