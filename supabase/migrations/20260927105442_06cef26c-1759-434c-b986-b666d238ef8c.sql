CREATE TABLE public.listing_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL DEFAULT '' CHECK (char_length(title) <= 200),
  title_ar text NOT NULL DEFAULT '' CHECK (char_length(title_ar) <= 200),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 4000),
  description_ar text NOT NULL DEFAULT '' CHECK (char_length(description_ar) <= 4000),
  alt_text text NOT NULL DEFAULT '' CHECK (char_length(alt_text) <= 300),
  alt_text_ar text NOT NULL DEFAULT '' CHECK (char_length(alt_text_ar) <= 300),
  tags text[] NOT NULL DEFAULT '{}' CHECK (cardinality(tags) <= 20),
  medium text NOT NULL DEFAULT '' CHECK (char_length(medium) <= 160),
  image_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_drafts TO authenticated;
GRANT ALL ON public.listing_drafts TO service_role;
ALTER TABLE public.listing_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers manage own drafts" ON public.listing_drafts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX listing_drafts_user_idx ON public.listing_drafts (user_id, updated_at DESC);
CREATE OR REPLACE FUNCTION public.touch_listing_draft() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER listing_drafts_touch BEFORE UPDATE ON public.listing_drafts FOR EACH ROW EXECUTE FUNCTION public.touch_listing_draft();