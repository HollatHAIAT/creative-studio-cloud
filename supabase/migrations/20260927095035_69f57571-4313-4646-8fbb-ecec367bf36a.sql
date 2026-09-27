
ALTER TABLE public.reviews DROP CONSTRAINT reviews_status_check;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_status_check CHECK (status IN ('visible','removed','deleted'));
ALTER TABLE public.reviews ADD COLUMN edited_at timestamptz;
DROP POLICY "Users delete own review" ON public.reviews;
REVOKE DELETE ON public.reviews FROM authenticated;
DROP POLICY "Public reads visible reviews" ON public.reviews;
CREATE POLICY "Public reads visible reviews" ON public.reviews FOR SELECT USING (status = 'visible' OR (auth.uid() = user_id AND status <> 'deleted') OR public.is_staff(auth.uid()));

CREATE TABLE public.review_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  author uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('edited','deleted')),
  old_rating int NOT NULL, old_body text NOT NULL,
  new_rating int, new_body text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.review_revisions TO authenticated;
GRANT ALL ON public.review_revisions TO service_role;
ALTER TABLE public.review_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read revisions" ON public.review_revisions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.edit_my_review(_review uuid, _rating int, _body text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.reviews;
BEGIN
  SELECT * INTO r FROM public.reviews WHERE id = _review FOR UPDATE;
  IF r.id IS NULL OR r.user_id <> auth.uid() OR r.status <> 'visible' THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF public.is_blocked(auth.uid()) THEN RAISE EXCEPTION 'BLOCKED'; END IF;
  IF r.created_at < now() - interval '48 hours' THEN RAISE EXCEPTION 'EDIT_WINDOW_CLOSED'; END IF;
  IF _rating < 1 OR _rating > 5 OR length(coalesce(_body,'')) > 2000 THEN RAISE EXCEPTION 'INVALID'; END IF;
  IF (length(_body) - length(replace(lower(_body), 'http', ''))) / 4 > 1 THEN RAISE EXCEPTION 'REVIEW_SPAM'; END IF;
  INSERT INTO public.review_revisions (review_id, author, action, old_rating, old_body, new_rating, new_body) VALUES (r.id, auth.uid(), 'edited', r.rating, r.body, _rating, _body);
  UPDATE public.reviews SET rating = _rating, body = _body, edited_at = now() WHERE id = r.id;
END $$;
REVOKE EXECUTE ON FUNCTION public.edit_my_review(uuid, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_my_review(uuid, int, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_my_review(_review uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.reviews;
BEGIN
  SELECT * INTO r FROM public.reviews WHERE id = _review FOR UPDATE;
  IF r.id IS NULL OR r.user_id <> auth.uid() OR r.status = 'deleted' THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF r.created_at < now() - interval '7 days' THEN RAISE EXCEPTION 'DELETE_WINDOW_CLOSED'; END IF;
  INSERT INTO public.review_revisions (review_id, author, action, old_rating, old_body) VALUES (r.id, auth.uid(), 'deleted', r.rating, r.body);
  UPDATE public.reviews SET status = 'deleted' WHERE id = r.id;
END $$;
REVOKE EXECUTE ON FUNCTION public.delete_my_review(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_review(uuid) TO authenticated;
