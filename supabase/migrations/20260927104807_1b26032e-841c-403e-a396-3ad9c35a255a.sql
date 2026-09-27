-- Per-search email frequency
ALTER TABLE public.saved_searches ADD COLUMN email_frequency text NOT NULL DEFAULT 'off'
  CHECK (email_frequency IN ('off','instant','daily','weekly'));

-- Global switch + unsubscribe token
ALTER TABLE public.notification_prefs
  ADD COLUMN email_saved_searches boolean NOT NULL DEFAULT true,
  ADD COLUMN unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN unsubscribed_at timestamptz;
CREATE UNIQUE INDEX notification_prefs_unsub_token ON public.notification_prefs(unsubscribe_token);

-- Matches waiting for a daily/weekly digest
CREATE TABLE public.saved_search_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  saved_search_id uuid NOT NULL REFERENCES public.saved_searches(id) ON DELETE CASCADE,
  listing_id text NOT NULL,
  title text NOT NULL, title_ar text NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('daily','weekly')),
  emailed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (saved_search_id, listing_id)
);
GRANT SELECT ON public.saved_search_matches TO authenticated;
GRANT ALL ON public.saved_search_matches TO service_role;
ALTER TABLE public.saved_search_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own digest matches" ON public.saved_search_matches FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.saved_search_token(_uid uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t uuid;
BEGIN
  INSERT INTO notification_prefs(user_id) VALUES (_uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT unsubscribe_token INTO t FROM notification_prefs WHERE user_id = _uid;
  RETURN t;
END $$;
REVOKE EXECUTE ON FUNCTION public.saved_search_token(uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_saved_searches()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE s record; emails_on boolean;
BEGIN
  IF NEW.status <> 'published' OR (TG_OP = 'UPDATE' AND OLD.status = 'published') THEN RETURN NEW; END IF;
  FOR s IN
    SELECT * FROM saved_searches ss
    WHERE ss.active
      AND ss.user_id IS DISTINCT FROM NEW.owner_user_id
      AND (cardinality(ss.categories) = 0 OR NEW.category = ANY(ss.categories))
      AND (ss.min_price IS NULL OR NEW.price >= ss.min_price)
      AND (ss.max_price IS NULL OR NEW.price <= ss.max_price)
      AND (ss.keywords = '' OR NOT EXISTS (
        SELECT 1 FROM unnest(regexp_split_to_array(lower(ss.keywords), '\s+')) w
        WHERE w <> '' AND position(w IN lower(NEW.title || ' ' || NEW.title_ar || ' ' || NEW.category)) = 0))
  LOOP
    INSERT INTO notifications (user_id, kind, title, title_ar, body, body_ar, link) VALUES (s.user_id, 'saved_search',
      'New match for your saved search', 'عمل جديد يطابق بحثك المحفوظ',
      NEW.title || coalesce(' — "' || nullif(s.name,'') || '"', ''),
      NEW.title_ar || coalesce(' — «' || nullif(s.name,'') || '»', ''),
      '/artwork/' || NEW.id);
    IF s.email_frequency = 'off' THEN CONTINUE; END IF;
    SELECT coalesce((SELECT email_saved_searches FROM notification_prefs WHERE user_id = s.user_id), true) INTO emails_on;
    IF NOT emails_on THEN CONTINUE; END IF;
    IF s.email_frequency = 'instant' THEN
      INSERT INTO email_outbox (user_id, kind, subject, subject_ar, body, body_ar, link) VALUES (s.user_id, 'saved_search',
        'New match: ' || NEW.title, 'عمل جديد مطابق: ' || NEW.title_ar,
        NEW.title || ' matches your saved search "' || coalesce(nullif(s.name,''), s.keywords, '') || '". Unsubscribe: /unsubscribe?token=' || saved_search_token(s.user_id),
        NEW.title_ar || ' يطابق بحثك المحفوظ. لإلغاء الاشتراك: /unsubscribe?token=' || saved_search_token(s.user_id),
        '/artwork/' || NEW.id);
    ELSE
      INSERT INTO saved_search_matches (user_id, saved_search_id, listing_id, title, title_ar, frequency)
      VALUES (s.user_id, s.id, NEW.id, NEW.title, NEW.title_ar, s.email_frequency) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  RETURN NEW;
END $function$;

-- Builds one digest email per user from waiting matches.
CREATE OR REPLACE FUNCTION public.send_saved_search_digests(_frequency text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u record; n integer := 0;
BEGIN
  IF _frequency NOT IN ('daily','weekly') THEN RAISE EXCEPTION 'BAD_FREQUENCY'; END IF;
  FOR u IN
    SELECT m.user_id, count(*) c, string_agg('• ' || m.title, E'\n' ORDER BY m.created_at) en, string_agg('• ' || m.title_ar, E'\n' ORDER BY m.created_at) ar
    FROM saved_search_matches m
    WHERE m.frequency = _frequency AND m.emailed_at IS NULL
      AND coalesce((SELECT email_saved_searches FROM notification_prefs p WHERE p.user_id = m.user_id), true)
    GROUP BY m.user_id
  LOOP
    INSERT INTO email_outbox (user_id, kind, subject, subject_ar, body, body_ar, link) VALUES (u.user_id, 'saved_search_digest',
      u.c || ' new artworks match your saved searches', u.c || ' أعمال جديدة تطابق عمليات بحثك المحفوظة',
      u.en || E'\n\nUnsubscribe: /unsubscribe?token=' || saved_search_token(u.user_id),
      u.ar || E'\n\nلإلغاء الاشتراك: /unsubscribe?token=' || saved_search_token(u.user_id),
      '/saved-searches');
    n := n + 1;
  END LOOP;
  UPDATE saved_search_matches SET emailed_at = now() WHERE frequency = _frequency AND emailed_at IS NULL;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.send_saved_search_digests(text) FROM public, anon, authenticated;

-- One-click unsubscribe from saved-search emails (works signed out, via the emailed token).
CREATE OR REPLACE FUNCTION public.unsubscribe_saved_search_emails(_token uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid;
BEGIN
  UPDATE notification_prefs SET email_saved_searches = false, unsubscribed_at = now(), updated_at = now()
  WHERE unsubscribe_token = _token RETURNING user_id INTO uid;
  RETURN uid IS NOT NULL;
END $$;
GRANT EXECUTE ON FUNCTION public.unsubscribe_saved_search_emails(uuid) TO anon, authenticated;

-- Schedules: daily 07:00 Riyadh (04:00 UTC); weekly Sunday.
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('saved-search-daily-digest', '0 4 * * *', $$SELECT public.send_saved_search_digests('daily')$$);
SELECT cron.schedule('saved-search-weekly-digest', '0 4 * * 0', $$SELECT public.send_saved_search_digests('weekly')$$);