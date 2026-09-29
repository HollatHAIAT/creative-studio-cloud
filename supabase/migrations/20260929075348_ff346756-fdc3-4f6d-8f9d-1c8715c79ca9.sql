CREATE TABLE public.platform_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  return_days integer NOT NULL DEFAULT 14 CHECK (return_days BETWEEN 0 AND 365),
  print_ship_min_days integer NOT NULL DEFAULT 5 CHECK (print_ship_min_days BETWEEN 1 AND 90),
  print_ship_max_days integer NOT NULL DEFAULT 7 CHECK (print_ship_max_days BETWEEN 1 AND 90),
  commercial_print_limit integer NOT NULL DEFAULT 5000 CHECK (commercial_print_limit BETWEEN 1 AND 10000000),
  commercial_multiplier numeric NOT NULL DEFAULT 4 CHECK (commercial_multiplier BETWEEN 1 AND 100),
  extended_multiplier numeric NOT NULL DEFAULT 10 CHECK (extended_multiplier BETWEEN 1 AND 100),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (print_ship_min_days <= print_ship_max_days)
);
GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT UPDATE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read platform settings" ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY "Admins update platform settings" ON public.platform_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.platform_settings (id) VALUES (1);

CREATE OR REPLACE FUNCTION public.validate_refund_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders; soonest date; has_license boolean; days integer;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = NEW.order_id;
  SELECT return_days INTO days FROM public.platform_settings WHERE id = 1;
  days := COALESCE(days, 14);
  IF EXISTS (SELECT 1 FROM public.refund_requests WHERE order_id = NEW.order_id AND status = 'pending') THEN RAISE EXCEPTION 'REQUEST_PENDING'; END IF;
  IF o.status IN ('cancelled','refunded') THEN RAISE EXCEPTION 'ALREADY_CLOSED'; END IF;
  SELECT min(visit_date) INTO soonest FROM public.bookings WHERE order_id = o.id;
  IF soonest IS NOT NULL AND soonest < current_date + 2 THEN RAISE EXCEPTION 'TICKET_TOO_LATE'; END IF;
  has_license := EXISTS (SELECT 1 FROM jsonb_array_elements(o.items) it WHERE it->>'kind' = 'license');
  IF NEW.kind = 'cancel' AND o.status NOT IN ('awaiting_payment','paid','processing') THEN RAISE EXCEPTION 'CANCEL_NOT_ALLOWED'; END IF;
  IF NEW.kind = 'refund' THEN
    IF o.status NOT IN ('paid','processing','shipped','delivered','completed') THEN RAISE EXCEPTION 'NOT_PAID'; END IF;
    IF o.created_at < now() - make_interval(days => days) THEN RAISE EXCEPTION 'REFUND_WINDOW_CLOSED'; END IF;
    IF has_license AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(o.items) it WHERE it->>'kind' <> 'license') THEN RAISE EXCEPTION 'LICENSE_NOT_REFUNDABLE'; END IF;
  END IF;
  NEW.status := 'pending'; NEW.decided_by := NULL; NEW.decided_at := NULL; NEW.decision_note := NULL;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.validate_refund_request() FROM PUBLIC, anon, authenticated;