ALTER TABLE public.listing_drafts ADD COLUMN IF NOT EXISTS published_listing_id text, ADD COLUMN IF NOT EXISTS published_at timestamptz, ADD COLUMN IF NOT EXISTS published_by uuid, ADD COLUMN IF NOT EXISTS price numeric, ADD COLUMN IF NOT EXISTS category text;

CREATE OR REPLACE FUNCTION public.guard_listing_draft_publish()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE issues text[]; by_staff boolean := coalesce(current_setting('app.listing_review', true), '') = '1';
BEGIN
  IF NEW.status NOT IN ('draft','submitted','approved','rejected','published') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  IF by_staff THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'published' THEN RAISE EXCEPTION 'Published listings can only be changed by staff'; END IF;
  IF NEW.status IN ('approved','rejected','published') THEN
    IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'Only staff can approve, reject or publish listings'; END IF;
    NEW.status := 'draft'; NEW.submitted_at := NULL; RETURN NEW;
  END IF;
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
END $function$;

CREATE OR REPLACE FUNCTION public.admin_publish_listing(_id uuid, _price numeric, _category text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.listing_drafts; lid text;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Staff only'; END IF;
  IF _price IS NULL OR _price <= 0 OR _price > 10000000 THEN RAISE EXCEPTION 'Enter a price above 0'; END IF;
  IF _category NOT IN ('Painting','Photography','Calligraphy','Sadu','Qatt','Pottery','Illustration','Digital','Print') THEN RAISE EXCEPTION 'Choose a category'; END IF;
  SELECT * INTO d FROM public.listing_drafts WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF d.status <> 'approved' THEN RAISE EXCEPTION 'Only approved listings can be published'; END IF;
  IF array_length(public.listing_draft_publish_issues(d), 1) > 0 THEN RAISE EXCEPTION 'Listing no longer passes the readiness checks'; END IF;
  lid := coalesce(d.published_listing_id, 'sl-' || substr(replace(d.id::text, '-', ''), 1, 10));
  INSERT INTO public.listings (id, title, title_ar, creator_id, category, owner_user_id, status, price)
  VALUES (lid, d.title, d.title_ar, 'seller-' || d.user_id::text, _category, d.user_id, 'published', _price)
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, title_ar = EXCLUDED.title_ar, category = EXCLUDED.category, price = EXCLUDED.price, status = 'published';
  PERFORM set_config('app.listing_review', '1', true);
  UPDATE public.listing_drafts SET status = 'published', published_listing_id = lid, published_at = now(), published_by = auth.uid(), price = _price, category = _category WHERE id = _id;
  PERFORM set_config('app.listing_review', '', true);
  INSERT INTO public.moderation_audit(actor, action, target_type, target_id, reason, details)
  VALUES (auth.uid(), 'listing_published', 'listing_draft', _id::text, '', jsonb_build_object('listing', lid, 'price', _price, 'category', _category));
  PERFORM public.push_notification(d.user_id, 'order', 'Your listing is live in the shop', 'إعلانك منشور الآن في المتجر', d.title, d.title_ar, '/listing/' || lid);
  RETURN lid;
END $$;

CREATE OR REPLACE FUNCTION public.admin_unpublish_listing(_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.listing_drafts;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Staff only'; END IF;
  SELECT * INTO d FROM public.listing_drafts WHERE id = _id FOR UPDATE;
  IF d.id IS NULL OR d.status <> 'published' THEN RAISE EXCEPTION 'Listing is not published'; END IF;
  UPDATE public.listings SET status = 'hidden' WHERE id = d.published_listing_id;
  PERFORM set_config('app.listing_review', '1', true);
  UPDATE public.listing_drafts SET status = 'approved', published_at = NULL WHERE id = _id;
  PERFORM set_config('app.listing_review', '', true);
  INSERT INTO public.moderation_audit(actor, action, target_type, target_id, reason, details)
  VALUES (auth.uid(), 'listing_unpublished', 'listing_draft', _id::text, coalesce(_reason,''), jsonb_build_object('listing', d.published_listing_id));
  PERFORM public.push_notification(d.user_id, 'order', 'Your listing was taken out of the shop', 'أُزيل إعلانك من المتجر', coalesce(_reason,''), coalesce(_reason,''), '/listing-writer');
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_publish_listing(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_unpublish_listing(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_publish_listing(uuid, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_unpublish_listing(uuid, text) TO authenticated, service_role;