ALTER TABLE public.listing_drafts
  ADD COLUMN seller_role text NOT NULL DEFAULT 'owner' CHECK (seller_role IN ('owner','agent','consignment','heir','joint_owner','gallery')),
  ADD COLUMN owner_name text NOT NULL DEFAULT '' CHECK (char_length(owner_name) <= 120),
  ADD COLUMN owner_email text CHECK (owner_email IS NULL OR char_length(owner_email) <= 255),
  ADD COLUMN co_owners jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN consignment_terms text NOT NULL DEFAULT '' CHECK (char_length(consignment_terms) <= 2000),
  ADD COLUMN owner_approved_at timestamptz,
  ADD COLUMN is_heritage boolean NOT NULL DEFAULT false,
  ADD COLUMN heritage_type text CHECK (heritage_type IS NULL OR heritage_type IN ('manuscript','textile','jewellery','coin','map','woodwork','metalwork','ceramics','architectural','clothing','other')),
  ADD COLUMN origin_region text NOT NULL DEFAULT '' CHECK (char_length(origin_region) <= 120),
  ADD COLUMN era text NOT NULL DEFAULT '' CHECK (char_length(era) <= 120),
  ADD COLUMN provenance jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN condition_grade text CHECK (condition_grade IS NULL OR condition_grade IN ('excellent','good','fair','restored','poor')),
  ADD COLUMN condition_report text NOT NULL DEFAULT '' CHECK (char_length(condition_report) <= 4000),
  ADD COLUMN export_permit_ref text NOT NULL DEFAULT '' CHECK (char_length(export_permit_ref) <= 120);

-- Approval can only be set by approve_listing_as_owner; owner changes clear it.
CREATE OR REPLACE FUNCTION public.guard_owner_approval() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('app.owner_approval', true), '') = '1' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN NEW.owner_approved_at := NULL; RETURN NEW; END IF;
  IF NEW.seller_role IS DISTINCT FROM OLD.seller_role OR lower(coalesce(NEW.owner_email,'')) IS DISTINCT FROM lower(coalesce(OLD.owner_email,''))
     OR NEW.co_owners IS DISTINCT FROM OLD.co_owners OR NEW.consignment_terms IS DISTINCT FROM OLD.consignment_terms THEN
    NEW.owner_approved_at := NULL;
  ELSE
    NEW.owner_approved_at := OLD.owner_approved_at;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_owner_approval BEFORE INSERT OR UPDATE ON public.listing_drafts FOR EACH ROW EXECUTE FUNCTION public.guard_owner_approval();

CREATE POLICY "Named owner reads drafts naming them" ON public.listing_drafts FOR SELECT TO authenticated
  USING (owner_email IS NOT NULL AND lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

CREATE OR REPLACE FUNCTION public.approve_listing_as_owner(_draft uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.listing_drafts; me text;
BEGIN
  SELECT lower(email) INTO me FROM auth.users WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL;
  SELECT * INTO d FROM public.listing_drafts WHERE id = _draft FOR UPDATE;
  IF d.id IS NULL OR me IS NULL OR d.seller_role = 'owner' OR lower(coalesce(d.owner_email,'')) <> me THEN RAISE EXCEPTION 'NOT_THE_OWNER'; END IF;
  IF d.user_id = auth.uid() THEN RAISE EXCEPTION 'SELLER_CANNOT_SELF_APPROVE'; END IF;
  PERFORM set_config('app.owner_approval', '1', true);
  UPDATE public.listing_drafts SET owner_approved_at = now() WHERE id = _draft;
  PERFORM set_config('app.owner_approval', '', true);
  INSERT INTO public.moderation_audit(actor, action, target_type, target_id, reason, details)
  VALUES (auth.uid(), 'owner_approved_listing', 'listing_draft', _draft::text, '', jsonb_build_object('seller_role', d.seller_role, 'owner_email', me));
  PERFORM public.push_notification(d.user_id, 'listing', 'The owner approved your listing', 'وافق المالك على إعلانك', d.title, d.title_ar, '/listing-writer');
END $$;
REVOKE EXECUTE ON FUNCTION public.approve_listing_as_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_listing_as_owner(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.ownership_heritage_issues(d public.listing_drafts) RETURNS text[] LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT array_remove(ARRAY[
    CASE WHEN d.seller_role <> 'owner' AND (coalesce(d.owner_email,'') = '' OR btrim(d.owner_name) = '') THEN 'owner_details' END,
    CASE WHEN d.seller_role <> 'owner' AND d.owner_approved_at IS NULL THEN 'owner_approval' END,
    CASE WHEN d.seller_role = 'consignment' AND btrim(d.consignment_terms) = '' THEN 'consignment_terms' END,
    CASE WHEN d.is_heritage AND d.heritage_type IS NULL THEN 'heritage_type' END,
    CASE WHEN d.is_heritage AND (btrim(d.origin_region) = '' OR btrim(d.era) = '') THEN 'heritage_origin' END,
    CASE WHEN d.is_heritage AND jsonb_array_length(d.provenance) = 0 THEN 'provenance' END,
    CASE WHEN d.is_heritage AND (d.condition_grade IS NULL OR btrim(d.condition_report) = '') THEN 'condition_report' END
  ], NULL) $$;

CREATE OR REPLACE FUNCTION public.platform_validation_issues(_id uuid) RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.listing_drafts; p public.review_policies; out text[] := '{}';
BEGIN
  SELECT * INTO d FROM public.listing_drafts WHERE id = _id;
  IF NOT FOUND OR NOT (d.user_id = auth.uid() OR public.caller_is_staff()) THEN RETURN ARRAY['not_found']; END IF;
  SELECT * INTO p FROM public.review_policies WHERE id = 1;
  out := out || coalesce(public.listing_draft_publish_issues(d), '{}') || coalesce(public.ownership_heritage_issues(d), '{}');
  IF EXISTS (SELECT 1 FROM public.user_blocks WHERE user_id = d.user_id AND lifted_at IS NULL AND (blocked_until IS NULL OR blocked_until > now())) THEN out := out || 'account_suspended'; END IF;
  IF NOT d.owner_declared THEN out := out || 'ownership_not_declared'; END IF;
  IF d.price IS NULL OR d.price <= 0 THEN out := out || 'price'; END IF;
  IF d.category IS NULL THEN out := out || 'category'; END IF;
  IF NOT p.allow_direct_publish THEN out := out || 'policy_direct_disabled'; END IF;
  IF d.category = ANY(p.platform_review_categories) OR d.is_heritage THEN out := out || 'policy_category_needs_review'; END IF;
  IF d.price > p.platform_review_price_over THEN out := out || 'policy_price_needs_review'; END IF;
  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.admin_publish_listing(_id uuid, _price numeric, _category text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE d public.listing_drafts; lid text;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Staff only'; END IF;
  IF _price IS NULL OR _price <= 0 OR _price > 10000000 THEN RAISE EXCEPTION 'Enter a price above 0'; END IF;
  IF _category NOT IN ('Painting','Photography','Calligraphy','Sadu','Qatt','Pottery','Illustration','Digital','Print','Heritage') THEN RAISE EXCEPTION 'Choose a category'; END IF;
  SELECT * INTO d FROM public.listing_drafts WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF d.status <> 'approved' THEN RAISE EXCEPTION 'Only approved listings can be published'; END IF;
  IF array_length(public.listing_draft_publish_issues(d), 1) > 0 THEN RAISE EXCEPTION 'Listing no longer passes the readiness checks'; END IF;
  IF array_length(public.ownership_heritage_issues(d), 1) > 0 THEN RAISE EXCEPTION 'Ownership or heritage checks failed: %', array_to_string(public.ownership_heritage_issues(d), ','); END IF;
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
END $function$;