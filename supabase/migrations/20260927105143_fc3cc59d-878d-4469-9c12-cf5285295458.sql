ALTER TABLE public.email_outbox
  ADD COLUMN last_error text,
  ADD COLUMN last_attempt_at timestamptz;
ALTER TABLE public.email_outbox ADD CONSTRAINT email_outbox_status_chk CHECK (status IN ('queued','sending','sent','failed','cancelled'));

-- Staff: put a failed (or cancelled) email back in the queue.
CREATE OR REPLACE FUNCTION public.admin_retry_email(_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e public.email_outbox;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO e FROM email_outbox WHERE id = _id FOR UPDATE;
  IF e.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF e.status NOT IN ('failed','cancelled') THEN RAISE EXCEPTION 'NOT_RETRYABLE'; END IF;
  IF e.attempts >= 10 THEN RAISE EXCEPTION 'TOO_MANY_ATTEMPTS'; END IF;
  UPDATE email_outbox SET status = 'queued', last_error = NULL WHERE id = _id;
  INSERT INTO moderation_audit (actor, action, target_type, target_id, reason, details)
    VALUES (auth.uid(), 'email_retry', 'email', _id::text, '', jsonb_build_object('kind', e.kind, 'attempts', e.attempts));
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_retry_email(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_retry_email(uuid) TO authenticated;

-- Staff: stop a queued email from going out.
CREATE OR REPLACE FUNCTION public.admin_cancel_email(_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  UPDATE email_outbox SET status = 'cancelled' WHERE id = _id AND status IN ('queued','failed');
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_CANCELLABLE'; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_cancel_email(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_cancel_email(uuid) TO authenticated;