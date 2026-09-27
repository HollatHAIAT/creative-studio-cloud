REVOKE EXECUTE ON FUNCTION public.has_purchased(uuid, text) FROM authenticated;
CREATE OR REPLACE FUNCTION public.can_review(_listing text) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.orders o, jsonb_array_elements(o.items) it
    WHERE o.user_id = auth.uid() AND o.status NOT IN ('awaiting_payment','cancelled','refunded') AND it->>'listingId' = _listing)
$$;
GRANT EXECUTE ON FUNCTION public.can_review(text) TO authenticated;