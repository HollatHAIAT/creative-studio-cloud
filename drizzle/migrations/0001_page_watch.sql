CREATE TABLE public.watch_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL UNIQUE CHECK (url ~ '^https?://' AND char_length(url) <= 500),
  label text NOT NULL DEFAULT '' CHECK (char_length(label) <= 120),
  kind text NOT NULL DEFAULT 'competitor' CHECK (kind IN ('competitor','regulator')),
  active boolean NOT NULL DEFAULT true,
  last_content text,
  last_checked_at timestamptz,
  last_error text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_pages TO authenticated;
GRANT ALL ON public.watch_pages TO service_role;
ALTER TABLE public.watch_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage watched pages" ON public.watch_pages FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.watch_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.watch_pages(id) ON DELETE CASCADE,
  checked_at timestamptz NOT NULL DEFAULT now(),
  added text[] NOT NULL DEFAULT '{}',
  removed text[] NOT NULL DEFAULT '{}',
  seen_at timestamptz
);
CREATE INDEX watch_changes_page_idx ON public.watch_changes(page_id, checked_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.watch_changes TO authenticated;
GRANT ALL ON public.watch_changes TO service_role;
ALTER TABLE public.watch_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read changes" ON public.watch_changes FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff mark changes seen" ON public.watch_changes FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff delete changes" ON public.watch_changes FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));