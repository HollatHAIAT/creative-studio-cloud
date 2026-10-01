CREATE TABLE public.export_alert_attempts (
  id bigserial PRIMARY KEY, delivery_id bigint NOT NULL REFERENCES public.export_alert_deliveries(id),
  attempted_at timestamptz NOT NULL DEFAULT now(), ok boolean NOT NULL, error text, manual boolean NOT NULL DEFAULT false, by_user uuid);
GRANT ALL ON public.export_alert_attempts TO service_role;
ALTER TABLE public.export_alert_attempts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER t_att_lock BEFORE UPDATE OR DELETE ON public.export_alert_attempts FOR EACH ROW EXECUTE FUNCTION public.audit_immutable();

CREATE OR REPLACE FUNCTION public.export_alert_try(_delivery bigint, _manual boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d record; em text; ok boolean := true; err text;
BEGIN
  SELECT dl.*, ex.kind, ex.format, ex.expires_at INTO d FROM public.export_alert_deliveries dl JOIN public.audit_exports ex ON ex.id = dl.export_id WHERE dl.id = _delivery FOR UPDATE OF dl;
  IF d.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
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
  EXCEPTION WHEN OTHERS THEN ok := false; err := left(SQLERRM, 300);
  END;
  INSERT INTO public.export_alert_attempts (delivery_id, ok, error, manual, by_user) VALUES (_delivery, ok, err, _manual, CASE WHEN _manual THEN auth.uid() END);
  UPDATE public.export_alert_deliveries SET attempts = attempts + 1, last_attempt_at = now(), last_error = err,
    status = CASE WHEN ok THEN 'sent' WHEN attempts + 1 >= 5 AND NOT _manual THEN 'gave_up' ELSE 'failed' END, sent_at = CASE WHEN ok THEN now() ELSE sent_at END WHERE id = _delivery;
  RETURN ok;
END $$;
REVOKE ALL ON FUNCTION public.export_alert_try(bigint, boolean) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.audit_hourly_job() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; s public.export_settings; x record; d record; r uuid; tgt uuid[];
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
  FOR d IN SELECT id FROM public.export_alert_deliveries WHERE status IN ('pending','failed') LOOP
    PERFORM public.export_alert_try(d.id, false);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.audit_hourly_job() FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_alert_deliveries(_status text, _recipient uuid, _from date, _to date)
RETURNS TABLE(id bigint, export_id uuid, export_kind text, export_format text, expires_at timestamptz, recipient uuid, recipient_email text, channel text,
  status text, attempts integer, last_error text, sent_at timestamptz, created_at timestamptz, history jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.audit_gate('alert_deliveries') THEN RETURN; END IF;
  RETURN QUERY SELECT d.id, d.export_id, x.kind, x.format, x.expires_at, d.recipient, u.email::text, d.channel, d.status, d.attempts, d.last_error, d.sent_at, d.created_at,
    (SELECT coalesce(jsonb_agg(jsonb_build_object('at', t.attempted_at, 'ok', t.ok, 'error', t.error, 'manual', t.manual, 'by', bu.email) ORDER BY t.id DESC), '[]')
      FROM public.export_alert_attempts t LEFT JOIN auth.users bu ON bu.id = t.by_user WHERE t.delivery_id = d.id)
  FROM public.export_alert_deliveries d JOIN public.audit_exports x ON x.id = d.export_id LEFT JOIN auth.users u ON u.id = d.recipient
  WHERE (coalesce(_status,'') = '' OR d.status = _status) AND (_recipient IS NULL OR d.recipient = _recipient)
    AND (_from IS NULL OR d.created_at >= _from) AND (_to IS NULL OR d.created_at < _to + 1)
  ORDER BY d.created_at DESC LIMIT 500;
END $$;

CREATE OR REPLACE FUNCTION public.admin_resend_alert_delivery(_id bigint) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ok boolean;
BEGIN
  IF NOT public.audit_gate('alert_resend') THEN RAISE EXCEPTION 'NOT_STAFF'; END IF;
  ok := public.export_alert_try(_id, true);
  PERFORM public.audit_write('security', 'expiry_alert_resent', 'alert_delivery', _id::text, NULL, jsonb_build_object('ok', ok,
    'error', (SELECT last_error FROM public.export_alert_deliveries WHERE id = _id)), '');
  RETURN ok;
END $$;

REVOKE ALL ON FUNCTION public.admin_alert_deliveries(text,uuid,date,date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_alert_deliveries(text,uuid,date,date) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_resend_alert_delivery(bigint) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_resend_alert_delivery(bigint) TO authenticated;