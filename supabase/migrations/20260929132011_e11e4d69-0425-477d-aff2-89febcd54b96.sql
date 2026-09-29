CREATE OR REPLACE FUNCTION public.consume_accepted_offer(_offer uuid, _order uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = _order AND user_id = auth.uid()) THEN RAISE EXCEPTION 'NOT_YOUR_ORDER'; END IF;
  UPDATE public.offers SET used_order_id = _order, updated_at = now()
   WHERE id = _offer AND user_id = auth.uid() AND status = 'accepted' AND used_order_id IS NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.consume_accepted_offer(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.consume_accepted_offer(uuid, uuid) TO authenticated;