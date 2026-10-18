ALTER TABLE public.supplier_accounts DROP CONSTRAINT supplier_accounts_status_check;
ALTER TABLE public.supplier_accounts ADD CONSTRAINT supplier_accounts_status_check CHECK (status = ANY (ARRAY['pending','active','rejected','suspended']));
ALTER TABLE public.supplier_accounts ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.supplier_accounts ADD COLUMN IF NOT EXISTS review_note text NOT NULL DEFAULT '';
ALTER TABLE public.supplier_accounts ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.supplier_accounts ADD COLUMN IF NOT EXISTS reviewed_by uuid;

DROP POLICY "Supplier creates own account" ON public.supplier_accounts;
CREATE POLICY "Supplier creates own account" ON public.supplier_accounts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending' AND NOT public.is_blocked(auth.uid()));

-- Pending (and rejected, to fix and resubmit) suppliers may prepare products; only active ones are visible or sellable.
DROP POLICY "Supplier manages own products" ON public.supplier_products;
CREATE POLICY "Supplier manages own products" ON public.supplier_products FOR ALL TO authenticated
  USING (auth.uid() = supplier_id)
  WITH CHECK (auth.uid() = supplier_id AND EXISTS (SELECT 1 FROM public.supplier_accounts s WHERE s.user_id = auth.uid() AND s.status IN ('active','pending','rejected')));

-- A rejected supplier editing their account goes back to the review queue.
CREATE OR REPLACE FUNCTION public.guard_supplier_status()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT public.is_staff(auth.uid())
     AND NOT (OLD.status = 'rejected' AND NEW.status = 'pending' AND auth.uid() = OLD.user_id) THEN
    RAISE EXCEPTION 'STAFF_ONLY';
  END IF;
  IF NOT public.is_staff(auth.uid()) THEN NEW.review_note := OLD.review_note; NEW.reviewed_at := OLD.reviewed_at; NEW.reviewed_by := OLD.reviewed_by; END IF;
  NEW.updated_at := now(); RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_review_supplier(_user uuid, _decision text, _note text DEFAULT '')
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE acc public.supplier_accounts;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'STAFF_ONLY'; END IF;
  IF _decision NOT IN ('active','rejected','suspended') THEN RAISE EXCEPTION 'BAD_DECISION'; END IF;
  IF _decision = 'rejected' AND char_length(trim(coalesce(_note,''))) < 5 THEN RAISE EXCEPTION 'NOTE_REQUIRED'; END IF;
  UPDATE public.supplier_accounts SET status = _decision, review_note = left(coalesce(_note,''), 1000), reviewed_at = now(), reviewed_by = auth.uid()
    WHERE user_id = _user RETURNING * INTO acc;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  PERFORM public.push_notification(_user, 'orders',
    CASE _decision WHEN 'active' THEN 'Your supplier shop is approved' WHEN 'rejected' THEN 'Your supplier shop needs changes' ELSE 'Your supplier shop is suspended' END,
    CASE _decision WHEN 'active' THEN 'تمت الموافقة على متجر المورّد' WHEN 'rejected' THEN 'متجر المورّد يحتاج إلى تعديلات' ELSE 'تم إيقاف متجر المورّد' END,
    coalesce(_note,''), coalesce(_note,''), '/supplier');
END $$;
REVOKE ALL ON FUNCTION public.admin_review_supplier(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_supplier(uuid, text, text) TO authenticated;

-- Checkout only accepts products from approved suppliers.
CREATE OR REPLACE FUNCTION public.route_supplier_lines() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it jsonb; p public.supplier_products; q int;
BEGIN
  FOR it IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
    CONTINUE WHEN it->>'kind' <> 'supply' OR (it->>'supplyId') !~ '^[0-9a-f-]{36}$';
    SELECT * INTO p FROM public.supplier_products WHERE id = (it->>'supplyId')::uuid FOR UPDATE;
    IF NOT FOUND OR p.status <> 'published'
       OR NOT EXISTS (SELECT 1 FROM public.supplier_accounts s WHERE s.user_id = p.supplier_id AND s.status = 'active') THEN
      RAISE EXCEPTION 'LISTING_UNAVAILABLE';
    END IF;
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