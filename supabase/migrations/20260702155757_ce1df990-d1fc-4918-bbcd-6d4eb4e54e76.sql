
CREATE TABLE public.customer_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_name varchar(100),
  customer_email varchar(255),
  source varchar(50),
  message text,
  rating int2,
  sentiment_label varchar(25),
  sentiment_score numeric(3,2),
  emotion varchar(30),
  urgency varchar(20),
  summary text,
  explanation text,
  key_phrases text[] NOT NULL DEFAULT '{}',
  recommended_response text,
  status varchar(25) NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX customer_feedback_shop_id_idx ON public.customer_feedback (shop_id);
CREATE INDEX customer_feedback_status_idx ON public.customer_feedback (status);
CREATE INDEX customer_feedback_created_at_idx ON public.customer_feedback (created_at DESC);

GRANT SELECT, UPDATE ON public.customer_feedback TO authenticated;
GRANT ALL ON public.customer_feedback TO service_role;

ALTER TABLE public.customer_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view feedback for their shops"
  ON public.customer_feedback FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = customer_feedback.shop_id AND s.owner_id = auth.uid()));

CREATE POLICY "Owners can update feedback for their shops"
  ON public.customer_feedback FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = customer_feedback.shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = customer_feedback.shop_id AND s.owner_id = auth.uid()));

CREATE TRIGGER customer_feedback_set_updated_at
  BEFORE UPDATE ON public.customer_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
