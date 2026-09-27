CREATE OR REPLACE FUNCTION public.admin_set_order_status(_order_id uuid, _status text, _note text DEFAULT ''::text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  PERFORM public.push_notification(o.user_id, 'order', 'Order ' || o.reference || ': ' || replace(_status, '_', ' '),
    'الطلب ' || o.reference || ': ' || CASE _status WHEN 'paid' THEN 'مدفوع' WHEN 'payment_failed' THEN 'فشل الدفع' WHEN 'processing' THEN 'قيد التجهيز' WHEN 'shipped' THEN 'تم الشحن' WHEN 'delivered' THEN 'تم التسليم' WHEN 'completed' THEN 'مكتمل' WHEN 'cancelled' THEN 'ملغى' WHEN 'refunded' THEN 'مسترد' ELSE 'بانتظار الدفع' END,
    COALESCE(_note, ''), COALESCE(_note, ''), '/orders/' || o.id);
END $$;