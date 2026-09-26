-- Lock down internal functions (triggers / helpers are not callable from the app)
REVOKE EXECUTE ON FUNCTION public.validate_bid() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_booking() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_outbid() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_booking() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_staff(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid, 'admin') OR public.has_role(_uid, 'moderator')
$$;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;

-- Notification preferences
CREATE TABLE public.notification_prefs (
  user_id uuid PRIMARY KEY,
  orders boolean NOT NULL DEFAULT true,
  tickets boolean NOT NULL DEFAULT true,
  bids boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_prefs TO authenticated;
GRANT ALL ON public.notification_prefs TO service_role;
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own prefs" ON public.notification_prefs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.push_notification(_uid uuid, _kind text, _t text, _tar text, _b text, _bar text, _link text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.notification_prefs;
BEGIN
  SELECT * INTO p FROM public.notification_prefs WHERE user_id = _uid;
  IF p.user_id IS NOT NULL AND (
     (_kind IN ('order','refund') AND NOT p.orders) OR (_kind = 'ticket' AND NOT p.tickets) OR (_kind = 'outbid' AND NOT p.bids)) THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, kind, title, title_ar, body, body_ar, link) VALUES (_uid, _kind, _t, _tar, _b, _bar, _link);
END $$;
REVOKE EXECUTE ON FUNCTION public.push_notification(uuid, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_outbid() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prev record;
BEGIN
  SELECT user_id INTO prev FROM public.bids WHERE auction_id = NEW.auction_id AND id <> NEW.id ORDER BY amount DESC LIMIT 1;
  IF prev.user_id IS NOT NULL AND prev.user_id IS DISTINCT FROM NEW.user_id THEN
    PERFORM public.push_notification(prev.user_id, 'outbid', 'You have been outbid', 'تمت المزايدة عليك', 'New top bid: $' || NEW.amount, 'أعلى مزايدة جديدة: $' || NEW.amount, '/auctions/' || NEW.auction_id);
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.notify_booking() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.push_notification(NEW.user_id, 'ticket', 'Ticket status: ' || replace(NEW.status, '_', ' '),
      'حالة التذكرة: ' || CASE NEW.status WHEN 'pending_payment' THEN 'بانتظار الدفع' WHEN 'confirmed' THEN 'مؤكدة' WHEN 'cancelled' THEN 'ملغاة' ELSE NEW.status END,
      NEW.reference || ' · ' || NEW.visit_date || ' ' || NEW.slot, NEW.reference || ' · ' || NEW.visit_date || ' ' || NEW.slot, '/orders');
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.notify_order() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.push_notification(NEW.user_id, 'order', 'Order received: ' || NEW.reference, 'تم استلام الطلب: ' || NEW.reference,
    'Total $' || NEW.total || ' · awaiting payment', 'الإجمالي $' || NEW.total || ' · بانتظار الدفع', '/orders/' || NEW.id);
  RETURN NEW;
END $$;

-- Staff can read all orders / bookings for review; bookings capacity check counts only active bookings
CREATE POLICY "Staff view all orders" ON public.orders FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff view all bookings" ON public.bookings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY "Users cancel own bookings" ON public.bookings;
REVOKE DELETE ON public.bookings FROM authenticated;

CREATE OR REPLACE FUNCTION public.validate_booking() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cap int; used int;
BEGIN
  IF NEW.visit_date < current_date THEN RAISE EXCEPTION 'DATE_PASSED'; END IF;
  SELECT capacity INTO cap FROM public.exhibitions WHERE id = NEW.exhibition_id FOR UPDATE;
  SELECT COALESCE(sum(quantity), 0) INTO used FROM public.bookings WHERE exhibition_id = NEW.exhibition_id AND visit_date = NEW.visit_date AND slot = NEW.slot AND status <> 'cancelled';
  IF used + NEW.quantity > cap THEN RAISE EXCEPTION 'SLOT_FULL'; END IF;
  NEW.status := 'pending_payment';
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.validate_booking() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.slot_bookings(_exhibition_id text, _date date)
RETURNS TABLE(slot text, booked int) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT slot, sum(quantity)::int FROM public.bookings WHERE exhibition_id = _exhibition_id AND visit_date = _date AND status <> 'cancelled' GROUP BY slot
$$;

-- Order change log
CREATE TABLE public.order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  actor uuid,
  from_status text,
  to_status text NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.order_events TO authenticated;
GRANT ALL ON public.order_events TO service_role;
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyer or staff view order history" ON public.order_events FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));

-- Tickets (issued when a booking is confirmed)
CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  code text NOT NULL UNIQUE DEFAULT upper(encode(gen_random_bytes(8), 'hex')),
  ticket_type text NOT NULL,
  status text NOT NULL DEFAULT 'valid',
  used_at timestamptz,
  scanned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own tickets" ON public.tickets FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;

CREATE TABLE public.ticket_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  result text NOT NULL,
  scanned_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ticket_scans TO authenticated;
GRANT ALL ON public.ticket_scans TO service_role;
ALTER TABLE public.ticket_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view scans" ON public.ticket_scans FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.issue_tickets(_booking_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.bookings; k text; n int; i int;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE id = _booking_id;
  IF EXISTS (SELECT 1 FROM public.tickets WHERE booking_id = _booking_id) THEN RETURN; END IF;
  FOR k, n IN SELECT key, value::int FROM jsonb_each_text(b.tickets) LOOP
    FOR i IN 1..n LOOP INSERT INTO public.tickets (booking_id, user_id, ticket_type) VALUES (b.id, b.user_id, k); END LOOP;
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.issue_tickets(uuid) FROM PUBLIC, anon, authenticated;

-- Staff check-in: validates instantly, blocks reuse, logs the scan time.
CREATE OR REPLACE FUNCTION public.check_in_ticket(_code text)
RETURNS TABLE(result text, ticket_type text, exhibition_id text, visit_date date, slot text, used_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.tickets; b public.bookings; r text;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'NOT_STAFF'; END IF;
  SELECT * INTO t FROM public.tickets WHERE code = upper(trim(_code)) FOR UPDATE;
  IF t.id IS NULL THEN r := 'not_found';
  ELSE
    SELECT * INTO b FROM public.bookings WHERE id = t.booking_id;
    IF t.status = 'used' THEN r := 'already_used';
    ELSIF t.status <> 'valid' OR b.status <> 'confirmed' THEN r := 'void';
    ELSIF b.visit_date <> current_date THEN r := 'wrong_date';
    ELSE
      UPDATE public.tickets SET status = 'used', used_at = now(), scanned_by = auth.uid() WHERE id = t.id RETURNING * INTO t;
      r := 'valid';
    END IF;
  END IF;
  INSERT INTO public.ticket_scans (code, ticket_id, result, scanned_by) VALUES (upper(trim(_code)), t.id, r, auth.uid());
  RETURN QUERY SELECT r, t.ticket_type, b.exhibition_id, b.visit_date, b.slot, t.used_at;
END $$;
REVOKE EXECUTE ON FUNCTION public.check_in_ticket(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_in_ticket(text) TO authenticated;

-- Staff sets order status; logs change, updates bookings & tickets, notifies buyer.
CREATE OR REPLACE FUNCTION public.admin_set_order_status(_order_id uuid, _status text, _note text DEFAULT '') RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders; bk record;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'NOT_STAFF'; END IF;
  IF _status NOT IN ('awaiting_payment','paid','processing','shipped','delivered','completed','cancelled','refunded') THEN RAISE EXCEPTION 'BAD_STATUS'; END IF;
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
    'الطلب ' || o.reference || ': ' || CASE _status WHEN 'paid' THEN 'مدفوع' WHEN 'processing' THEN 'قيد التجهيز' WHEN 'shipped' THEN 'تم الشحن' WHEN 'delivered' THEN 'تم التسليم' WHEN 'completed' THEN 'مكتمل' WHEN 'cancelled' THEN 'ملغى' WHEN 'refunded' THEN 'مسترد' ELSE 'بانتظار الدفع' END,
    COALESCE(_note, ''), COALESCE(_note, ''), '/orders/' || o.id);
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_set_order_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_order_status(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.log_order_created() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.order_events (order_id, actor, from_status, to_status, note) VALUES (NEW.id, NEW.user_id, NULL, NEW.status, 'Order placed');
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.log_order_created() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER orders_log AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.log_order_created();

-- Cancellation / refund requests
CREATE TABLE public.refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('cancel','refund')),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 1000),
  status text NOT NULL DEFAULT 'pending',
  decision_note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.refund_requests TO authenticated;
GRANT ALL ON public.refund_requests TO service_role;
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyer or staff view requests" ON public.refund_requests FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "Buyer requests for own order" ON public.refund_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
ALTER PUBLICATION supabase_realtime ADD TABLE public.refund_requests;

-- Eligibility: cancel before payment or before shipping; refund within 14 days of a paid/delivered order;
-- tickets only until 48h before the visit; digital licenses are not refundable once paid.
CREATE OR REPLACE FUNCTION public.validate_refund_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders; soonest date; has_license boolean;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = NEW.order_id;
  IF EXISTS (SELECT 1 FROM public.refund_requests WHERE order_id = NEW.order_id AND status = 'pending') THEN RAISE EXCEPTION 'REQUEST_PENDING'; END IF;
  IF o.status IN ('cancelled','refunded') THEN RAISE EXCEPTION 'ALREADY_CLOSED'; END IF;
  SELECT min(visit_date) INTO soonest FROM public.bookings WHERE order_id = o.id;
  IF soonest IS NOT NULL AND soonest < current_date + 2 THEN RAISE EXCEPTION 'TICKET_TOO_LATE'; END IF;
  has_license := EXISTS (SELECT 1 FROM jsonb_array_elements(o.items) it WHERE it->>'kind' = 'license');
  IF NEW.kind = 'cancel' AND o.status NOT IN ('awaiting_payment','paid','processing') THEN RAISE EXCEPTION 'CANCEL_NOT_ALLOWED'; END IF;
  IF NEW.kind = 'refund' THEN
    IF o.status NOT IN ('paid','processing','shipped','delivered','completed') THEN RAISE EXCEPTION 'NOT_PAID'; END IF;
    IF o.created_at < now() - interval '14 days' THEN RAISE EXCEPTION 'REFUND_WINDOW_CLOSED'; END IF;
    IF has_license AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(o.items) it WHERE it->>'kind' <> 'license') THEN RAISE EXCEPTION 'LICENSE_NOT_REFUNDABLE'; END IF;
  END IF;
  NEW.status := 'pending'; NEW.decided_by := NULL; NEW.decided_at := NULL; NEW.decision_note := NULL;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.validate_refund_request() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER refund_validate BEFORE INSERT ON public.refund_requests FOR EACH ROW EXECUTE FUNCTION public.validate_refund_request();

CREATE OR REPLACE FUNCTION public.admin_decide_refund(_request_id uuid, _approve boolean, _note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.refund_requests; target text;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'NOT_STAFF'; END IF;
  SELECT * INTO r FROM public.refund_requests WHERE id = _request_id FOR UPDATE;
  IF r.id IS NULL OR r.status <> 'pending' THEN RAISE EXCEPTION 'NOT_PENDING'; END IF;
  UPDATE public.refund_requests SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END, decision_note = _note, decided_by = auth.uid(), decided_at = now() WHERE id = r.id;
  IF _approve THEN
    target := CASE WHEN r.kind = 'cancel' THEN 'cancelled' ELSE 'refunded' END;
    PERFORM public.admin_set_order_status(r.order_id, target, 'Request approved: ' || COALESCE(_note, ''));
  ELSE
    INSERT INTO public.order_events (order_id, actor, from_status, to_status, note)
      SELECT r.order_id, auth.uid(), status, status, 'Request rejected: ' || COALESCE(_note, '') FROM public.orders WHERE id = r.order_id;
    PERFORM public.push_notification(r.user_id, 'refund', 'Your ' || r.kind || ' request was declined', 'تم رفض طلب ' || CASE r.kind WHEN 'cancel' THEN 'الإلغاء' ELSE 'الاسترداد' END,
      COALESCE(_note, ''), COALESCE(_note, ''), '/orders/' || r.order_id);
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_decide_refund(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_decide_refund(uuid, boolean, text) TO authenticated;

-- Staff can read reserve prices for reports
CREATE OR REPLACE FUNCTION public.admin_auction_reserves() RETURNS TABLE(id text, reserve numeric) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'NOT_STAFF'; END IF;
  RETURN QUERY SELECT a.id, a.reserve FROM public.auctions a;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_auction_reserves() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_auction_reserves() TO authenticated;