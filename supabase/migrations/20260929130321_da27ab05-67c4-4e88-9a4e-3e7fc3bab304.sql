CREATE OR REPLACE FUNCTION public.admin_set_role(_uid uuid, _role app_role, _grant boolean, _reason text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only admins can change roles'; END IF;
  IF _uid = auth.uid() AND _role = 'admin' AND NOT _grant THEN RAISE EXCEPTION 'You cannot remove your own admin role'; END IF;
  IF _grant THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (_uid, _role) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _uid AND role = _role;
  END IF;
  INSERT INTO public.moderation_audit(actor, action, target_type, target_id, reason, details)
  VALUES (auth.uid(), CASE WHEN _grant THEN 'grant_role' ELSE 'revoke_role' END, 'user', _uid::text, coalesce(_reason, ''), jsonb_build_object('role', _role));
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_set_role(uuid, app_role, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, app_role, boolean, text) TO authenticated;