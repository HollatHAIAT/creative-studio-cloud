
ALTER TABLE public.orders ADD COLUMN idempotency_key text;
CREATE UNIQUE INDEX orders_user_idem ON public.orders (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
ALTER TABLE public.orders ADD COLUMN payment_attempts int NOT NULL DEFAULT 0, ADD COLUMN payment_error text;

CREATE OR REPLACE FUNCTION public.admin_mark_payment_failed(_order uuid, _error text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = _order FOR UPDATE;
  IF o.status <> 'awaiting_payment' THEN RAISE EXCEPTION 'NOT_AWAITING_PAYMENT'; END IF;
  UPDATE public.orders SET payment_error = left(coalesce(_error,'Payment failed'), 300), payment_attempts = payment_attempts + 1 WHERE id = _order;
  PERFORM public.admin_set_order_status(_order, 'payment_failed', coalesce(_error, 'Payment failed'));
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_mark_payment_failed(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mark_payment_failed(uuid, text) TO authenticated;

/** Buyer retries a failed payment: the order goes back to awaiting payment (max 5 attempts). */
CREATE OR REPLACE FUNCTION public.retry_payment(_order uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order AND user_id = auth.uid() FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF o.status <> 'payment_failed' THEN RAISE EXCEPTION 'NOT_RETRYABLE'; END IF;
  IF o.payment_attempts >= 5 THEN RAISE EXCEPTION 'TOO_MANY_ATTEMPTS'; END IF;
  UPDATE public.orders SET status = 'awaiting_payment', payment_error = NULL WHERE id = _order;
  INSERT INTO public.order_events (order_id, actor, from_status, to_status, note) VALUES (_order, auth.uid(), 'payment_failed', 'awaiting_payment', 'Buyer retried payment');
END $$;
REVOKE EXECUTE ON FUNCTION public.retry_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retry_payment(uuid) TO authenticated;
