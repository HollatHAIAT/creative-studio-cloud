CREATE OR REPLACE FUNCTION public.admin_retry_reminder_email(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e public.email_outbox; inv public.listing_reviewers;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO e FROM email_outbox WHERE id = _id FOR UPDATE;
  IF e.id IS NULL OR e.kind <> 'review_reminder' THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF e.status NOT IN ('failed','bounced','cancelled') THEN RAISE EXCEPTION 'NOT_RETRYABLE'; END IF;
  IF e.attempts >= 10 THEN RAISE EXCEPTION 'TOO_MANY_ATTEMPTS'; END IF;
  SELECT * INTO inv FROM listing_reviewers WHERE id = e.ref_id;
  IF inv.id IS NULL OR inv.status = 'declined' OR (inv.expires_at IS NOT NULL AND inv.expires_at <= now()) THEN RAISE EXCEPTION 'EXPIRED'; END IF;
  UPDATE email_outbox SET status = 'queued', last_error = NULL WHERE id = _id;
  INSERT INTO moderation_audit (actor, action, target_type, target_id, reason, details)
    VALUES (auth.uid(), 'reminder_email_retry', 'email', _id::text, coalesce(e.last_error, ''),
      jsonb_build_object('invite_id', inv.id, 'draft_id', inv.draft_id, 'previous_status', e.status, 'attempts', e.attempts, 'expires_at', inv.expires_at));
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_retry_reminder_email(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_retry_reminder_email(uuid) TO authenticated;