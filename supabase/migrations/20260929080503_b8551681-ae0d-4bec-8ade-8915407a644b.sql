CREATE TABLE public.platform_settings_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor uuid,
  field text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_settings_audit TO authenticated;
GRANT ALL ON public.platform_settings_audit TO service_role;
ALTER TABLE public.platform_settings_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read settings audit" ON public.platform_settings_audit FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.log_platform_settings_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text; o jsonb := to_jsonb(OLD); n jsonb := to_jsonb(NEW);
BEGIN
  FOR k IN SELECT jsonb_object_keys(n) LOOP
    CONTINUE WHEN k IN ('updated_at','updated_by','id');
    IF o->k IS DISTINCT FROM n->k THEN
      INSERT INTO public.platform_settings_audit(actor, field, old_value, new_value) VALUES (auth.uid(), k, o->>k, n->>k);
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.log_platform_settings_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER platform_settings_audit_trg AFTER UPDATE ON public.platform_settings FOR EACH ROW EXECUTE FUNCTION public.log_platform_settings_change();

-- Admin-only view of the log with the changer's email.
CREATE OR REPLACE FUNCTION public.admin_settings_audit(_limit integer DEFAULT 100)
RETURNS TABLE(id uuid, actor_email text, field text, old_value text, new_value text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN QUERY SELECT a.id, u.email::text, a.field, a.old_value, a.new_value, a.created_at
    FROM public.platform_settings_audit a LEFT JOIN auth.users u ON u.id = a.actor
    ORDER BY a.created_at DESC LIMIT least(greatest(_limit,1),500);
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_settings_audit(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_settings_audit(integer) TO authenticated;