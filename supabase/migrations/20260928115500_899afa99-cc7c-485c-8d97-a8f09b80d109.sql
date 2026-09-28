CREATE TABLE public.review_policies (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  allow_direct_publish boolean NOT NULL DEFAULT true,
  platform_review_categories text[] NOT NULL DEFAULT ARRAY['Heritage']::text[],
  platform_review_price_over numeric NOT NULL DEFAULT 50000,
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.review_policies (id) VALUES (1);
GRANT SELECT ON public.review_policies TO anon, authenticated;
GRANT UPDATE ON public.review_policies TO authenticated;
GRANT ALL ON public.review_policies TO service_role;
ALTER TABLE public.review_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads review policy" ON public.review_policies FOR SELECT USING (true);
CREATE POLICY "Staff update review policy" ON public.review_policies FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

ALTER TABLE public.listing_drafts
  ADD COLUMN IF NOT EXISTS review_mode text NOT NULL DEFAULT 'platform',
  ADD COLUMN IF NOT EXISTS owner_declared boolean NOT NULL DEFAULT false;
ALTER TABLE public.listing_drafts ADD CONSTRAINT listing_drafts_review_mode_chk
  CHECK (review_mode IN ('direct','self','team','external','curator','gallery','ai','ai_team','platform'));

CREATE TABLE public.listing_reviewers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.listing_drafts(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (length(email) BETWEEN 3 AND 254 AND email LIKE '%@%'),
  role text NOT NULL DEFAULT 'external' CHECK (role IN ('team','external','curator','gallery')),
  permission text NOT NULL DEFAULT 'comment' CHECK (permission IN ('view','comment','score','recommend')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  allow_download boolean NOT NULL DEFAULT false,
  watermark boolean NOT NULL DEFAULT true,
  invited_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_id, email)
);
CREATE OR REPLACE FUNCTION public.draft_owner(_draft uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT user_id FROM public.listing_drafts WHERE id = _draft $$;
CREATE OR REPLACE FUNCTION public.active_reviewer(_draft uuid, _uid uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.permission FROM public.listing_reviewers r JOIN auth.users u ON lower(u.email) = lower(r.email)
  WHERE r.draft_id = _draft AND u.id = _uid AND r.starts_at <= now() AND (r.expires_at IS NULL OR r.expires_at > now()) LIMIT 1 $$;
GRANT EXECUTE ON FUNCTION public.draft_owner(uuid), public.active_reviewer(uuid, uuid) TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_reviewers TO authenticated;
GRANT ALL ON public.listing_reviewers TO service_role;
ALTER TABLE public.listing_reviewers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages reviewers" ON public.listing_reviewers FOR ALL TO authenticated
  USING (public.draft_owner(draft_id) = auth.uid()) WITH CHECK (public.draft_owner(draft_id) = auth.uid());
CREATE POLICY "Reviewer sees own invite" ON public.listing_reviewers FOR SELECT TO authenticated
  USING (lower(email) = lower(coalesce(auth.jwt()->>'email','')) OR public.is_staff(auth.uid()));

CREATE POLICY "Active reviewers read invited drafts" ON public.listing_drafts FOR SELECT TO authenticated
  USING (public.active_reviewer(id, auth.uid()) IS NOT NULL);

CREATE TABLE public.listing_review_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.listing_drafts(id) ON DELETE CASCADE,
  author uuid NOT NULL DEFAULT auth.uid(),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  visibility text NOT NULL DEFAULT 'artist' CHECK (visibility IN ('private','team','reviewers','artist','anonymous','internal')),
  score int CHECK (score BETWEEN 1 AND 5),
  recommendation text CHECK (recommendation IN ('approve','changes','reject')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.listing_review_comments TO authenticated;
GRANT ALL ON public.listing_review_comments TO service_role;
ALTER TABLE public.listing_review_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comment read by visibility" ON public.listing_review_comments FOR SELECT TO authenticated USING (
  author = auth.uid() OR public.is_staff(auth.uid())
  OR (visibility IN ('team','reviewers','artist','anonymous') AND public.draft_owner(draft_id) = auth.uid())
  OR (visibility IN ('team','reviewers') AND public.active_reviewer(draft_id, auth.uid()) IS NOT NULL));
CREATE POLICY "Owner or reviewer comments" ON public.listing_review_comments FOR INSERT TO authenticated WITH CHECK (
  author = auth.uid() AND (
    (public.draft_owner(draft_id) = auth.uid() AND visibility IN ('private','team','reviewers'))
    OR (public.active_reviewer(draft_id, auth.uid()) IN ('comment','score','recommend') AND visibility <> 'internal' AND visibility <> 'private'
        AND (score IS NULL OR public.active_reviewer(draft_id, auth.uid()) IN ('score','recommend'))
        AND (recommendation IS NULL OR public.active_reviewer(draft_id, auth.uid()) = 'recommend'))
    OR (public.is_staff(auth.uid()) AND visibility = 'internal')));

-- Always-on platform checks (not creative review)
CREATE OR REPLACE FUNCTION public.platform_validation_issues(_id uuid) RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.listing_drafts; p public.review_policies; out text[] := '{}';
BEGIN
  SELECT * INTO d FROM public.listing_drafts WHERE id = _id;
  IF NOT FOUND THEN RETURN ARRAY['not_found']; END IF;
  SELECT * INTO p FROM public.review_policies WHERE id = 1;
  out := out || coalesce(public.listing_draft_publish_issues(d), '{}');
  IF public.is_blocked(d.user_id) THEN out := out || 'account_suspended'; END IF;
  IF NOT d.owner_declared THEN out := out || 'ownership_not_declared'; END IF;
  IF d.price IS NULL OR d.price <= 0 THEN out := out || 'price'; END IF;
  IF d.category IS NULL THEN out := out || 'category'; END IF;
  IF NOT p.allow_direct_publish THEN out := out || 'policy_direct_disabled'; END IF;
  IF d.category = ANY(p.platform_review_categories) THEN out := out || 'policy_category_needs_review'; END IF;
  IF d.price > p.platform_review_price_over THEN out := out || 'policy_price_needs_review'; END IF;
  RETURN out;
END $$;
GRANT EXECUTE ON FUNCTION public.platform_validation_issues(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.seller_publish_direct(_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.listing_drafts; lid text; issues text[];
BEGIN
  SELECT * INTO d FROM public.listing_drafts WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR d.user_id <> auth.uid() THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF d.status = 'published' THEN RETURN d.published_listing_id; END IF;
  IF d.category NOT IN ('Painting','Photography','Calligraphy','Sadu','Qatt','Pottery','Illustration','Digital','Print','Heritage') THEN RAISE EXCEPTION 'Platform checks failed: category'; END IF;
  issues := public.platform_validation_issues(_id);
  IF array_length(issues,1) > 0 THEN RAISE EXCEPTION 'Platform checks failed: %', array_to_string(issues, ',') USING ERRCODE = 'P0001'; END IF;
  lid := coalesce(d.published_listing_id, 'sl-' || substr(replace(d.id::text, '-', ''), 1, 10));
  INSERT INTO public.listings (id, title, title_ar, creator_id, category, owner_user_id, status, price)
  VALUES (lid, d.title, d.title_ar, 'seller-' || d.user_id::text, d.category, d.user_id, 'published', d.price)
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, title_ar = EXCLUDED.title_ar, category = EXCLUDED.category, price = EXCLUDED.price, status = 'published';
  PERFORM set_config('app.listing_review', '1', true);
  UPDATE public.listing_drafts SET status = 'published', review_mode = 'direct', published_listing_id = lid, published_at = now(), published_by = auth.uid() WHERE id = _id;
  PERFORM set_config('app.listing_review', '', true);
  INSERT INTO public.moderation_audit(actor, action, target_type, target_id, reason, details)
  VALUES (auth.uid(), 'listing_direct_published', 'listing_draft', _id::text, '', jsonb_build_object('listing', lid, 'price', d.price, 'category', d.category));
  RETURN lid;
END $$;
REVOKE EXECUTE ON FUNCTION public.seller_publish_direct(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seller_publish_direct(uuid) TO authenticated;