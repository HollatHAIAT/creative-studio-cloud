-- ===== Admin audit log: immutable, hash-chained =====
CREATE TABLE public.admin_audit_events (
  seq bigserial PRIMARY KEY,
  id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor uuid,
  actor_email text,
  category text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  before jsonb,
  after jsonb,
  note text NOT NULL DEFAULT '',
  revert_of uuid,
  prev_hash text NOT NULL,
  hash text NOT NULL
);
CREATE INDEX ON public.admin_audit_events (created_at DESC);
CREATE INDEX ON public.admin_audit_events (target_type, target_id);
GRANT ALL ON public.admin_audit_events TO service_role;
ALTER TABLE public.admin_audit_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.admin_audit_access (
  id bigserial PRIMARY KEY,
  user_id uuid,
  allowed boolean NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_audit_access TO service_role;
ALTER TABLE public.admin_audit_access ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_retention (
  category text PRIMARY KEY,
  days integer NOT NULL CHECK (days BETWEEN 30 AND 36500),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.audit_retention (category, days) VALUES ('role',1825),('content',365),('order',730),('security',1825),('alert',1825),('settings',1825);
GRANT ALL ON public.audit_retention TO service_role;
ALTER TABLE public.audit_retention ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reason text NOT NULL,
  category text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  released_by uuid
);
GRANT ALL ON public.audit_holds TO service_role;
ALTER TABLE public.audit_holds ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.admin_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  reason text NOT NULL,
  reason_ar text NOT NULL,
  subject_user uuid,
  event_id uuid,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','assigned','resolved')),
  assignee uuid,
  resolved_at timestamptz,
  resolution text
);
GRANT ALL ON public.admin_alerts TO service_role;
ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_integrity_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  trigger text NOT NULL,
  first_seq bigint,
  last_seq bigint,
  checked integer NOT NULL,
  ok boolean NOT NULL,
  gaps jsonb NOT NULL DEFAULT '[]',
  failures jsonb NOT NULL DEFAULT '[]'
);
GRANT ALL ON public.audit_integrity_reports TO service_role;
ALTER TABLE public.audit_integrity_reports ENABLE ROW LEVEL SECURITY;
-- No client policies on any of these: all reads/writes go through checked functions below.

-- Immutability for events, access log and integrity reports
CREATE OR REPLACE FUNCTION public.audit_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'AUDIT_IMMUTABLE'; END $$;
CREATE TRIGGER t_audit_events_lock BEFORE UPDATE OR DELETE ON public.admin_audit_events FOR EACH ROW EXECUTE FUNCTION public.audit_immutable();
CREATE TRIGGER t_audit_events_trunc BEFORE TRUNCATE ON public.admin_audit_events FOR EACH STATEMENT EXECUTE FUNCTION public.audit_immutable();
CREATE TRIGGER t_audit_access_lock BEFORE UPDATE OR DELETE ON public.admin_audit_access FOR EACH ROW EXECUTE FUNCTION public.audit_immutable();
CREATE TRIGGER t_audit_reports_lock BEFORE UPDATE OR DELETE ON public.audit_integrity_reports FOR EACH ROW EXECUTE FUNCTION public.audit_immutable();

CREATE OR REPLACE FUNCTION public.audit_hash(e public.admin_audit_events) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT encode(sha256(convert_to(concat_ws('|', e.prev_hash, e.seq::text, e.id::text,
    to_char(e.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'), coalesce(e.actor::text,''), e.category, e.action,
    e.target_type, e.target_id, coalesce(e.before::text,'null'), coalesce(e.after::text,'null'), e.note, coalesce(e.revert_of::text,'')), 'UTF8')), 'hex')
$$;

CREATE OR REPLACE FUNCTION public.audit_chain_fill() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(884422);
  NEW.created_at := now();
  SELECT coalesce((SELECT hash FROM public.admin_audit_events ORDER BY seq DESC LIMIT 1), repeat('0',64)) INTO NEW.prev_hash;
  NEW.hash := public.audit_hash(NEW);
  RETURN NEW;
END $$;
CREATE TRIGGER t_audit_chain BEFORE INSERT ON public.admin_audit_events FOR EACH ROW EXECUTE FUNCTION public.audit_chain_fill();

-- Alerts: notify admins (except the actor)
CREATE OR REPLACE FUNCTION public.notify_admins(_except uuid, _t text, _tar text, _b text, _bar text, _link text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.user_roles WHERE role = 'admin' AND user_id IS DISTINCT FROM _except LOOP
    INSERT INTO public.notifications (user_id, kind, title, title_ar, body, body_ar, link) VALUES (r.user_id, 'admin', _t, _tar, _b, _bar, _link);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.raise_admin_alert(_severity text, _reason text, _reason_ar text, _subject uuid, _event uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE aid uuid;
BEGIN
  -- one open alert per subject+reason per hour
  IF EXISTS (SELECT 1 FROM public.admin_alerts WHERE reason = _reason AND subject_user IS NOT DISTINCT FROM _subject AND status <> 'resolved' AND created_at > now() - interval '1 hour') THEN RETURN NULL; END IF;
  INSERT INTO public.admin_alerts (severity, reason, reason_ar, subject_user, event_id) VALUES (_severity, _reason, _reason_ar, _subject, _event) RETURNING id INTO aid;
  INSERT INTO public.admin_audit_events (actor, actor_email, category, action, target_type, target_id, after, note)
    VALUES (NULL, 'system', 'alert', 'alert_raised', 'alert', aid::text, jsonb_build_object('severity', _severity, 'reason', _reason, 'subject', _subject, 'event', _event), _reason);
  PERFORM public.notify_admins(NULL, 'Security alert (' || _severity || ')', 'تنبيه أمني (' || CASE _severity WHEN 'critical' THEN 'حرج' WHEN 'high' THEN 'مرتفع' WHEN 'medium' THEN 'متوسط' ELSE 'منخفض' END || ')', _reason, _reason_ar, '/admin/audit');
  RETURN aid;
END $$;

-- Core writer used by every audit trigger
CREATE OR REPLACE FUNCTION public.audit_write(_category text, _action text, _ttype text, _tid text, _before jsonb, _after jsonb, _note text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); em text; eid uuid; rv uuid; n int; sensitive boolean;
BEGIN
  IF uid IS NOT NULL THEN SELECT email INTO em FROM auth.users WHERE id = uid; END IF;
  rv := nullif(current_setting('arwiqa.revert_of', true), '')::uuid;
  INSERT INTO public.admin_audit_events (actor, actor_email, category, action, target_type, target_id, before, after, note, revert_of)
    VALUES (uid, coalesce(em, CASE WHEN uid IS NULL THEN 'system' END), _category, _action, _ttype, _tid, _before, _after, coalesce(_note,''), rv)
    RETURNING id INTO eid;
  sensitive := _category = 'role' OR _action IN ('order_cancelled','order_refunded','content_deleted') OR rv IS NOT NULL;
  IF sensitive AND uid IS NOT NULL THEN
    PERFORM public.notify_admins(uid, 'Sensitive admin action: ' || replace(_action,'_',' '), 'إجراء إداري حساس: ' || replace(_action,'_',' '),
      coalesce(em,'') || ' · ' || _ttype || ' ' || _tid, coalesce(em,'') || ' · ' || _ttype || ' ' || _tid, '/admin/audit');
    SELECT count(*) INTO n FROM public.admin_audit_events WHERE actor = uid AND created_at > now() - interval '10 minutes'
      AND (category = 'role' OR action IN ('order_cancelled','order_refunded','content_deleted') OR revert_of IS NOT NULL);
    IF n >= 5 THEN
      PERFORM public.raise_admin_alert(CASE WHEN n >= 10 THEN 'high' ELSE 'medium' END,
        'Repeated sensitive actions: ' || n || ' in 10 minutes by ' || coalesce(em, uid::text),
        'تكرار إجراءات حساسة: ' || n || ' خلال ١٠ دقائق من ' || coalesce(em, uid::text), uid, eid);
    END IF;
  END IF;
  RETURN eid;
END $$;

-- Sources: roles, content, orders
CREATE OR REPLACE FUNCTION public.audit_roles_trg() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.audit_write('role','role_granted','user', NEW.user_id::text, NULL, jsonb_build_object('role', NEW.role), '');
  ELSE
    PERFORM public.audit_write('role','role_removed','user', OLD.user_id::text, jsonb_build_object('role', OLD.role), NULL, '');
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER t_audit_roles AFTER INSERT OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.audit_roles_trg();

CREATE OR REPLACE FUNCTION public.audit_cms_trg() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b jsonb; a jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN b := jsonb_build_object('data', OLD.data, 'published', OLD.published, 'sort', OLD.sort); END IF;
  IF TG_OP <> 'DELETE' THEN a := jsonb_build_object('data', NEW.data, 'published', NEW.published, 'sort', NEW.sort); END IF;
  IF b IS NOT DISTINCT FROM a THEN RETURN NULL; END IF;
  PERFORM public.audit_write('content', CASE TG_OP WHEN 'INSERT' THEN 'content_created' WHEN 'UPDATE' THEN 'content_updated' ELSE 'content_deleted' END,
    'cms', coalesce(NEW.kind, OLD.kind) || '/' || coalesce(NEW.key, OLD.key), b, a, '');
  RETURN NULL;
END $$;
CREATE TRIGGER t_audit_cms AFTER INSERT OR UPDATE OR DELETE ON public.cms_entries FOR EACH ROW EXECUTE FUNCTION public.audit_cms_trg();

CREATE OR REPLACE FUNCTION public.audit_orders_trg() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.audit_write('order', CASE NEW.status WHEN 'cancelled' THEN 'order_cancelled' WHEN 'refunded' THEN 'order_refunded' ELSE 'order_status_changed' END,
      'order', NEW.id::text, jsonb_build_object('status', OLD.status, 'reference', OLD.reference), jsonb_build_object('status', NEW.status, 'reference', NEW.reference), '');
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER t_audit_orders AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.audit_orders_trg();

-- Access gate: logs every attempt, flags repeated denials
CREATE OR REPLACE FUNCTION public.audit_gate(_action text, _need_admin boolean DEFAULT false) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); ok boolean; n int;
BEGIN
  ok := uid IS NOT NULL AND CASE WHEN _need_admin THEN public.has_role(uid,'admin') ELSE public.is_staff(uid) END;
  INSERT INTO public.admin_audit_access (user_id, allowed, action) VALUES (uid, ok, _action);
  IF NOT ok THEN
    SELECT count(*) INTO n FROM public.admin_audit_access WHERE user_id IS NOT DISTINCT FROM uid AND NOT allowed AND created_at > now() - interval '10 minutes';
    IF n >= 3 THEN
      PERFORM public.raise_admin_alert(CASE WHEN n >= 10 THEN 'critical' ELSE 'high' END,
        'Repeated denied access to the audit log (' || n || ' in 10 minutes)', 'محاولات وصول مرفوضة متكررة إلى سجل التدقيق (' || n || ' خلال ١٠ دقائق)', uid, NULL);
    END IF;
  END IF;
  RETURN ok;
END $$;

CREATE OR REPLACE FUNCTION public.audit_is_archived(_cat text, _at timestamptz) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.audit_holds WHERE released_at IS NULL AND (category IS NULL OR category = _cat))
     AND _at < now() - make_interval(days => coalesce((SELECT days FROM public.audit_retention WHERE category = _cat), 365))
$$;

-- Search (staff only; denied calls return nothing and are logged)
CREATE OR REPLACE FUNCTION public.admin_audit_search(_from date, _to date, _actor text, _category text, _action text, _q text, _archived text, _limit int, _offset int)
RETURNS TABLE(id uuid, seq bigint, created_at timestamptz, actor_email text, category text, action text, target_type text, target_id text,
  before jsonb, after jsonb, note text, revert_of uuid, reverted_by uuid, archived boolean, total bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.audit_gate('search') THEN RETURN; END IF;
  RETURN QUERY
  WITH f AS (
    SELECT e.*, public.audit_is_archived(e.category, e.created_at) AS arch FROM public.admin_audit_events e
    WHERE (_from IS NULL OR e.created_at >= _from) AND (_to IS NULL OR e.created_at < _to + 1)
      AND (coalesce(_actor,'') = '' OR e.actor_email = _actor)
      AND (coalesce(_category,'') = '' OR e.category = _category)
      AND (coalesce(_action,'') = '' OR e.action = _action)
      AND (coalesce(_q,'') = '' OR e.target_id ILIKE '%'||_q||'%' OR e.note ILIKE '%'||_q||'%' OR coalesce(e.before::text,'') ILIKE '%'||_q||'%' OR coalesce(e.after::text,'') ILIKE '%'||_q||'%' OR coalesce(e.actor_email,'') ILIKE '%'||_q||'%')
  ), g AS (
    SELECT * FROM f WHERE coalesce(_archived,'active') = 'all' OR (_archived = 'archived') = f.arch
  )
  SELECT g.id, g.seq, g.created_at, g.actor_email, g.category, g.action, g.target_type, g.target_id, g.before, g.after, g.note, g.revert_of,
    (SELECT r.id FROM public.admin_audit_events r WHERE r.revert_of = g.id LIMIT 1), g.arch, count(*) OVER ()
  FROM g ORDER BY g.seq DESC LIMIT least(coalesce(_limit,100), 5000) OFFSET coalesce(_offset,0);
END $$;

CREATE OR REPLACE FUNCTION public.admin_audit_facets() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.audit_gate('facets') THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'actors', (SELECT coalesce(jsonb_agg(DISTINCT actor_email), '[]') FROM public.admin_audit_events WHERE actor_email IS NOT NULL),
    'actions', (SELECT coalesce(jsonb_agg(DISTINCT action), '[]') FROM public.admin_audit_events),
    'retention', (SELECT jsonb_object_agg(category, days) FROM public.audit_retention),
    'holds', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'reason', reason, 'category', category, 'created_at', created_at) ORDER BY created_at DESC), '[]') FROM public.audit_holds WHERE released_at IS NULL),
    'is_admin', public.has_role(auth.uid(), 'admin'));
END $$;

-- Undo preview + apply
CREATE OR REPLACE FUNCTION public.admin_audit_undo_preview(_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e public.admin_audit_events; cur jsonb; newer uuid; why text; k text; ky text;
BEGIN
  IF NOT public.audit_gate('undo_preview') THEN RAISE EXCEPTION 'NOT_STAFF'; END IF;
  SELECT * INTO e FROM public.admin_audit_events WHERE id = _id;
  IF e.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF e.category NOT IN ('content','order','role') THEN RETURN jsonb_build_object('can_undo', false, 'reason', 'NOT_UNDOABLE'); END IF;
  IF EXISTS (SELECT 1 FROM public.admin_audit_events WHERE revert_of = _id) THEN RETURN jsonb_build_object('can_undo', false, 'reason', 'ALREADY_UNDONE'); END IF;
  IF e.category = 'content' THEN
    k := split_part(e.target_id,'/',1); ky := substr(e.target_id, length(k)+2);
    SELECT jsonb_build_object('data', data, 'published', published, 'sort', sort) INTO cur FROM public.cms_entries WHERE kind = k AND key = ky;
  ELSIF e.category = 'order' THEN
    SELECT jsonb_build_object('status', status, 'reference', reference) INTO cur FROM public.orders WHERE id = e.target_id::uuid;
  ELSE
    SELECT CASE WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = e.target_id::uuid AND role::text = coalesce(e.after->>'role', e.before->>'role')) THEN jsonb_build_object('role', coalesce(e.after->>'role', e.before->>'role')) END INTO cur;
  END IF;
  SELECT x.id INTO newer FROM public.admin_audit_events x WHERE x.target_type = e.target_type AND x.target_id = e.target_id AND x.seq > e.seq
    AND (e.category <> 'role' OR coalesce(x.after->>'role', x.before->>'role') = coalesce(e.after->>'role', e.before->>'role')) ORDER BY x.seq LIMIT 1;
  IF newer IS NOT NULL THEN why := 'NEWER_CHANGE';
  ELSIF cur IS DISTINCT FROM e.after THEN why := 'CURRENT_DIFFERS'; END IF;
  RETURN jsonb_build_object('can_undo', why IS NULL, 'reason', why, 'newer_event', newer, 'current', cur, 'restore_to', e.before, 'changed_to', e.after,
    'needs_admin', e.category IN ('role','content'));
END $$;

CREATE OR REPLACE FUNCTION public.admin_audit_undo(_id uuid, _note text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e public.admin_audit_events; p jsonb; k text; ky text; res uuid; r text;
BEGIN
  SELECT * INTO e FROM public.admin_audit_events WHERE id = _id;
  IF e.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT public.audit_gate('undo', e.category IN ('role','content')) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  p := public.admin_audit_undo_preview(_id);
  IF NOT (p->>'can_undo')::boolean THEN
    PERFORM public.audit_write('security', 'undo_refused', e.target_type, e.target_id, NULL, p, 'Undo of ' || _id || ' refused: ' || coalesce(p->>'reason',''));
    RETURN NULL;
  END IF;
  PERFORM set_config('arwiqa.revert_of', _id::text, true);
  IF e.category = 'content' THEN
    k := split_part(e.target_id,'/',1); ky := substr(e.target_id, length(k)+2);
    IF e.before IS NULL THEN DELETE FROM public.cms_entries WHERE kind = k AND key = ky;
    ELSE
      INSERT INTO public.cms_entries (kind, key, data, published, sort, updated_by) VALUES (k, ky, e.before->'data', (e.before->>'published')::boolean, (e.before->>'sort')::int, auth.uid())
      ON CONFLICT (kind, key) DO UPDATE SET data = EXCLUDED.data, published = EXCLUDED.published, sort = EXCLUDED.sort, updated_by = auth.uid();
    END IF;
  ELSIF e.category = 'order' THEN
    PERFORM public.admin_set_order_status(e.target_id::uuid, e.before->>'status', 'Undo: ' || coalesce(_note,''));
  ELSE
    r := coalesce(e.after->>'role', e.before->>'role');
    IF e.after IS NOT NULL THEN
      IF e.target_id::uuid = auth.uid() AND r = 'admin' THEN RAISE EXCEPTION 'CANNOT_REMOVE_OWN_ADMIN'; END IF;
      DELETE FROM public.user_roles WHERE user_id = e.target_id::uuid AND role::text = r;
    ELSE
      INSERT INTO public.user_roles (user_id, role) VALUES (e.target_id::uuid, r::app_role) ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  SELECT id INTO res FROM public.admin_audit_events WHERE revert_of = _id ORDER BY seq DESC LIMIT 1;
  PERFORM set_config('arwiqa.revert_of', '', true);
  RETURN res;
END $$;

-- Integrity verification (+ stored report)
CREATE OR REPLACE FUNCTION public.audit_verify_run(_trigger text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e public.admin_audit_events; prev text := repeat('0',64); last bigint; n int := 0; gaps jsonb := '[]'; fails jsonb := '[]'; f bigint; rid uuid;
BEGIN
  FOR e IN SELECT * FROM public.admin_audit_events ORDER BY seq LOOP
    n := n + 1; IF f IS NULL THEN f := e.seq; END IF;
    IF last IS NOT NULL AND e.seq <> last + 1 THEN gaps := gaps || jsonb_build_object('after_seq', last, 'next_seq', e.seq); END IF;
    IF e.prev_hash <> prev THEN fails := fails || jsonb_build_object('seq', e.seq, 'id', e.id, 'problem', 'broken_link');
    ELSIF e.hash <> public.audit_hash(e) THEN fails := fails || jsonb_build_object('seq', e.seq, 'id', e.id, 'problem', 'content_changed'); END IF;
    prev := e.hash; last := e.seq;
  END LOOP;
  INSERT INTO public.audit_integrity_reports (trigger, first_seq, last_seq, checked, ok, gaps, failures)
    VALUES (_trigger, f, last, n, jsonb_array_length(fails) = 0, gaps, fails) RETURNING id INTO rid;
  IF jsonb_array_length(fails) > 0 THEN
    PERFORM public.raise_admin_alert('critical', 'Audit log integrity check failed (' || jsonb_array_length(fails) || ' events)', 'فشل التحقق من سلامة سجل التدقيق (' || jsonb_array_length(fails) || ' حدث)', NULL, NULL);
  END IF;
  RETURN jsonb_build_object('id', rid, 'checked', n, 'first_seq', f, 'last_seq', last, 'ok', jsonb_array_length(fails) = 0, 'gaps', gaps, 'failures', fails);
END $$;
REVOKE ALL ON FUNCTION public.audit_verify_run(text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_audit_verify() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN IF NOT public.audit_gate('verify') THEN RAISE EXCEPTION 'NOT_STAFF'; END IF; RETURN public.audit_verify_run('manual'); END $$;

CREATE OR REPLACE FUNCTION public.admin_audit_reports(_limit int) RETURNS SETOF public.audit_integrity_reports LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN IF NOT public.audit_gate('reports') THEN RETURN; END IF; RETURN QUERY SELECT * FROM public.audit_integrity_reports ORDER BY ran_at DESC LIMIT least(coalesce(_limit,20),200); END $$;

-- Activity summary
CREATE OR REPLACE FUNCTION public.audit_summary_data(_days int) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('days', _days,
    'total', count(*),
    'by_category', (SELECT coalesce(jsonb_object_agg(category, c), '{}') FROM (SELECT category, count(*) c FROM public.admin_audit_events WHERE created_at > now() - make_interval(days => _days) GROUP BY 1) s),
    'sensitive', count(*) FILTER (WHERE category = 'role' OR action IN ('order_cancelled','order_refunded','content_deleted')),
    'undone', count(*) FILTER (WHERE revert_of IS NOT NULL),
    'alerts_open', (SELECT count(*) FROM public.admin_alerts WHERE status <> 'resolved'),
    'top_actors', (SELECT coalesce(jsonb_agg(jsonb_build_object('actor', actor_email, 'count', c)), '[]') FROM (SELECT actor_email, count(*) c FROM public.admin_audit_events WHERE actor IS NOT NULL AND created_at > now() - make_interval(days => _days) GROUP BY 1 ORDER BY 2 DESC LIMIT 5) t))
  FROM public.admin_audit_events WHERE created_at > now() - make_interval(days => _days)
$$;
REVOKE ALL ON FUNCTION public.audit_summary_data(int) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_activity_summary(_days int) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN IF NOT public.audit_gate('summary') THEN RETURN NULL; END IF; RETURN public.audit_summary_data(least(greatest(coalesce(_days,7),1),365)); END $$;

CREATE OR REPLACE FUNCTION public.audit_weekly_job() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s jsonb; v jsonb;
BEGIN
  v := public.audit_verify_run('scheduled');
  s := public.audit_summary_data(7);
  PERFORM public.notify_admins(NULL, 'Weekly admin activity summary', 'ملخص النشاط الإداري الأسبوعي',
    (s->>'total') || ' actions · ' || (s->>'sensitive') || ' sensitive · ' || (s->>'undone') || ' undone · ' || (s->>'alerts_open') || ' open alerts · integrity ' || CASE WHEN (v->>'ok')::boolean THEN 'OK' ELSE 'FAILED' END,
    (s->>'total') || ' إجراء · ' || (s->>'sensitive') || ' حساس · ' || (s->>'undone') || ' تراجع · ' || (s->>'alerts_open') || ' تنبيه مفتوح · السلامة ' || CASE WHEN (v->>'ok')::boolean THEN 'سليمة' ELSE 'فشل' END,
    '/admin/audit');
END $$;
REVOKE ALL ON FUNCTION public.audit_weekly_job() FROM public, anon, authenticated;

-- Alerts workflow
CREATE OR REPLACE FUNCTION public.admin_alerts_list(_status text) RETURNS TABLE(id uuid, created_at timestamptz, severity text, reason text, reason_ar text, status text, assignee_email text, resolved_at timestamptz, resolution text, event_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.audit_gate('alerts') THEN RETURN; END IF;
  RETURN QUERY SELECT a.id, a.created_at, a.severity, a.reason, a.reason_ar, a.status, u.email::text, a.resolved_at, a.resolution, a.event_id
    FROM public.admin_alerts a LEFT JOIN auth.users u ON u.id = a.assignee
    WHERE coalesce(_status,'') = '' OR a.status = _status OR (_status = 'unresolved' AND a.status <> 'resolved')
    ORDER BY (a.status = 'resolved'), CASE a.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, a.created_at DESC LIMIT 200;
END $$;

CREATE OR REPLACE FUNCTION public.admin_staff_list() RETURNS TABLE(user_id uuid, email text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN IF NOT public.audit_gate('staff_list') THEN RETURN; END IF;
  RETURN QUERY SELECT DISTINCT r.user_id, u.email::text FROM public.user_roles r JOIN auth.users u ON u.id = r.user_id WHERE r.role IN ('admin','moderator'); END $$;

CREATE OR REPLACE FUNCTION public.admin_alert_update(_id uuid, _assignee uuid, _resolve boolean, _note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.admin_alerts; b jsonb;
BEGIN
  IF NOT public.audit_gate('alert_update') THEN RAISE EXCEPTION 'NOT_STAFF'; END IF;
  SELECT * INTO a FROM public.admin_alerts WHERE id = _id FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF a.status = 'resolved' THEN RAISE EXCEPTION 'ALREADY_RESOLVED'; END IF;
  b := jsonb_build_object('status', a.status, 'assignee', a.assignee);
  IF _resolve THEN
    IF char_length(coalesce(trim(_note),'')) < 3 THEN RAISE EXCEPTION 'NOTE_REQUIRED'; END IF;
    UPDATE public.admin_alerts SET status = 'resolved', resolved_at = now(), resolution = trim(_note), assignee = coalesce(assignee, auth.uid()) WHERE id = _id;
    PERFORM public.audit_write('alert','alert_resolved','alert', _id::text, b, jsonb_build_object('status','resolved','resolution', trim(_note)), coalesce(_note,''));
  ELSE
    IF _assignee IS NULL OR NOT public.is_staff(_assignee) THEN RAISE EXCEPTION 'ASSIGNEE_NOT_STAFF'; END IF;
    UPDATE public.admin_alerts SET status = 'assigned', assignee = _assignee WHERE id = _id;
    PERFORM public.audit_write('alert','alert_assigned','alert', _id::text, b, jsonb_build_object('status','assigned','assignee', _assignee), coalesce(_note,''));
    IF _assignee <> auth.uid() THEN
      INSERT INTO public.notifications (user_id, kind, title, title_ar, body, body_ar, link) VALUES (_assignee, 'admin', 'Alert assigned to you', 'أُسند إليك تنبيه', a.reason, a.reason_ar, '/admin/audit');
    END IF;
  END IF;
END $$;

-- Retention and holds (admins)
CREATE OR REPLACE FUNCTION public.admin_set_retention(_category text, _days int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old int;
BEGIN
  IF NOT public.audit_gate('set_retention', true) THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;
  SELECT days INTO old FROM public.audit_retention WHERE category = _category;
  IF old IS NULL THEN RAISE EXCEPTION 'BAD_CATEGORY'; END IF;
  UPDATE public.audit_retention SET days = _days, updated_by = auth.uid(), updated_at = now() WHERE category = _category;
  PERFORM public.audit_write('settings','retention_changed','retention', _category, jsonb_build_object('days', old), jsonb_build_object('days', _days), '');
END $$;

CREATE OR REPLACE FUNCTION public.admin_audit_hold(_reason text, _category text, _release uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE hid uuid;
BEGIN
  IF NOT public.audit_gate('hold', true) THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;
  IF _release IS NOT NULL THEN
    UPDATE public.audit_holds SET released_at = now(), released_by = auth.uid() WHERE id = _release AND released_at IS NULL RETURNING id INTO hid;
    IF hid IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
    PERFORM public.audit_write('settings','hold_released','hold', hid::text, jsonb_build_object('active', true), jsonb_build_object('active', false), coalesce(_reason,''));
  ELSE
    IF char_length(coalesce(trim(_reason),'')) < 3 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
    INSERT INTO public.audit_holds (reason, category, created_by) VALUES (trim(_reason), nullif(_category,''), auth.uid()) RETURNING id INTO hid;
    PERFORM public.audit_write('settings','hold_placed','hold', hid::text, NULL, jsonb_build_object('reason', trim(_reason), 'category', nullif(_category,'')), trim(_reason));
  END IF;
  RETURN hid;
END $$;

-- Lock down internal helpers
REVOKE ALL ON FUNCTION public.audit_write(text,text,text,text,jsonb,jsonb,text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.raise_admin_alert(text,text,text,uuid,uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_admins(uuid,text,text,text,text,text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_gate(text,boolean) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_is_archived(text,timestamptz) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_chain_fill() FROM public, anon, authenticated;
DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['admin_audit_search(date,date,text,text,text,text,text,integer,integer)','admin_audit_facets()','admin_audit_undo_preview(uuid)','admin_audit_undo(uuid,text)',
    'admin_audit_verify()','admin_audit_reports(integer)','admin_activity_summary(integer)','admin_alerts_list(text)','admin_staff_list()','admin_alert_update(uuid,uuid,boolean,text)',
    'admin_set_retention(text,integer)','admin_audit_hold(text,text,uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

-- Weekly summary + integrity report (Mondays 06:00 UTC)
SELECT cron.schedule('arwiqa-audit-weekly', '0 6 * * 1', $$SELECT public.audit_weekly_job()$$);