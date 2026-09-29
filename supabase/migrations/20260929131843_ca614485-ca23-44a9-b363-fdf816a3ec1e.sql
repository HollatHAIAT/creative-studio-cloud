CREATE TABLE public.listing_views (
  listing_id text NOT NULL,
  viewer_key text NOT NULL,
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Riyadh')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_id, viewer_key, day)
);
GRANT ALL ON public.listing_views TO service_role;
ALTER TABLE public.listing_views ENABLE ROW LEVEL SECURITY;

-- One view per visitor per listing per day; signed-in users are keyed by account.
CREATE OR REPLACE FUNCTION public.record_listing_view(_listing text, _visitor text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text;
BEGIN
  IF _listing IS NULL OR char_length(_listing) > 100 THEN RETURN; END IF;
  k := COALESCE(auth.uid()::text, 'v:' || left(COALESCE(_visitor, ''), 64));
  IF k = 'v:' THEN RETURN; END IF;
  INSERT INTO public.listing_views(listing_id, viewer_key) VALUES (_listing, k) ON CONFLICT DO NOTHING;
END $$;
GRANT EXECUTE ON FUNCTION public.record_listing_view(text, text) TO anon, authenticated;

-- Views per listing the caller owns (published listings or their own drafts' published ids).
CREATE OR REPLACE FUNCTION public.seller_listing_views(_from date, _to date)
RETURNS TABLE(listing_id text, views bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.listing_id, count(*) FROM public.listing_views v
  WHERE v.day BETWEEN _from AND _to
    AND (v.listing_id IN (SELECT id FROM public.listings WHERE owner_user_id = auth.uid())
      OR v.listing_id IN (SELECT published_listing_id FROM public.listing_drafts WHERE user_id = auth.uid() AND published_listing_id IS NOT NULL)
      OR v.listing_id IN (SELECT id::text FROM public.listing_drafts WHERE user_id = auth.uid()))
  GROUP BY v.listing_id
$$;
REVOKE EXECUTE ON FUNCTION public.seller_listing_views(date, date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.seller_listing_views(date, date) TO authenticated;

-- Accepted offers are consumed by exactly one order.
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS used_order_id uuid REFERENCES public.orders(id);