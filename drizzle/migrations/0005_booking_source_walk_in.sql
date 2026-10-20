ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'online';
ALTER TABLE public.bookings ADD CONSTRAINT bookings_source_check CHECK (source IN ('online','walk_in'));
CREATE INDEX IF NOT EXISTS bookings_shop_source_idx ON public.bookings (shop_id, source, starts_at);