REVOKE ALL ON FUNCTION public.audit_roles_trg() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_cms_trg() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_orders_trg() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_summary_data(int) FROM public, anon, authenticated;

-- ===== Incidents (built on admin_alerts) =====
ALTER TABLE public.admin_alerts DROP CONSTRAINT IF EXISTS admin_alerts_status_check;
ALTER TABLE public.admin_alerts
  ADD COLUMN kind text NOT NULL DEFAULT 'other',
  ADD COLUMN occurrences integer NOT NULL DEFAULT 1,
  ADD COLUMN last_seen_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN acknowledged_at timestamptz,
  ADD COLUMN acknowledged_by uuid,
  ADD COLUMN closed_at timestamptz,
  ADD COLUMN escalation_level integer NOT NULL DEFAULT 0,
  ADD COLUMN escalated_at timestamptz;
ALTER TABLE public.admin_alerts ADD CONSTRAINT admin_alerts_status_check CHECK (status IN ('open','acknowledged','assigned','investigating','resolved','closed'));

CREATE TABLE public.admin_alert_occurrences (
  id bigserial PRIMARY KEY, alert_id uuid NOT NULL REFERENCES public.admin_alerts(id), severity text NOT NULL,
  reason text NOT NULL, reason_ar text NOT NULL, event_id uuid, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.admin_alert_occurrences TO service_role;
ALTER TABLE public.admin_alert_occurrences ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER t_occ_lock BEFORE UPDATE OR DELETE ON public.admin_alert_occurrences FOR EACH ROW EXECUTE FUNCTION public.audit_immutable();
INSERT INTO public.admin_alert_occurrences (alert_id, severity, reason, reason_ar, event_id, created_at) SELECT id, severity, reason, reason_ar, event_id, created_at FROM public.admin_alerts;

CREATE TABLE public.incident_escalation_rules (
  severity text PRIMARY KEY CHECK (severity IN ('low','medium','high','critical')),
  after_minutes integer NOT NULL CHECK (after_minutes BETWEEN 15 AND 10080),
  notify uuid[] NOT NULL DEFAULT '{}', updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO public.incident_escalation_rules (severity, after_minutes) VALUES ('critical',60),('high',240),('medium',720),('low',2880);
GRANT ALL ON public.incident_escalation_rules TO service_role;
ALTER TABLE public.incident_escalation_rules ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.incident_checklist_templates (
  kind text PRIMARY KEY, steps jsonb NOT NULL DEFAULT '[]', updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO public.incident_checklist_templates (kind, steps) VALUES
 ('repeated_sensitive', '[{"en":"Contact the staff member and confirm the actions were intended","ar":"تواصل مع الموظف وتأكد من أن الإجراءات مقصودة"},{"en":"Review each linked event before/after values","ar":"راجع القيم السابقة واللاحقة لكل حدث مرتبط"},{"en":"Undo any unintended change","ar":"تراجع عن أي تغيير غير مقصود"}]'),
 ('denied_access', '[{"en":"Identify the account behind the attempts","ar":"حدّد الحساب الذي قام بالمحاولات"},{"en":"Decide whether to suspend the account","ar":"قرّر ما إذا كان يجب إيقاف الحساب"},{"en":"Record the finding","ar":"وثّق النتيجة"}]'),
 ('integrity', '[{"en":"Re-run the integrity check","ar":"أعد تشغيل التحقق من السلامة"},{"en":"Identify the failing events","ar":"حدّد الأحداث المخفقة"},{"en":"Escalate to the platform owner","ar":"صعّد الأمر إلى مالك المنصة"}]'),
 ('other', '[{"en":"Investigate and record the cause","ar":"تحقّق ووثّق السبب"}]');
GRANT ALL ON public.incident_checklist_templates TO service_role;
ALTER TABLE public.incident_checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.incident_checklist_progress (
  id bigserial PRIMARY KEY, alert_id uuid NOT NULL REFERENCES public.admin_alerts(id), step_index integer NOT NULL,
  step_text text NOT NULL, done_by uuid NOT NULL, note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alert_id, step_index));
GRANT ALL ON public.incident_checklist_progress TO service_role;
ALTER TABLE public.incident_checklist_progress ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER t_chk_lock BEFORE UPDATE OR DELETE ON public.incident_checklist_progress FOR EACH ROW EXECUTE FUNCTION public.audit_immutable();

CREATE OR REPLACE FUNCTION public.raise_admin_alert(_severity text, _reason text, _reason_ar text, _subject uuid, _event uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE aid uuid; k text; rank_new int; a public.admin_alerts;
BEGIN
  k := CASE WHEN _reason LIKE 'Repeated sensitive%' THEN 'repeated_sensitive' WHEN _reason LIKE 'Repeated denied%' THEN 'denied_access' WHEN _reason LIKE 'Audit log integrity%' THEN 'integrity' ELSE 'other' END;
  rank_new := CASE _severity WHEN 'critical' THEN 3 WHEN 'high' THEN 2 WHEN 'medium' THEN 1 ELSE 0 END;
  SELECT * INTO a FROM public.admin_alerts WHERE kind = k AND subject_user IS NOT DISTINCT FROM _subject AND status NOT IN ('resolved','closed') ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF a.id IS NOT NULL THEN
    UPDATE public.admin_alerts SET occurrences = occurrences + 1, last_seen_at = now(),
      severity = CASE WHEN rank_new > CASE severity WHEN 'critical' THEN 3 WHEN 'high' THEN 2 WHEN 'medium' THEN 1 ELSE 0 END THEN _severity ELSE severity END
      WHERE id = a.id;
    INSERT INTO public.admin_alert_occurrences (alert_id, severity, reason, reason_ar, event_id) VALUES (a.id, _severity, _reason, _reason_ar, _event);
    INSERT INTO public.admin_audit_events (actor, actor_email, category, action, target_type, target_id, before, after, note)
      VALUES (NULL, 'system', 'alert', 'incident_grouped', 'alert', a.id::text, jsonb_build_object('occurrences', a.occurrences, 'severity', a.severity),
        jsonb_build_object('occurrences', a.occurrences + 1, 'severity', _severity, 'event', _event), _reason);
    RETURN a.id;
  END IF;
  INSERT INTO public.admin_alerts (severity, reason, reason_ar, subject_user, event_id, kind) VALUES (_severity, _reason, _reason_ar, _subject, _event, k) RETURNING id INTO aid;
  INSERT INTO public.admin_alert_occurrences (alert_id, severity, reason, reason_ar, event_id) VALUES (aid, _severity, _reason, _reason_ar, _event);
  INSERT INTO public.admin_audit_events (actor, actor_email, category, action, target_type, target_id, after, note)
    VALUES (NULL, 'system', 'alert', 'alert_raised', 'alert', aid::text, jsonb_build_object('severity', _severity, 'kind', k, 'reason', _reason, 'subject', _subject, 'event', _event), _reason);
  PERFORM public.notify_admins(NULL, 'Security incident (' || _severity || ')', 'حادثة أمنية (' || CASE _severity WHEN 'critical' THEN 'حرجة' WHEN 'high' THEN 'مرتفعة' WHEN 'medium' THEN 'متوسطة' ELSE 'منخفضة' END || ')', _reason, _reason_ar, '/admin/audit');
  RETURN aid;
END $$;
REVOKE ALL ON FUNCTION public.raise_admin_alert(text,text,text,uuid,uuid) FROM public, anon, authenticated;

DROP FUNCTION IF EXISTS public.admin_alert_update(uuid,uuid,boolean,text);
DROP FUNCTION IF EXISTS public.admin_alerts_list(text);

CREATE OR REPLACE FUNCTION public.admin_incidents(_from date, _to date, _severity text, _status text, _assignee uuid)
RETURNS TABLE(id uuid, created_at timestamptz, severity text, kind text, reason text, reason_ar text, status text, assignee uuid, assignee_email text,
  occurrences integer, last_seen_at timestamptz, acknowledged_at timestamptz, resolved_at timestamptz, closed_at timestamptz, resolution text,
  escalation_level integer, checklist jsonb, done jsonb, history jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.audit_gate('incidents') THEN RETURN; END IF;
  RETURN QUERY SELECT a.id, a.created_at, a.severity, a.kind, a.reason, a.reason_ar, a.status, a.assignee, u.email::text, a.occurrences, a.last_seen_at,
    a.acknowledged_at, a.resolved_at, a.closed_at, a.resolution, a.escalation_level,
    coalesce((SELECT t.steps FROM public.incident_checklist_templates t WHERE t.kind = a.kind), '[]'),
    (SELECT coalesce(jsonb_agg(jsonb_build_object('step', p.step_index, 'text', p.step_text, 'at', p.created_at, 'note', p.note, 'by', pu.email) ORDER BY p.step_index), '[]')
      FROM public.incident_checklist_progress p LEFT JOIN auth.users pu ON pu.id = p.done_by WHERE p.alert_id = a.id),
    (SELECT coalesce(jsonb_agg(jsonb_build_object('at', e.created_at, 'action', e.action, 'by', e.actor_email, 'note', e.note, 'after', e.after) ORDER BY e.seq), '[]')
      FROM public.admin_audit_events e WHERE e.target_type = 'alert' AND e.target_id = a.id::text)
  FROM public.admin_alerts a LEFT JOIN auth.users u ON u.id = a.assignee
  WHERE (_from IS NULL OR a.created_at >= _from) AND (_to IS NULL OR a.created_at < _to + 1)
    AND (coalesce(_severity,'') = '' OR a.severity = _severity)
    AND (coalesce(_status,'') = '' OR a.status = _status OR (_status = 'unresolved' AND a.status NOT IN ('resolved','closed')))
    AND (_assignee IS NULL OR a.assignee = _assignee)
  ORDER BY (a.status IN ('resolved','closed')), CASE a.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, a.created_at DESC LIMIT 1000;
END $$;

CREATE OR REPLACE FUNCTION public.admin_incident_action(_id uuid, _action text, _assignee uuid, _note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.admin_alerts; ns text;
BEGIN
  IF NOT public.audit_gate('incident_' || coalesce(_action,'')) THEN RAISE EXCEPTION 'NOT_STAFF'; END IF;
  SELECT * INTO a FROM public.admin_alerts WHERE id = _id FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF a.status = 'closed' THEN RAISE EXCEPTION 'ALREADY_CLOSED'; END IF;
  IF _action = 'acknowledge' THEN
    IF a.acknowledged_at IS NOT NULL THEN RAISE EXCEPTION 'ALREADY_ACKNOWLEDGED'; END IF;
    UPDATE public.admin_alerts SET acknowledged_at = now(), acknowledged_by = auth.uid(), status = CASE WHEN status = 'open' THEN 'acknowledged' ELSE status END WHERE id = _id;
    ns := 'acknowledged';
  ELSIF _action = 'assign' THEN
    IF _assignee IS NULL OR NOT public.is_staff(_assignee) THEN RAISE EXCEPTION 'ASSIGNEE_NOT_STAFF'; END IF;
    UPDATE public.admin_alerts SET assignee = _assignee, status = 'assigned', acknowledged_at = coalesce(acknowledged_at, now()), acknowledged_by = coalesce(acknowledged_by, auth.uid()) WHERE id = _id;
    IF _assignee <> auth.uid() THEN
      INSERT INTO public.notifications (user_id, kind, title, title_ar, body, body_ar, link) VALUES (_assignee, 'admin', 'Incident assigned to you', 'أُسندت إليك حادثة', a.reason, a.reason_ar, '/admin/incidents');
    END IF;
    ns := 'assigned';
  ELSIF _action = 'investigate' THEN
    UPDATE public.admin_alerts SET status = 'investigating', assignee = coalesce(assignee, auth.uid()), acknowledged_at = coalesce(acknowledged_at, now()) WHERE id = _id;
    ns := 'investigating';
  ELSIF _action = 'resolve' THEN
    IF char_length(coalesce(trim(_note),'')) < 3 THEN RAISE EXCEPTION 'NOTE_REQUIRED'; END IF;
    UPDATE public.admin_alerts SET status = 'resolved', resolved_at = now(), resolution = trim(_note), acknowledged_at = coalesce(acknowledged_at, now()), assignee = coalesce(assignee, auth.uid()) WHERE id = _id;
    ns := 'resolved';
  ELSIF _action = 'close' THEN
    IF a.status <> 'resolved' THEN RAISE EXCEPTION 'RESOLVE_FIRST'; END IF;
    UPDATE public.admin_alerts SET status = 'closed', closed_at = now() WHERE id = _id;
    ns := 'closed';
  ELSE RAISE EXCEPTION 'BAD_ACTION'; END IF;
  PERFORM public.audit_write('alert', 'incident_' || ns, 'alert', _id::text, jsonb_build_object('status', a.status, 'assignee', a.assignee),
    jsonb_build_object('status', ns, 'assignee', coalesce(_assignee, a.assignee)), coalesce(_note,''));
END $$;

CREATE OR REPLACE FUNCTION public.admin_incident_check_step(_id uuid, _step integer, _note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.admin_alerts; s jsonb;
BEGIN
  IF NOT public.audit_gate('incident_checklist') THEN RAISE EXCEPTION 'NOT_STAFF'; END IF;
  SELECT * INTO a FROM public.admin_alerts WHERE id = _id;
  IF a.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  SELECT steps -> _step INTO s FROM public.incident_checklist_templates WHERE kind = a.kind;
  IF s IS NULL THEN RAISE EXCEPTION 'BAD_STEP'; END IF;
  INSERT INTO public.incident_checklist_progress (alert_id, step_index, step_text, done_by, note) VALUES (_id, _step, s->>'en', auth.uid(), coalesce(_note,''));
  PERFORM public.audit_write('alert', 'checklist_step_done', 'alert', _id::text, NULL, jsonb_build_object('step', _step, 'text', s->>'en'), coalesce(_note,''));
END $$;

CREATE OR REPLACE FUNCTION public.admin_incident_config() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.audit_gate('incident_config') THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'rules', (SELECT jsonb_agg(jsonb_build_object('severity', severity, 'after_minutes', after_minutes, 'notify', notify) ORDER BY after_minutes) FROM public.incident_escalation_rules),
    'checklists', (SELECT jsonb_object_agg(kind, steps) FROM public.incident_checklist_templates),
    'export', (SELECT to_jsonb(s) FROM public.export_settings s WHERE id = 1));
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_escalation_rule(_severity text, _minutes integer, _notify uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.incident_escalation_rules;
BEGIN
  IF NOT public.audit_gate('set_escalation', true) THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;
  SELECT * INTO o FROM public.incident_escalation_rules WHERE severity = _severity;
  IF o.severity IS NULL THEN RAISE EXCEPTION 'BAD_SEVERITY'; END IF;
  UPDATE public.incident_escalation_rules SET after_minutes = _minutes, notify = coalesce(_notify,'{}'), updated_by = auth.uid(), updated_at = now() WHERE severity = _severity;
  PERFORM public.audit_write('settings','escalation_rule_changed','escalation', _severity, jsonb_build_object('after_minutes', o.after_minutes, 'notify', o.notify), jsonb_build_object('after_minutes', _minutes, 'notify', _notify), '');
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_checklist(_kind text, _steps jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o jsonb;
BEGIN
  IF NOT public.audit_gate('set_checklist', true) THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;
  IF jsonb_typeof(_steps) <> 'array' OR jsonb_array_length(_steps) > 20 THEN RAISE EXCEPTION 'BAD_STEPS'; END IF;
  SELECT steps INTO o FROM public.incident_checklist_templates WHERE kind = _kind;
  IF o IS NULL THEN RAISE EXCEPTION 'BAD_KIND'; END IF;
  UPDATE public.incident_checklist_templates SET steps = _steps, updated_by = auth.uid(), updated_at = now() WHERE kind = _kind;
  PERFORM public.audit_write('settings','checklist_changed','checklist', _kind, o, _steps, '');
END $$;

-- ===== Secure exports =====
CREATE TABLE public.export_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1), expiry_hours integer NOT NULL DEFAULT 72 CHECK (expiry_hours BETWEEN 1 AND 720),
  alert_lead_hours integer NOT NULL DEFAULT 24 CHECK (alert_lead_hours BETWEEN 1 AND 168), recipients uuid[] NOT NULL DEFAULT '{}',
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO public.export_settings (id) VALUES (1);
GRANT ALL ON public.export_settings TO service_role;
ALTER TABLE public.export_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), created_by uuid NOT NULL, created_by_email text,
  kind text NOT NULL CHECK (kind IN ('incidents','audit','chart')), format text NOT NULL CHECK (format IN ('csv','pdf')),
  filters jsonb NOT NULL DEFAULT '{}', row_count integer NOT NULL, watermark text NOT NULL, content text NOT NULL,
  expires_at timestamptz NOT NULL, expiry_alerted_at timestamptz);
GRANT ALL ON public.audit_exports TO service_role;
ALTER TABLE public.audit_exports ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_export_downloads (
  id bigserial PRIMARY KEY, export_id uuid NOT NULL REFERENCES public.audit_exports(id), user_id uuid, user_email text,
  allowed boolean NOT NULL, reason text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.audit_export_downloads TO service_role;
ALTER TABLE public.audit_export_downloads ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER t_dl_lock BEFORE UPDATE OR DELETE ON public.audit_export_downloads FOR EACH ROW EXECUTE FUNCTION public.audit_immutable();

CREATE TABLE public.export_alert_deliveries (
  id bigserial PRIMARY KEY, export_id uuid NOT NULL REFERENCES public.audit_exports(id), recipient uuid NOT NULL, channel text NOT NULL CHECK (channel IN ('in_app','email')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','gave_up')), attempts integer NOT NULL DEFAULT 0,
  last_error text, last_attempt_at timestamptz, sent_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (export_id, recipient, channel));
GRANT ALL ON public.export_alert_deliveries TO service_role;
ALTER TABLE public.export_alert_deliveries ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.admin_export_create(_kind text, _format text, _filters jsonb, _content text, _rows integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); em text; xid uuid := gen_random_uuid(); exp timestamptz; wm text; body text;
BEGIN
  IF NOT public.audit_gate('export_' || coalesce(_kind,'')) THEN RAISE EXCEPTION 'NOT_STAFF'; END IF;
  IF length(coalesce(_content,'')) > 5000000 THEN RAISE EXCEPTION 'TOO_LARGE'; END IF;
  SELECT email INTO em FROM auth.users WHERE id = uid;
  exp := now() + make_interval(hours => (SELECT expiry_hours FROM public.export_settings WHERE id = 1));
  wm := 'ARWIQA CONFIDENTIAL · Export ' || xid || ' · ' || coalesce(em, uid::text) || ' · ' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC · expires ' || to_char(exp AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC';
  IF _format = 'csv' THEN
    body := '# ' || wm || E'\n' || _content || E'\n# ' || wm || E'\n';
  ELSE
    body := replace(_content, '<body>', '<body><div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:9999;opacity:.10;font:700 28px sans-serif;transform:rotate(-30deg);text-align:center">' || wm || '</div><p style="font:11px monospace;color:#666">' || wm || '</p>');
  END IF;
  INSERT INTO public.audit_exports (id, created_by, created_by_email, kind, format, filters, row_count, watermark, content, expires_at)
    VALUES (xid, uid, em, _kind, _format, coalesce(_filters,'{}'), coalesce(_rows,0), wm, body, exp);
  PERFORM public.audit_write('security', 'export_created', 'export', xid::text, NULL,
    jsonb_build_object('kind', _kind, 'format', _format, 'filters', _filters, 'rows', _rows, 'expires_at', exp), '');
  RETURN xid;
END $$;

CREATE OR REPLACE FUNCTION public.admin_export_download(_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE x public.audit_exports; ok boolean; uid uuid := auth.uid(); em text;
BEGIN
  ok := public.audit_gate('export_download');
  SELECT email INTO em FROM auth.users WHERE id = uid;
  SELECT * INTO x FROM public.audit_exports WHERE id = _id;
  IF x.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT ok THEN
    INSERT INTO public.audit_export_downloads (export_id, user_id, user_email, allowed, reason) VALUES (_id, uid, em, false, 'not_staff');
    PERFORM public.audit_write('security','export_download_blocked','export', _id::text, NULL, jsonb_build_object('reason','not_staff'), '');
    RETURN jsonb_build_object('ok', false, 'reason', 'NOT_STAFF');
  END IF;
  IF x.expires_at <= now() THEN
    INSERT INTO public.audit_export_downloads (export_id, user_id, user_email, allowed, reason) VALUES (_id, uid, em, false, 'expired');
    PERFORM public.audit_write('security','export_download_blocked','export', _id::text, NULL, jsonb_build_object('reason','expired'), '');
    RETURN jsonb_build_object('ok', false, 'reason', 'EXPIRED');
  END IF;
  INSERT INTO public.audit_export_downloads (export_id, user_id, user_email, allowed) VALUES (_id, uid, em, true);
  PERFORM public.audit_write('security','export_downloaded','export', _id::text, NULL, jsonb_build_object('format', x.format, 'rows', x.row_count), '');
  RETURN jsonb_build_object('ok', true, 'format', x.format, 'kind', x.kind, 'content', x.content, 'created_at', x.created_at);
END $$;

CREATE OR REPLACE FUNCTION public.admin_exports_list() RETURNS TABLE(id uuid, created_at timestamptz, created_by_email text, kind text, format text, filters jsonb,
  row_count integer, expires_at timestamptz, expired boolean, downloads jsonb, alerts jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.audit_gate('exports_list') THEN RETURN; END IF;
  RETURN QUERY SELECT x.id, x.created_at, x.created_by_email, x.kind, x.format, x.filters, x.row_count, x.expires_at, x.expires_at <= now(),
    (SELECT coalesce(jsonb_agg(jsonb_build_object('at', d.created_at, 'by', d.user_email, 'allowed', d.allowed, 'reason', d.reason) ORDER BY d.id DESC), '[]') FROM public.audit_export_downloads d WHERE d.export_id = x.id),
    (SELECT coalesce(jsonb_agg(jsonb_build_object('to', u.email, 'channel', a.channel, 'status', a.status, 'attempts', a.attempts, 'error', a.last_error, 'sent_at', a.sent_at) ORDER BY a.id), '[]')
      FROM public.export_alert_deliveries a LEFT JOIN auth.users u ON u.id = a.recipient WHERE a.export_id = x.id)
  FROM public.audit_exports x ORDER BY x.created_at DESC LIMIT 300;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_export_settings(_expiry integer, _lead integer, _recipients uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.export_settings; r uuid;
BEGIN
  IF NOT public.audit_gate('set_export_settings', true) THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;
  FOREACH r IN ARRAY coalesce(_recipients,'{}') LOOP IF NOT public.is_staff(r) THEN RAISE EXCEPTION 'RECIPIENT_NOT_STAFF'; END IF; END LOOP;
  SELECT * INTO o FROM public.export_settings WHERE id = 1;
  UPDATE public.export_settings SET expiry_hours = _expiry, alert_lead_hours = _lead, recipients = coalesce(_recipients,'{}'), updated_by = auth.uid(), updated_at = now() WHERE id = 1;
  PERFORM public.audit_write('settings','export_settings_changed','export_settings','1',
    jsonb_build_object('expiry_hours', o.expiry_hours, 'alert_lead_hours', o.alert_lead_hours, 'recipients', o.recipients),
    jsonb_build_object('expiry_hours', _expiry, 'alert_lead_hours', _lead, 'recipients', _recipients), '');
END $$;

-- Hourly: escalate unhandled incidents, queue + retry export-expiry alerts
CREATE OR REPLACE FUNCTION public.audit_hourly_job() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; s public.export_settings; x record; d record; r uuid; em text; tgt uuid[];
BEGIN
  FOR a IN SELECT al.*, ru.after_minutes, ru.notify FROM public.admin_alerts al JOIN public.incident_escalation_rules ru ON ru.severity = al.severity
    WHERE al.status IN ('open','acknowledged','assigned') AND al.created_at + make_interval(mins => ru.after_minutes * (al.escalation_level + 1)) < now() AND al.escalation_level < 3 LOOP
    UPDATE public.admin_alerts SET escalation_level = escalation_level + 1, escalated_at = now() WHERE id = a.id;
    tgt := CASE WHEN cardinality(a.notify) > 0 THEN a.notify ELSE ARRAY(SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin','moderator')) END;
    FOREACH r IN ARRAY tgt LOOP
      INSERT INTO public.notifications (user_id, kind, title, title_ar, body, body_ar, link)
        VALUES (r, 'admin', 'Escalated incident (level ' || (a.escalation_level + 1) || ')', 'تصعيد حادثة (المستوى ' || (a.escalation_level + 1) || ')', a.reason, a.reason_ar, '/admin/incidents');
    END LOOP;
    INSERT INTO public.admin_audit_events (actor, actor_email, category, action, target_type, target_id, before, after, note)
      VALUES (NULL, 'system', 'alert', 'incident_escalated', 'alert', a.id::text, jsonb_build_object('level', a.escalation_level),
        jsonb_build_object('level', a.escalation_level + 1, 'notified', to_jsonb(tgt)), 'Not handled within ' || a.after_minutes || ' minutes');
  END LOOP;

  SELECT * INTO s FROM public.export_settings WHERE id = 1;
  FOR x IN SELECT * FROM public.audit_exports WHERE expiry_alerted_at IS NULL AND expires_at > now() AND expires_at <= now() + make_interval(hours => s.alert_lead_hours) LOOP
    tgt := CASE WHEN cardinality(s.recipients) > 0 THEN s.recipients ELSE ARRAY[x.created_by] END;
    FOREACH r IN ARRAY tgt LOOP
      INSERT INTO public.export_alert_deliveries (export_id, recipient, channel) VALUES (x.id, r, 'in_app'), (x.id, r, 'email') ON CONFLICT DO NOTHING;
    END LOOP;
    UPDATE public.audit_exports SET expiry_alerted_at = now() WHERE id = x.id;
  END LOOP;

  FOR d IN SELECT dl.*, ex.kind, ex.format, ex.expires_at FROM public.export_alert_deliveries dl JOIN public.audit_exports ex ON ex.id = dl.export_id
    WHERE dl.status IN ('pending','failed') LOOP
    BEGIN
      IF d.channel = 'in_app' THEN
        INSERT INTO public.notifications (user_id, kind, title, title_ar, body, body_ar, link) VALUES (d.recipient, 'admin', 'Export expires soon', 'ملف مصدَّر تنتهي صلاحيته قريبًا',
          upper(d.format) || ' ' || d.kind || ' export expires ' || to_char(d.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC',
          'ملف ' || upper(d.format) || ' تنتهي صلاحيته ' || to_char(d.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC', '/admin/exports');
      ELSE
        SELECT email INTO em FROM auth.users WHERE id = d.recipient;
        IF em IS NULL THEN RAISE EXCEPTION 'NO_EMAIL'; END IF;
        INSERT INTO public.email_outbox (user_id, to_email, kind, subject, subject_ar, body, body_ar, link) VALUES (d.recipient, em, 'admin', 'Export expires soon', 'ملف مصدَّر تنتهي صلاحيته قريبًا',
          'An Arwiqa export you can access expires at ' || to_char(d.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC.', 'تنتهي صلاحية ملف مصدَّر في أروقة في ' || to_char(d.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC.', '/admin/exports');
      END IF;
      UPDATE public.export_alert_deliveries SET status = 'sent', attempts = attempts + 1, sent_at = now(), last_attempt_at = now(), last_error = NULL WHERE id = d.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.export_alert_deliveries SET status = CASE WHEN attempts + 1 >= 5 THEN 'gave_up' ELSE 'failed' END, attempts = attempts + 1, last_attempt_at = now(), last_error = left(SQLERRM, 300) WHERE id = d.id;
    END;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.audit_hourly_job() FROM public, anon, authenticated;
DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['admin_incidents(date,date,text,text,uuid)','admin_incident_action(uuid,text,uuid,text)','admin_incident_check_step(uuid,integer,text)',
    'admin_incident_config()','admin_set_escalation_rule(text,integer,uuid[])','admin_set_checklist(text,jsonb)','admin_export_create(text,text,jsonb,text,integer)',
    'admin_export_download(uuid)','admin_exports_list()','admin_set_export_settings(integer,integer,uuid[])'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

SELECT cron.schedule('arwiqa-audit-hourly', '0 * * * *', $$SELECT public.audit_hourly_job()$$);