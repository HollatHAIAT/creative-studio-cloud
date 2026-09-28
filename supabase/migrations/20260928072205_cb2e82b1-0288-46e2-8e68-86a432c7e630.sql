CREATE OR REPLACE FUNCTION public.admin_set_listing_guidance(_id uuid, _note text, _actor uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(_actor) THEN RAISE EXCEPTION 'Staff only'; END IF;
  PERFORM set_config('app.listing_review', '1', true);
  UPDATE public.listing_drafts SET review_note = left(_note, 6000) WHERE id = _id AND status = 'rejected';
  IF NOT FOUND THEN RAISE EXCEPTION 'Only rejected listings'; END IF;
  PERFORM set_config('app.listing_review', '', true);
  INSERT INTO public.moderation_audit(actor, action, target_type, target_id, reason, details)
  VALUES (_actor, 'listing_guidance_sent', 'listing_draft', _id::text, '', jsonb_build_object('length', length(_note)));
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_set_listing_guidance(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_listing_guidance(uuid, text, uuid) TO service_role;