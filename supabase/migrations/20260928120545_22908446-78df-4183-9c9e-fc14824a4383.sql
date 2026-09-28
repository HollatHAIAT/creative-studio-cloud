ALTER TABLE public.listing_reviewers
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  ADD COLUMN IF NOT EXISTS responded_at timestamptz;

CREATE OR REPLACE FUNCTION public.active_reviewer(_draft uuid, _uid uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.permission FROM public.listing_reviewers r JOIN auth.users u ON lower(u.email) = lower(r.email)
  WHERE r.draft_id = _draft AND u.id = _uid AND r.status <> 'declined'
    AND r.starts_at <= now() AND (r.expires_at IS NULL OR r.expires_at > now()) LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.respond_review_invite(_id uuid, _accept boolean) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.listing_reviewers; me text;
BEGIN
  SELECT lower(email) INTO me FROM auth.users WHERE id = auth.uid();
  SELECT * INTO r FROM public.listing_reviewers WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR me IS NULL OR lower(r.email) <> me THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF r.expires_at IS NOT NULL AND r.expires_at <= now() THEN RAISE EXCEPTION 'This invitation has expired'; END IF;
  UPDATE public.listing_reviewers SET status = CASE WHEN _accept THEN 'accepted' ELSE 'declined' END, responded_at = now() WHERE id = _id;
  PERFORM public.push_notification(r.invited_by, 'order',
    CASE WHEN _accept THEN 'A reviewer accepted your invitation' ELSE 'A reviewer declined your invitation' END,
    CASE WHEN _accept THEN 'قبل مراجع دعوتك' ELSE 'اعتذر مراجع عن دعوتك' END,
    r.email, r.email, '/review-invites');
  RETURN CASE WHEN _accept THEN 'accepted' ELSE 'declined' END;
END $$;
REVOKE EXECUTE ON FUNCTION public.respond_review_invite(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_review_invite(uuid, boolean) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.active_reviewer(uuid, uuid) FROM PUBLIC, anon;