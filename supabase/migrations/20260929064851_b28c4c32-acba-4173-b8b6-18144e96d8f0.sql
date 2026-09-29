CREATE TABLE public.inventory_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id text NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  actor uuid,
  from_stock integer,
  to_stock integer,
  source text NOT NULL CHECK (source IN ('manual','sale','restock')),
  reason text NOT NULL DEFAULT '',
  order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.inventory_adjustments TO authenticated;
GRANT ALL ON public.inventory_adjustments TO service_role;
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner or staff read adjustments" ON public.inventory_adjustments FOR SELECT TO authenticated
USING (public.caller_is_staff() OR EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.owner_user_id = auth.uid()));

DROP FUNCTION IF EXISTS public.set_listing_stock(text, integer, integer);
CREATE FUNCTION public.set_listing_stock(_listing text, _stock integer, _low integer DEFAULT NULL, _reason text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l listings; staff boolean := public.is_staff(auth.uid());
BEGIN
  SELECT * INTO l FROM listings WHERE id = _listing FOR UPDATE;
  IF l.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF l.owner_user_id IS DISTINCT FROM auth.uid() AND NOT staff THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _stock IS NOT NULL AND (_stock < 0 OR _stock > 100000) THEN RAISE EXCEPTION 'BAD_STOCK'; END IF;
  UPDATE listings SET stock = _stock, low_stock_at = coalesce(_low, low_stock_at) WHERE id = _listing;
  IF l.stock IS DISTINCT FROM _stock THEN
    INSERT INTO inventory_adjustments (listing_id, actor, from_stock, to_stock, source, reason)
    VALUES (_listing, auth.uid(), l.stock, _stock, 'manual', left(coalesce(_reason,''), 300));
  END IF;
  IF staff AND l.owner_user_id IS DISTINCT FROM auth.uid() THEN
    INSERT INTO moderation_audit (actor, action, target_type, target_id, reason, details)
    VALUES (auth.uid(), 'stock_update', 'listing', _listing, coalesce(_reason,''), jsonb_build_object('from', l.stock, 'to', _stock));
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_listing_stock(text, integer, integer, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_listing_stock(text, integer, integer, text) TO authenticated;

-- Automatic stock decrement when an order becomes paid
CREATE OR REPLACE FUNCTION public.decrement_stock_on_paid() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it jsonb; l listings; q integer; nxt integer;
BEGIN
  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
    FOR it IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
      CONTINUE WHEN it->>'listingId' IS NULL;
      SELECT * INTO l FROM listings WHERE id = it->>'listingId' FOR UPDATE;
      CONTINUE WHEN l.id IS NULL OR l.stock IS NULL;
      q := greatest(coalesce((it->>'qty')::int, 1), 1);
      nxt := greatest(l.stock - q, 0);
      UPDATE listings SET stock = nxt WHERE id = l.id;
      INSERT INTO inventory_adjustments (listing_id, actor, from_stock, to_stock, source, reason, order_id)
      VALUES (l.id, NULL, l.stock, nxt, 'sale', 'Order ' || NEW.reference, NEW.id);
      IF l.owner_user_id IS NOT NULL AND nxt <= l.low_stock_at THEN
        PERFORM push_notification(l.owner_user_id, 'listing',
          CASE WHEN nxt = 0 THEN 'Sold out: ' ELSE 'Low stock: ' END || l.title,
          CASE WHEN nxt = 0 THEN 'نفد المخزون: ' ELSE 'مخزون منخفض: ' END || coalesce(nullif(l.title_ar,''), l.title),
          'Remaining: ' || nxt, 'المتبقي: ' || nxt, '/seller-dashboard');
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER t_orders_decrement_stock AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.decrement_stock_on_paid();

-- Seller sales aggregates for caller's own listings only
CREATE OR REPLACE FUNCTION public.seller_sales(_from date, _to date)
RETURNS TABLE(day date, listing_id text, units integer, revenue numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (o.created_at AT TIME ZONE 'Asia/Riyadh')::date, it->>'listingId',
         sum(coalesce((it->>'qty')::int,1))::int, sum(coalesce((it->>'amount')::numeric,0))
  FROM orders o CROSS JOIN LATERAL jsonb_array_elements(o.items) it
  JOIN listings l ON l.id = it->>'listingId' AND l.owner_user_id = auth.uid()
  WHERE o.status IN ('paid','processing','shipped','delivered','completed')
    AND (o.created_at AT TIME ZONE 'Asia/Riyadh')::date BETWEEN _from AND _to
  GROUP BY 1, 2 ORDER BY 1
$$;
REVOKE EXECUTE ON FUNCTION public.seller_sales(date, date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.seller_sales(date, date) TO authenticated;