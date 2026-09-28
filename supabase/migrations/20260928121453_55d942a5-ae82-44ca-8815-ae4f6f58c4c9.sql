CREATE OR REPLACE FUNCTION public.caller_is_staff() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NULL OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','moderator')) $$;
REVOKE EXECUTE ON FUNCTION public.caller_is_staff() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (_user_id = auth.uid() OR public.caller_is_staff())
     AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_blocked(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (_uid = auth.uid() OR public.caller_is_staff())
     AND EXISTS (SELECT 1 FROM public.user_blocks WHERE user_id = _uid AND lifted_at IS NULL AND (blocked_until IS NULL OR blocked_until > now())) $$;

CREATE OR REPLACE FUNCTION public.draft_owner(_draft uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id FROM public.listing_drafts WHERE id = _draft AND (user_id = auth.uid() OR public.caller_is_staff()) $$;

CREATE OR REPLACE FUNCTION public.active_reviewer(_draft uuid, _uid uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.permission FROM public.listing_reviewers r JOIN auth.users u ON lower(u.email) = lower(r.email)
  WHERE r.draft_id = _draft AND u.id = _uid AND (_uid = auth.uid() OR public.caller_is_staff()) AND r.status <> 'declined'
    AND r.starts_at <= now() AND (r.expires_at IS NULL OR r.expires_at > now()) LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.platform_validation_issues(_id uuid) RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.listing_drafts; p public.review_policies; out text[] := '{}';
BEGIN
  SELECT * INTO d FROM public.listing_drafts WHERE id = _id;
  IF NOT FOUND OR NOT (d.user_id = auth.uid() OR public.caller_is_staff()) THEN RETURN ARRAY['not_found']; END IF;
  SELECT * INTO p FROM public.review_policies WHERE id = 1;
  out := out || coalesce(public.listing_draft_publish_issues(d), '{}');
  IF EXISTS (SELECT 1 FROM public.user_blocks WHERE user_id = d.user_id AND lifted_at IS NULL AND (blocked_until IS NULL OR blocked_until > now())) THEN out := out || 'account_suspended'; END IF;
  IF NOT d.owner_declared THEN out := out || 'ownership_not_declared'; END IF;
  IF d.price IS NULL OR d.price <= 0 THEN out := out || 'price'; END IF;
  IF d.category IS NULL THEN out := out || 'category'; END IF;
  IF NOT p.allow_direct_publish THEN out := out || 'policy_direct_disabled'; END IF;
  IF d.category = ANY(p.platform_review_categories) THEN out := out || 'policy_category_needs_review'; END IF;
  IF d.price > p.platform_review_price_over THEN out := out || 'policy_price_needs_review'; END IF;
  RETURN out;
END $$;