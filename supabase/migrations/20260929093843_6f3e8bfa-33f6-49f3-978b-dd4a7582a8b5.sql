CREATE OR REPLACE FUNCTION public.admin_settings_audit_search(_from date, _to date, _actor text, _field text, _limit integer, _offset integer)
RETURNS TABLE(id uuid, actor_email text, field text, old_value text, new_value text, created_at timestamptz, total bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT a.id, u.email::text, a.field, a.old_value, a.new_value, a.created_at, count(*) OVER ()
  FROM public.platform_settings_audit a LEFT JOIN auth.users u ON u.id = a.actor
  WHERE (_from IS NULL OR a.created_at >= _from::timestamptz)
    AND (_to IS NULL OR a.created_at < (_to + 1)::timestamptz)
    AND (_actor IS NULL OR (_actor = '__system' AND u.email IS NULL) OR u.email = _actor)
    AND (_field IS NULL OR a.field = _field)
  ORDER BY a.created_at DESC, a.id
  LIMIT least(greatest(coalesce(_limit, 100), 1), 5000) OFFSET greatest(coalesce(_offset, 0), 0);
END $$;

CREATE OR REPLACE FUNCTION public.admin_settings_audit_actors()
RETURNS TABLE(actor_email text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT DISTINCT coalesce(u.email::text, '') FROM public.platform_settings_audit a LEFT JOIN auth.users u ON u.id = a.actor ORDER BY 1;
END $$;

REVOKE ALL ON FUNCTION public.admin_settings_audit_search(date,date,text,text,integer,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_settings_audit_actors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_settings_audit_search(date,date,text,text,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_settings_audit_actors() TO authenticated;