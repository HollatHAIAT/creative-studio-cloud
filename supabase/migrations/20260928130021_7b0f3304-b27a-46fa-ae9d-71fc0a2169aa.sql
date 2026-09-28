ALTER TABLE public.listings
  ADD COLUMN stock integer CHECK (stock IS NULL OR stock BETWEEN 0 AND 100000),
  ADD COLUMN low_stock_at integer NOT NULL DEFAULT 2 CHECK (low_stock_at BETWEEN 0 AND 1000);

CREATE OR REPLACE FUNCTION public.set_listing_stock(_listing text, _stock integer, _low integer DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l listings; staff boolean := public.is_staff(auth.uid());
BEGIN
  SELECT * INTO l FROM listings WHERE id = _listing FOR UPDATE;
  IF l.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF l.owner_user_id IS DISTINCT FROM auth.uid() AND NOT staff THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _stock IS NOT NULL AND (_stock < 0 OR _stock > 100000) THEN RAISE EXCEPTION 'BAD_STOCK'; END IF;
  UPDATE listings SET stock = _stock, low_stock_at = coalesce(_low, low_stock_at) WHERE id = _listing;
  IF staff AND l.owner_user_id IS DISTINCT FROM auth.uid() THEN
    INSERT INTO moderation_audit (actor, action, target_type, target_id, reason, details)
    VALUES (auth.uid(), 'stock_update', 'listing', _listing, '', jsonb_build_object('from', l.stock, 'to', _stock));
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_listing_stock(text, integer, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_listing_stock(text, integer, integer) TO authenticated;