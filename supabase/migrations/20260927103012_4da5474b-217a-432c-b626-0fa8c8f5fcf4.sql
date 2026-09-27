ALTER TABLE public.notification_prefs
  ADD COLUMN IF NOT EXISTS shipping boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_orders boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_shipping boolean NOT NULL DEFAULT true;

-- Emails waiting to be sent (delivered once an email sender domain is set up).
CREATE TABLE public.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  subject text NOT NULL,
  subject_ar text NOT NULL,
  body text NOT NULL DEFAULT '',
  body_ar text NOT NULL DEFAULT '',
  link text,
  status text NOT NULL DEFAULT 'queued',
  attempts int NOT NULL DEFAULT 0,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_outbox TO authenticated;
GRANT ALL ON public.email_outbox TO service_role;
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read email outbox" ON public.email_outbox FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.push_notification(_uid uuid, _kind text, _t text, _tar text, _b text, _bar text, _link text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p public.notification_prefs; in_app boolean := true; by_email boolean := false;
BEGIN
  SELECT * INTO p FROM public.notification_prefs WHERE user_id = _uid;
  IF p.user_id IS NULL THEN
    by_email := _kind IN ('order','refund','shipping');
  ELSE
    in_app := NOT ((_kind IN ('order','refund') AND NOT p.orders) OR (_kind = 'shipping' AND NOT p.shipping) OR (_kind = 'ticket' AND NOT p.tickets) OR (_kind = 'outbid' AND NOT p.bids));
    by_email := (_kind IN ('order','refund') AND p.email_orders) OR (_kind = 'shipping' AND p.email_shipping);
  END IF;
  IF in_app THEN
    INSERT INTO public.notifications (user_id, kind, title, title_ar, body, body_ar, link) VALUES (_uid, _kind, _t, _tar, _b, _bar, _link);
  END IF;
  IF by_email THEN
    INSERT INTO public.email_outbox (user_id, kind, subject, subject_ar, body, body_ar, link) VALUES (_uid, _kind, _t, _tar, _b, _bar, _link);
  END IF;
END $function$;
REVOKE EXECUTE ON FUNCTION public.push_notification(uuid,text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_order_status(_order_id uuid, _status text, _note text DEFAULT ''::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE o public.orders; bk record;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'NOT_STAFF'; END IF;
  IF _status NOT IN ('awaiting_payment','payment_failed','paid','processing','shipped','delivered','completed','cancelled','refunded') THEN RAISE EXCEPTION 'BAD_STATUS'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF o.status = _status THEN RETURN; END IF;
  UPDATE public.orders SET status = _status WHERE id = _order_id;
  INSERT INTO public.order_events (order_id, actor, from_status, to_status, note) VALUES (_order_id, auth.uid(), o.status, _status, COALESCE(_note, ''));
  FOR bk IN SELECT id FROM public.bookings WHERE order_id = _order_id LOOP
    IF _status IN ('paid','processing','completed') THEN
      UPDATE public.bookings SET status = 'confirmed' WHERE id = bk.id AND status <> 'confirmed';
      PERFORM public.issue_tickets(bk.id);
    ELSIF _status IN ('cancelled','refunded') THEN
      UPDATE public.bookings SET status = 'cancelled' WHERE id = bk.id;
      UPDATE public.tickets SET status = 'void' WHERE booking_id = bk.id AND status = 'valid';
    END IF;
  END LOOP;
  PERFORM public.push_notification(o.user_id, CASE WHEN _status IN ('shipped','delivered') THEN 'shipping' ELSE 'order' END,
    'Order ' || o.reference || ': ' || replace(_status, '_', ' '),
    'الطلب ' || o.reference || ': ' || CASE _status WHEN 'paid' THEN 'مدفوع' WHEN 'payment_failed' THEN 'فشل الدفع' WHEN 'processing' THEN 'قيد التجهيز' WHEN 'shipped' THEN 'تم الشحن' WHEN 'delivered' THEN 'تم التسليم' WHEN 'completed' THEN 'مكتمل' WHEN 'cancelled' THEN 'ملغى' WHEN 'refunded' THEN 'مسترد' ELSE 'بانتظار الدفع' END,
    COALESCE(_note, ''), COALESCE(_note, ''), '/orders/' || o.id);
END $function$;