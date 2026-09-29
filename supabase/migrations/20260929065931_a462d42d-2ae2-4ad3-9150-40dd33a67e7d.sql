CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  topic text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  order_ref text,
  status text NOT NULL DEFAULT 'open',
  reply text,
  replied_by uuid,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_topic_ok CHECK (topic IN ('order','payment','shipping','licensing','selling','auction','exhibition','account','other')),
  CONSTRAINT support_status_ok CHECK (status IN ('open','answered','closed')),
  CONSTRAINT support_len CHECK (char_length(subject) BETWEEN 3 AND 150 AND char_length(message) BETWEEN 10 AND 3000)
);
GRANT SELECT, INSERT ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or staff read" ON public.support_tickets FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.caller_is_staff());
CREATE POLICY "create own open ticket" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'open' AND reply IS NULL AND replied_by IS NULL);

CREATE OR REPLACE FUNCTION public.staff_reply_support(_ticket uuid, _reply text, _close boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.support_tickets;
BEGIN
  IF NOT public.caller_is_staff() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF char_length(coalesce(_reply,'')) < 2 THEN RAISE EXCEPTION 'Reply is required'; END IF;
  UPDATE public.support_tickets SET reply = _reply, replied_by = auth.uid(), replied_at = now(),
    status = CASE WHEN _close THEN 'closed' ELSE 'answered' END
  WHERE id = _ticket RETURNING * INTO t;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Ticket not found'; END IF;
  PERFORM public.push_notification(t.user_id, 'support', 'Support replied: ' || t.subject, 'رد الدعم: ' || t.subject, left(_reply, 200), left(_reply, 200), '/support');
END $$;
REVOKE EXECUTE ON FUNCTION public.staff_reply_support(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_reply_support(uuid, text, boolean) TO authenticated;