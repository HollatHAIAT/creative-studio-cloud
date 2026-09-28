CREATE TABLE public.listing_version_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.listing_drafts(id) ON DELETE CASCADE,
  version integer NOT NULL,
  field text NOT NULL CHECK (field IN ('title','title_ar','description','description_ar','alt_text','alt_text_ar','medium','tags','image')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  author uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.listing_version_comments TO authenticated;
GRANT ALL ON public.listing_version_comments TO service_role;
ALTER TABLE public.listing_version_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read version comments" ON public.listing_version_comments FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff add version comments" ON public.listing_version_comments FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND author = auth.uid());
CREATE INDEX ON public.listing_version_comments (draft_id, version);

CREATE OR REPLACE FUNCTION public.log_version_comment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.moderation_audit(actor, action, target_type, target_id, reason, details)
  VALUES (NEW.author, 'version_comment', 'listing_draft', NEW.draft_id::text, left(NEW.body, 500),
          jsonb_build_object('version', NEW.version, 'field', NEW.field, 'comment_id', NEW.id));
  RETURN NEW;
END $$;
CREATE TRIGGER trg_log_version_comment AFTER INSERT ON public.listing_version_comments FOR EACH ROW EXECUTE FUNCTION public.log_version_comment();