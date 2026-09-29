CREATE TABLE public.audit_filter_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_email text,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  from_date text NOT NULL DEFAULT '', to_date text NOT NULL DEFAULT '', actor text NOT NULL DEFAULT '', field text NOT NULL DEFAULT '',
  shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_filter_presets TO authenticated;
GRANT ALL ON public.audit_filter_presets TO service_role;
ALTER TABLE public.audit_filter_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read own or shared presets" ON public.audit_filter_presets FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND (owner_id = auth.uid() OR shared));
CREATE POLICY "Admins add own presets" ON public.audit_filter_presets FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND owner_id = auth.uid());
CREATE POLICY "Admins edit own presets" ON public.audit_filter_presets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Admins delete own presets" ON public.audit_filter_presets FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND owner_id = auth.uid());
CREATE OR REPLACE FUNCTION public.audit_preset_stamp() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.owner_email := (SELECT email FROM auth.users WHERE id = NEW.owner_id);
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER audit_preset_stamp BEFORE INSERT OR UPDATE ON public.audit_filter_presets FOR EACH ROW EXECUTE FUNCTION public.audit_preset_stamp();