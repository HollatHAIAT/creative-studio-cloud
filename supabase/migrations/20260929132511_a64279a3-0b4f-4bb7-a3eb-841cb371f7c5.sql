CREATE TABLE public.supplier_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  name_ar text NOT NULL DEFAULT '' CHECK (char_length(name_ar) <= 120),
  city text NOT NULL DEFAULT '' CHECK (char_length(city) <= 80),
  city_ar text NOT NULL DEFAULT '' CHECK (char_length(city_ar) <= 80),
  phone text NOT NULL DEFAULT '' CHECK (char_length(phone) <= 30),
  email text NOT NULL DEFAULT '' CHECK (char_length(email) <= 255),
  about text NOT NULL DEFAULT '' CHECK (char_length(about) <= 1500),
  about_ar text NOT NULL DEFAULT '' CHECK (char_length(about_ar) <= 1500),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.supplier_accounts TO anon;
GRANT SELECT, INSERT, UPDATE ON public.supplier_accounts TO authenticated;
GRANT ALL ON public.supplier_accounts TO service_role;
ALTER TABLE public.supplier_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads active suppliers" ON public.supplier_accounts FOR SELECT USING (status = 'active' OR auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "Supplier creates own account" ON public.supplier_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'active' AND NOT public.is_blocked(auth.uid()));
CREATE POLICY "Supplier or staff updates" ON public.supplier_accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_staff(auth.uid())) WITH CHECK (auth.uid() = user_id OR public.is_staff(auth.uid()));
-- Suppliers can't lift their own suspension.
CREATE OR REPLACE FUNCTION public.guard_supplier_status() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'STAFF_ONLY'; END IF;
  NEW.updated_at := now(); RETURN NEW;
END $$;
CREATE TRIGGER supplier_accounts_guard BEFORE UPDATE ON public.supplier_accounts FOR EACH ROW EXECUTE FUNCTION public.guard_supplier_status();

CREATE TABLE public.supplier_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.supplier_accounts(user_id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 160),
  name_ar text NOT NULL CHECK (char_length(name_ar) BETWEEN 2 AND 160),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1500),
  description_ar text NOT NULL DEFAULT '' CHECK (char_length(description_ar) <= 1500),
  type text NOT NULL CHECK (type IN ('paint','brush','canvas','calligraphy','clay','textile')),
  price numeric NOT NULL CHECK (price > 0 AND price <= 100000),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  low_stock_at integer NOT NULL DEFAULT 5 CHECK (low_stock_at >= 0),
  swatch text NOT NULL DEFAULT 'oklch(0.6 0.07 70)' CHECK (char_length(swatch) <= 60),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.supplier_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_products TO authenticated;
GRANT ALL ON public.supplier_products TO service_role;
ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads published products of active suppliers" ON public.supplier_products FOR SELECT
  USING ((status = 'published' AND EXISTS (SELECT 1 FROM public.supplier_accounts s WHERE s.user_id = supplier_id AND s.status = 'active')) OR auth.uid() = supplier_id OR public.is_staff(auth.uid()));
CREATE POLICY "Supplier manages own products" ON public.supplier_products FOR ALL TO authenticated
  USING (auth.uid() = supplier_id) WITH CHECK (auth.uid() = supplier_id AND EXISTS (SELECT 1 FROM public.supplier_accounts s WHERE s.user_id = auth.uid() AND s.status = 'active'));
CREATE TRIGGER supplier_products_touch BEFORE UPDATE ON public.supplier_products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.supplier_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.supplier_accounts(user_id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.supplier_products(id) ON DELETE SET NULL,
  title text NOT NULL,
  title_ar text NOT NULL,
  qty integer NOT NULL,
  unit numeric NOT NULL,
  amount numeric NOT NULL,
  ship_to jsonb,
  buyer_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','preparing','shipped','delivered','cancelled')),
  tracking text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.supplier_order_lines TO authenticated;
GRANT ALL ON public.supplier_order_lines TO service_role;
ALTER TABLE public.supplier_order_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Supplier, buyer or staff read lines" ON public.supplier_order_lines FOR SELECT TO authenticated
  USING (auth.uid() = supplier_id OR public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));

-- Every order: route supplier-product lines to their supplier and reserve stock (fails the order if not enough).
CREATE OR REPLACE FUNCTION public.route_supplier_lines() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it jsonb; p public.supplier_products; q int;
BEGIN
  FOR it IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
    CONTINUE WHEN it->>'kind' <> 'supply' OR (it->>'supplyId') !~ '^[0-9a-f-]{36}$';
    SELECT * INTO p FROM public.supplier_products WHERE id = (it->>'supplyId')::uuid FOR UPDATE;
    IF NOT FOUND OR p.status <> 'published' THEN RAISE EXCEPTION 'LISTING_UNAVAILABLE'; END IF;
    q := (it->>'qty')::int;
    IF p.stock < q THEN RAISE EXCEPTION '%', CASE WHEN p.stock = 0 THEN 'OUT_OF_STOCK' ELSE 'NOT_ENOUGH_STOCK' END; END IF;
    UPDATE public.supplier_products SET stock = stock - q WHERE id = p.id;
    INSERT INTO public.supplier_order_lines(order_id, supplier_id, product_id, title, title_ar, qty, unit, amount, ship_to, buyer_name)
    VALUES (NEW.id, p.supplier_id, p.id, p.name, p.name_ar, q, (it->>'unit')::numeric, (it->>'amount')::numeric, NEW.shipping_address, COALESCE(NEW.contact->>'name', ''));
    PERFORM public.push_notification(p.supplier_id, 'orders', 'New supplies order', 'طلب مستلزمات جديد',
      q || ' × ' || p.name || ' — ' || NEW.reference, q || ' × ' || p.name_ar || ' — ' || NEW.reference, '/supplier');
    IF p.stock - q <= p.low_stock_at THEN
      PERFORM public.push_notification(p.supplier_id, 'orders', 'Low stock', 'مخزون منخفض', p.name || ': ' || (p.stock - q) || ' left', p.name_ar || ': متبقٍ ' || (p.stock - q), '/supplier');
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER orders_route_supplier_lines AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.route_supplier_lines();

-- Supplier updates fulfilment; cancelling returns stock.
CREATE OR REPLACE FUNCTION public.supplier_update_line(_line uuid, _status text, _tracking text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.supplier_order_lines; buyer uuid;
BEGIN
  SELECT * INTO l FROM public.supplier_order_lines WHERE id = _line FOR UPDATE;
  IF NOT FOUND OR (l.supplier_id <> auth.uid() AND NOT public.is_staff(auth.uid())) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  IF _status NOT IN ('new','preparing','shipped','delivered','cancelled') THEN RAISE EXCEPTION 'BAD_STATUS'; END IF;
  IF l.status IN ('delivered','cancelled') AND _status <> l.status THEN RAISE EXCEPTION 'LINE_CLOSED'; END IF;
  IF _status = 'cancelled' AND l.status <> 'cancelled' AND l.product_id IS NOT NULL THEN
    UPDATE public.supplier_products SET stock = stock + l.qty WHERE id = l.product_id;
  END IF;
  UPDATE public.supplier_order_lines SET status = _status, tracking = left(COALESCE(_tracking, ''), 120), updated_at = now() WHERE id = _line;
  IF _status IS DISTINCT FROM l.status THEN
    SELECT user_id INTO buyer FROM public.orders WHERE id = l.order_id;
    PERFORM public.push_notification(buyer, 'shipping', 'Supplies order update', 'تحديث طلب المستلزمات',
      l.title || ': ' || _status, l.title_ar || ': ' || CASE _status WHEN 'preparing' THEN 'قيد التجهيز' WHEN 'shipped' THEN 'تم الشحن' WHEN 'delivered' THEN 'تم التسليم' WHEN 'cancelled' THEN 'أُلغي' ELSE 'جديد' END,
      '/orders/' || l.order_id);
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.supplier_update_line(uuid, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.supplier_update_line(uuid, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.route_supplier_lines() FROM anon, public, authenticated;