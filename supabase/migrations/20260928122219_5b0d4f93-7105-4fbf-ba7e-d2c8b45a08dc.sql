ALTER TABLE public.email_outbox ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.email_outbox ADD COLUMN IF NOT EXISTS to_email text, ADD COLUMN IF NOT EXISTS ref_id uuid;
ALTER TABLE public.email_outbox DROP CONSTRAINT email_outbox_status_chk;
ALTER TABLE public.email_outbox ADD CONSTRAINT email_outbox_status_chk CHECK (status IN ('queued','sending','sent','failed','cancelled','bounced'));
CREATE INDEX IF NOT EXISTS email_outbox_ref_idx ON public.email_outbox (ref_id);

CREATE OR REPLACE FUNCTION public.queue_reviewer_invite_email(_invite uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.listing_reviewers; d public.listing_drafts; uid uuid; eid uuid; dates text; dates_ar text;
BEGIN
  SELECT * INTO r FROM public.listing_reviewers WHERE id = _invite;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  SELECT * INTO d FROM public.listing_drafts WHERE id = r.draft_id;
  SELECT id INTO uid FROM auth.users WHERE lower(email) = lower(r.email);
  dates := to_char(r.starts_at, 'YYYY-MM-DD') || coalesce(' to ' || to_char(r.expires_at, 'YYYY-MM-DD'), ' (no end date)');
  dates_ar := to_char(r.starts_at, 'YYYY-MM-DD') || coalesce(' إلى ' || to_char(r.expires_at, 'YYYY-MM-DD'), ' (بلا تاريخ انتهاء)');
  INSERT INTO public.email_outbox (user_id, to_email, ref_id, kind, subject, subject_ar, body, body_ar, link)
  VALUES (uid, lower(r.email), r.id, 'review_invite',
    'You are invited to review "' || coalesce(nullif(d.title,''), 'an artwork') || '" on Arwiqa',
    'دعوة لمراجعة «' || coalesce(nullif(d.title_ar,''), 'عمل فني') || '» على أروقة',
    'You have been invited to review an artwork listing. Review dates: ' || dates || '. Your access: ' || r.permission || '. Sign in with this email address to open it.',
    'دُعيت لمراجعة إعلان عمل فني. مدة المراجعة: ' || dates_ar || '. صلاحيتك: ' || r.permission || '. سجّل الدخول بهذا البريد لفتحه.',
    '/review-invites')
  RETURNING id INTO eid;
  RETURN eid;
END $$;
REVOKE EXECUTE ON FUNCTION public.queue_reviewer_invite_email(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.on_reviewer_invited() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.queue_reviewer_invite_email(NEW.id); RETURN NEW; END $$;
REVOKE EXECUTE ON FUNCTION public.on_reviewer_invited() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_reviewer_invited AFTER INSERT ON public.listing_reviewers FOR EACH ROW EXECUTE FUNCTION public.on_reviewer_invited();

CREATE OR REPLACE FUNCTION public.admin_resend_reviewer_invite(_invite uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE eid uuid; r public.listing_reviewers;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO r FROM public.listing_reviewers WHERE id = _invite;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF r.expires_at IS NOT NULL AND r.expires_at <= now() THEN RAISE EXCEPTION 'INVITE_EXPIRED'; END IF;
  IF (SELECT count(*) FROM public.email_outbox WHERE ref_id = _invite) >= 10 THEN RAISE EXCEPTION 'TOO_MANY_ATTEMPTS'; END IF;
  UPDATE public.email_outbox SET status = 'cancelled' WHERE ref_id = _invite AND status IN ('queued','failed');
  eid := public.queue_reviewer_invite_email(_invite);
  INSERT INTO public.moderation_audit (actor, action, target_type, target_id, reason, details)
  VALUES (auth.uid(), 'reviewer_invite_resent', 'listing_draft', r.draft_id::text, '', jsonb_build_object('invite', _invite, 'email', r.email, 'email_id', eid));
  RETURN eid;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_resend_reviewer_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resend_reviewer_invite(uuid) TO authenticated;

SELECT public.queue_reviewer_invite_email(id) FROM public.listing_reviewers r
WHERE NOT EXISTS (SELECT 1 FROM public.email_outbox e WHERE e.ref_id = r.id);