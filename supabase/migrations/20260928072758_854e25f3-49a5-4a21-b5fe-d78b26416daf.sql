CREATE TABLE public.listing_draft_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.listing_drafts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  version integer NOT NULL,
  title text NOT NULL, title_ar text NOT NULL,
  description text NOT NULL, description_ar text NOT NULL,
  alt_text text NOT NULL, alt_text_ar text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}', medium text NOT NULL DEFAULT '',
  image_path text,
  previous_review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_id, version)
);
GRANT SELECT ON public.listing_draft_versions TO authenticated;
GRANT ALL ON public.listing_draft_versions TO service_role;
ALTER TABLE public.listing_draft_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read listing versions" ON public.listing_draft_versions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Sellers read own listing versions" ON public.listing_draft_versions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.snapshot_listing_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prev_note text;
BEGIN
  IF NEW.status <> 'submitted' OR (TG_OP = 'UPDATE' AND OLD.status = 'submitted') THEN RETURN NEW; END IF;
  SELECT review_note INTO prev_note FROM public.listing_drafts_last_note WHERE false; -- placeholder never used
  RETURN NEW;
END $$;

-- Capture the last reviewer note before the BEFORE trigger clears it
CREATE OR REPLACE FUNCTION public.snapshot_listing_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE note text;
BEGIN
  IF NEW.status <> 'submitted' OR (TG_OP = 'UPDATE' AND OLD.status = 'submitted') THEN RETURN NEW; END IF;
  note := CASE WHEN TG_OP = 'UPDATE' THEN OLD.review_note END;
  IF note IS NULL THEN
    SELECT m.reason INTO note FROM public.moderation_audit m
    WHERE m.target_type = 'listing_draft' AND m.target_id = NEW.id::text AND m.action = 'listing_rejected'
    ORDER BY m.created_at DESC LIMIT 1;
  END IF;
  INSERT INTO public.listing_draft_versions (draft_id, user_id, version, title, title_ar, description, description_ar, alt_text, alt_text_ar, tags, medium, image_path, previous_review_note)
  VALUES (NEW.id, NEW.user_id, coalesce((SELECT max(version) FROM public.listing_draft_versions WHERE draft_id = NEW.id), 0) + 1,
    NEW.title, NEW.title_ar, NEW.description, NEW.description_ar, NEW.alt_text, NEW.alt_text_ar, NEW.tags, NEW.medium, NEW.image_path, nullif(btrim(coalesce(note,'')), ''));
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.snapshot_listing_submission() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER listing_drafts_snapshot AFTER INSERT OR UPDATE OF status ON public.listing_drafts
FOR EACH ROW EXECUTE FUNCTION public.snapshot_listing_submission();

-- Backfill: current submitted/reviewed listings become version 1
INSERT INTO public.listing_draft_versions (draft_id, user_id, version, title, title_ar, description, description_ar, alt_text, alt_text_ar, tags, medium, image_path, created_at)
SELECT id, user_id, 1, title, title_ar, description, description_ar, alt_text, alt_text_ar, tags, medium, image_path, coalesce(submitted_at, updated_at)
FROM public.listing_drafts WHERE status <> 'draft' ON CONFLICT DO NOTHING;