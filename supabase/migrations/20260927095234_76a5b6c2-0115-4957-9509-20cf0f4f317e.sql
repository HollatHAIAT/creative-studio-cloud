
CREATE TABLE public.review_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  message text NOT NULL CHECK (length(message) BETWEEN 5 AND 1000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','upheld','overturned')),
  decision_note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, user_id)
);
GRANT SELECT, INSERT ON public.review_appeals TO authenticated;
GRANT ALL ON public.review_appeals TO service_role;
ALTER TABLE public.review_appeals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Author or staff read appeals" ON public.review_appeals FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "Author appeals removed review" ON public.review_appeals FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id AND status = 'pending' AND EXISTS (SELECT 1 FROM public.reviews r WHERE r.id = review_id AND r.user_id = auth.uid() AND r.status = 'removed'));

CREATE OR REPLACE FUNCTION public.admin_decide_appeal(_appeal uuid, _overturn boolean, _note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.review_appeals; r public.reviews;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO a FROM public.review_appeals WHERE id = _appeal FOR UPDATE;
  IF a.id IS NULL OR a.status <> 'pending' THEN RAISE EXCEPTION 'NOT_PENDING'; END IF;
  SELECT * INTO r FROM public.reviews WHERE id = a.review_id;
  UPDATE public.review_appeals SET status = CASE WHEN _overturn THEN 'overturned' ELSE 'upheld' END, decision_note = _note, decided_by = auth.uid(), decided_at = now() WHERE id = _appeal;
  IF _overturn THEN UPDATE public.reviews SET status = 'visible', removed_reason = NULL WHERE id = a.review_id; END IF;
  INSERT INTO public.moderation_audit (actor, action, target_type, target_id, reason, details)
    VALUES (auth.uid(), CASE WHEN _overturn THEN 'appeal_overturned' ELSE 'appeal_upheld' END, 'review', a.review_id::text, coalesce(_note,''), jsonb_build_object('appeal', a.id));
  PERFORM public.push_notification(a.user_id, 'review',
    CASE WHEN _overturn THEN 'Appeal accepted — your review is back' ELSE 'Appeal reviewed — removal upheld' END,
    CASE WHEN _overturn THEN 'قُبل الاعتراض — أُعيد تقييمك' ELSE 'رُفض الاعتراض — بقي التقييم محذوفًا' END,
    coalesce(_note,''), coalesce(_note,''), '/my-reviews');
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_decide_appeal(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_decide_appeal(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_appeal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record;
BEGIN
  FOR s IN SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin','moderator') LOOP
    PERFORM public.push_notification(s.user_id, 'listing', 'New review appeal', 'اعتراض جديد على تقييم', left(NEW.message, 140), left(NEW.message, 140), '/admin/reviews');
  END LOOP;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_appeal() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER t_notify_appeal AFTER INSERT ON public.review_appeals FOR EACH ROW EXECUTE FUNCTION public.notify_appeal();

-- Removal notice now includes reason and points to My reviews (where the appeal button lives)
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
  IF _remove THEN
    PERFORM public.push_notification(r.user_id, 'review', 'Your review was removed', 'أُزيل تقييمك',
      'Reason: ' || coalesce(NULLIF(_reason,''),'policy') || ' — you can appeal from My reviews.',
      'السبب: ' || coalesce(NULLIF(_reason,''),'مخالفة السياسة') || ' — يمكنك الاعتراض من صفحة تقييماتي.', '/my-reviews');
  ELSIF r.status = 'removed' THEN
    PERFORM public.push_notification(r.user_id, 'review', 'Your review was restored', 'أُعيد تقييمك', '', '', '/my-reviews');
  END IF;
END $$;
