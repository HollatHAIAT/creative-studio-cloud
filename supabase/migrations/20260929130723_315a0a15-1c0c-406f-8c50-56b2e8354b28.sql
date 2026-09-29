CREATE TABLE public.cms_entries (
  kind text NOT NULL CHECK (kind IN ('text','artist','category','exhibition','banner')),
  key text NOT NULL CHECK (char_length(key) BETWEEN 1 AND 120),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  published boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, key)
);
GRANT SELECT ON public.cms_entries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_entries TO authenticated;
GRANT ALL ON public.cms_entries TO service_role;
ALTER TABLE public.cms_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads published content" ON public.cms_entries FOR SELECT USING (published OR public.caller_is_staff());
CREATE POLICY "Admins insert content" ON public.cms_entries FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update content" ON public.cms_entries FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete content" ON public.cms_entries FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.cms_touch() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now(); NEW.updated_by := auth.uid();
  -- Exhibitions added or resized here must exist for bookings, with the admin's capacity.
  IF NEW.kind = 'exhibition' THEN
    INSERT INTO public.exhibitions(id, capacity) VALUES (NEW.key, GREATEST(1, COALESCE((NEW.data->>'capacity')::int, 40)))
    ON CONFLICT (id) DO UPDATE SET capacity = EXCLUDED.capacity;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.cms_touch() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER cms_touch BEFORE INSERT OR UPDATE ON public.cms_entries FOR EACH ROW EXECUTE FUNCTION public.cms_touch();