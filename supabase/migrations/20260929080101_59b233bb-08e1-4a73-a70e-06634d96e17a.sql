ALTER TABLE public.support_tickets ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.support_tickets ADD COLUMN reference text,
  ADD COLUMN contact_name text,
  ADD COLUMN contact_email text,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.support_tickets SET reference = 'SUP-' || upper(substr(replace(id::text,'-',''),1,8)) WHERE reference IS NULL;
ALTER TABLE public.support_tickets ALTER COLUMN reference SET DEFAULT ('SUP-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)));
ALTER TABLE public.support_tickets ALTER COLUMN reference SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS support_tickets_reference_key ON public.support_tickets(reference);

CREATE OR REPLACE FUNCTION public.touch_support_ticket() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS support_ticket_touch ON public.support_tickets;
CREATE TRIGGER support_ticket_touch BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.touch_support_ticket();

-- Anyone (signed in or not) submits through this; returns the tracking reference.
CREATE OR REPLACE FUNCTION public.submit_support_request(_topic text, _subject text, _message text, _order_ref text, _name text, _email text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); em text := lower(trim(coalesce(_email,''))); ref text;
BEGIN
  IF _topic NOT IN ('order','payment','shipping','licensing','selling','auction','exhibition','account','other') THEN RAISE EXCEPTION 'BAD_TOPIC'; END IF;
  IF length(trim(coalesce(_subject,''))) < 3 OR length(_subject) > 150 THEN RAISE EXCEPTION 'BAD_SUBJECT'; END IF;
  IF length(trim(coalesce(_message,''))) < 10 OR length(_message) > 3000 THEN RAISE EXCEPTION 'BAD_MESSAGE'; END IF;
  IF uid IS NULL THEN
    IF em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(em) > 200 THEN RAISE EXCEPTION 'BAD_EMAIL'; END IF;
    IF length(trim(coalesce(_name,''))) < 2 OR length(_name) > 100 THEN RAISE EXCEPTION 'BAD_NAME'; END IF;
    IF (SELECT count(*) FROM public.support_tickets WHERE contact_email = em AND created_at > now() - interval '1 day') >= 5 THEN RAISE EXCEPTION 'TOO_MANY'; END IF;
  ELSE
    IF (SELECT count(*) FROM public.support_tickets WHERE user_id = uid AND created_at > now() - interval '1 day') >= 10 THEN RAISE EXCEPTION 'TOO_MANY'; END IF;
    IF em = '' THEN SELECT lower(email) INTO em FROM auth.users WHERE id = uid; END IF;
  END IF;
  INSERT INTO public.support_tickets(user_id, topic, subject, message, order_ref, status, contact_name, contact_email)
  VALUES (uid, _topic, trim(_subject), trim(_message), nullif(trim(coalesce(_order_ref,'')),''), 'open', nullif(trim(coalesce(_name,'')),''), nullif(em,''))
  RETURNING reference INTO ref;
  RETURN ref;
END $$;
GRANT EXECUTE ON FUNCTION public.submit_support_request(text,text,text,text,text,text) TO anon, authenticated;

-- Tracking needs both the reference and the email used; never reveals anything else.
CREATE OR REPLACE FUNCTION public.track_support_request(_reference text, _email text)
RETURNS TABLE(reference text, topic text, subject text, status text, reply text, replied_at timestamptz, created_at timestamptz, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.reference, t.topic, t.subject, t.status, t.reply, t.replied_at, t.created_at, t.updated_at
  FROM public.support_tickets t
  WHERE t.reference = upper(trim(_reference)) AND t.contact_email IS NOT NULL AND t.contact_email = lower(trim(_email))
$$;
GRANT EXECUTE ON FUNCTION public.track_support_request(text,text) TO anon, authenticated;