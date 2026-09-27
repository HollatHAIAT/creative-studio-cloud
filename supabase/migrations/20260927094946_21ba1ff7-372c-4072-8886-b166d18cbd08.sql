
-- Security: tighten function exposure
ALTER FUNCTION public.agent_authorization_valid(text, text) SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.is_blocked(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reply_to_review(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_moderate_review(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_reply_permission(text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.close_expired_blocks() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_confirm_payment(uuid, text) FROM PUBLIC, anon;

-- Audit trail
CREATE TABLE public.moderation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor uuid NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  reason text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.moderation_audit TO authenticated;
GRANT ALL ON public.moderation_audit TO service_role;
ALTER TABLE public.moderation_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read audit" ON public.moderation_audit FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- Verified purchase + helpful count
ALTER TABLE public.reviews ADD COLUMN verified boolean NOT NULL DEFAULT false, ADD COLUMN helpful_count int NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.has_purchased(_uid uuid, _listing text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.orders o, jsonb_array_elements(o.items) it
    WHERE o.user_id = _uid AND o.status NOT IN ('awaiting_payment','cancelled','refunded') AND it->>'listingId' = _listing)
$$;
REVOKE EXECUTE ON FUNCTION public.has_purchased(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_purchased(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN RETURN NEW; END IF;
  IF NOT public.has_purchased(NEW.user_id, NEW.listing_id) THEN RAISE EXCEPTION 'REVIEW_NOT_ELIGIBLE'; END IF;
  IF (SELECT count(*) FROM public.reviews WHERE user_id = NEW.user_id AND created_at > now() - interval '24 hours') >= 5 THEN RAISE EXCEPTION 'REVIEW_RATE_LIMIT'; END IF;
  IF length(NEW.body) > 0 AND EXISTS (SELECT 1 FROM public.reviews WHERE user_id = NEW.user_id AND lower(trim(body)) = lower(trim(NEW.body)) AND created_at > now() - interval '7 days') THEN RAISE EXCEPTION 'REVIEW_DUPLICATE'; END IF;
  IF (length(NEW.body) - length(replace(lower(NEW.body), 'http', ''))) / 4 > 1 THEN RAISE EXCEPTION 'REVIEW_SPAM'; END IF;
  NEW.verified := true;
  NEW.helpful_count := 0;
  NEW.author_name := left(coalesce(NULLIF(trim(NEW.author_name), ''), 'Buyer'), 60);
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.validate_review() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER t_validate_review BEFORE INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.validate_review();

-- Helpful votes
CREATE TABLE public.review_votes (
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.review_votes TO authenticated;
GRANT ALL ON public.review_votes TO service_role;
ALTER TABLE public.review_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own votes read" ON public.review_votes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Vote on others' reviews" ON public.review_votes FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id AND NOT public.is_blocked(auth.uid()) AND NOT EXISTS (SELECT 1 FROM public.reviews r WHERE r.id = review_id AND r.user_id = auth.uid()));
CREATE POLICY "Remove own vote" ON public.review_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.count_review_votes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.reviews SET helpful_count = (SELECT count(*) FROM public.review_votes WHERE review_id = coalesce(NEW.review_id, OLD.review_id))
   WHERE id = coalesce(NEW.review_id, OLD.review_id);
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.count_review_votes() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER t_count_votes AFTER INSERT OR DELETE ON public.review_votes FOR EACH ROW EXECUTE FUNCTION public.count_review_votes();

-- Moderation with audit
CREATE OR REPLACE FUNCTION public.admin_moderate_review(_review uuid, _remove boolean, _reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.reviews;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO r FROM public.reviews WHERE id = _review;
  IF r.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  UPDATE public.reviews SET status = CASE WHEN _remove THEN 'removed' ELSE 'visible' END, removed_reason = CASE WHEN _remove THEN _reason END WHERE id = _review;
  UPDATE public.review_reports SET resolved_at = now() WHERE review_id = _review AND resolved_at IS NULL;
  INSERT INTO public.moderation_audit (actor, action, target_type, target_id, reason, details)
    VALUES (auth.uid(), CASE WHEN _remove THEN 'review_removed' ELSE 'report_dismissed' END, 'review', _review::text, coalesce(_reason,''), jsonb_build_object('listing', r.listing_id, 'author', r.user_id));
  IF _remove THEN PERFORM public.push_notification(r.user_id, 'review', 'Your review was removed', 'أُزيل تقييمك', coalesce(_reason,''), coalesce(_reason,''), '/artwork/' || r.listing_id); END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_block_user(_uid uuid, _until timestamptz, _reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bid uuid;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _uid = auth.uid() THEN RAISE EXCEPTION 'CANNOT_BLOCK_SELF'; END IF;
  IF public.has_role(_uid, 'admin') THEN RAISE EXCEPTION 'CANNOT_BLOCK_ADMIN'; END IF;
  IF _until IS NOT NULL AND _until <= now() THEN RAISE EXCEPTION 'UNTIL_IN_PAST'; END IF;
  UPDATE public.user_blocks SET lifted_at = now() WHERE user_id = _uid AND lifted_at IS NULL;
  INSERT INTO public.user_blocks (user_id, reason, blocked_until, created_by) VALUES (_uid, coalesce(_reason,''), _until, auth.uid()) RETURNING id INTO bid;
  INSERT INTO public.moderation_audit (actor, action, target_type, target_id, reason, details)
    VALUES (auth.uid(), CASE WHEN _until IS NULL THEN 'user_suspended_permanent' ELSE 'user_suspended_temporary' END, 'user', _uid::text, coalesce(_reason,''), jsonb_build_object('until', _until));
  RETURN bid;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_block_user(uuid, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_block_user(uuid, timestamptz, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_lift_block(_uid uuid, _reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  UPDATE public.user_blocks SET lifted_at = now() WHERE user_id = _uid AND lifted_at IS NULL;
  INSERT INTO public.moderation_audit (actor, action, target_type, target_id, reason) VALUES (auth.uid(), 'user_reinstated', 'user', _uid::text, coalesce(_reason,''));
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_lift_block(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_lift_block(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_reply_permission(_listing text, _allowed boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  UPDATE public.listings SET owner_can_reply = _allowed WHERE id = _listing;
  INSERT INTO public.moderation_audit (actor, action, target_type, target_id, details) VALUES (auth.uid(), 'reply_permission', 'listing', _listing, jsonb_build_object('allowed', _allowed));
END $$;

-- Authors of reviews are shown by name snapshot only; staff see user ids.
