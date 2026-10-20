CREATE POLICY "Shop owners upload shop images" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'shop-images' AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id::text = (storage.foldername(name))[1] AND s.owner_id = auth.uid()));
CREATE POLICY "Shop owners update shop images" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'shop-images' AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id::text = (storage.foldername(name))[1] AND s.owner_id = auth.uid()));
CREATE POLICY "Shop owners delete shop images" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'shop-images' AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id::text = (storage.foldername(name))[1] AND s.owner_id = auth.uid()));