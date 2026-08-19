ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS tiktok_url text,
  ADD COLUMN IF NOT EXISTS x_url text,
  ADD COLUMN IF NOT EXISTS youtube_url text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.shops
  DROP CONSTRAINT IF EXISTS shops_social_links_shape;

ALTER TABLE public.shops
  ADD CONSTRAINT shops_social_links_shape CHECK (
    jsonb_typeof(social_links) = 'array' AND jsonb_array_length(social_links) <= 5
  );