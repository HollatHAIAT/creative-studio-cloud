ALTER TABLE public.listing_drafts
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

CREATE OR REPLACE FUNCTION public.guard_listing_draft_publish()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE issues text[]; by_staff boolean := coalesce(current_setting('app.listing_review', true), '') = '1';
BEGIN
  IF NEW.status NOT IN ('draft','submitted','approved','rejected') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  IF NEW.status IN ('approved','rejected') AND NOT by_staff THEN
    IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'Only staff can approve or reject listings'; END IF;
    -- Seller edits after review send it back to draft.
    NEW.status := 'draft'; NEW.submitted_at := NULL; RETURN NEW;
  END IF;
  IF by_staff THEN RETURN NEW; END IF;
  IF NEW.status = 'submitted' THEN
    issues := public.listing_draft_publish_issues(NEW);
    IF array_length(issues, 1) > 0 THEN
      RAISE EXCEPTION 'Mobile readiness checks failed: %', array_to_string(issues, ',') USING ERRCODE = 'P0001';
    END IF;
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'submitted' THEN
      NEW.submitted_at := now(); NEW.review_note := NULL; NEW.reviewed_by := NULL; NEW.reviewed_at := NULL;
    END IF;
  ELSE
    NEW.submitted_at := NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE POLICY "Staff read all listing drafts" ON public.listing_drafts FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) AND status <> 'draft');

CREATE POLICY "Staff read artwork images" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'artwork-images' AND public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.admin_review_listing(_id uuid, _approve boolean, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.listing_drafts;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Staff only'; END IF;
  SELECT * INTO d FROM public.listing_drafts WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF d.status <> 'submitted' THEN RAISE EXCEPTION 'Only submitted listings can be reviewed'; END IF;
  IF NOT _approve AND length(btrim(coalesce(_note,''))) < 5 THEN RAISE EXCEPTION 'Please give the seller a reason (at least 5 characters)'; END IF;
  PERFORM set_config('app.listing_review', '1', true);
  UPDATE public.listing_drafts SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    review_note = nullif(btrim(coalesce(_note,'')), ''), reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = _id;
  PERFORM set_config('app.listing_review', '', true);
  INSERT INTO public.moderation_audit(actor, action, target_type, target_id, reason, details)
  VALUES (auth.uid(), CASE WHEN _approve THEN 'listing_approved' ELSE 'listing_rejected' END, 'listing_draft', _id::text, coalesce(_note,''), jsonb_build_object('title', d.title));
  PERFORM public.push_notification(d.user_id, 'order',
    CASE WHEN _approve THEN 'Your listing was approved' ELSE 'Your listing needs changes' END,
    CASE WHEN _approve THEN 'تمت الموافقة على إعلانك' ELSE 'إعلانك يحتاج إلى تعديلات' END,
    coalesce(d.title,'') || coalesce(' — ' || nullif(btrim(coalesce(_note,'')), ''), ''),
    coalesce(d.title_ar,'') || coalesce(' — ' || nullif(btrim(coalesce(_note,'')), ''), ''),
    '/listing-writer');
END $$;
GRANT EXECUTE ON FUNCTION public.admin_review_listing(uuid, boolean, text) TO authenticated;