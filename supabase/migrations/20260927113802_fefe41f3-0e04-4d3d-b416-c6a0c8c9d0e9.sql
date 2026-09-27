ALTER TABLE public.listing_drafts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

CREATE OR REPLACE FUNCTION public.listing_draft_publish_issues(d public.listing_drafts)
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT array_remove(ARRAY[
    CASE WHEN d.image_path IS NULL THEN 'image' END,
    CASE WHEN length(btrim(d.title)) = 0 OR length(d.title) > 48 THEN 'title' END,
    CASE WHEN length(btrim(d.title_ar)) = 0 OR length(d.title_ar) > 48 THEN 'titleAr' END,
    CASE WHEN length(btrim(d.description)) = 0 OR length(d.description) > 700 THEN 'description' END,
    CASE WHEN length(btrim(d.description_ar)) = 0 OR length(d.description_ar) > 700 THEN 'descriptionAr' END,
    CASE WHEN length(btrim(d.alt_text)) = 0 OR length(d.alt_text) > 140 OR d.alt_text ~* '^(image|picture|photo)\M' OR btrim(d.alt_text) = btrim(d.title) THEN 'altText' END,
    CASE WHEN length(btrim(d.alt_text_ar)) = 0 OR length(d.alt_text_ar) > 140 OR d.alt_text_ar ~ '^صورة' OR btrim(d.alt_text_ar) = btrim(d.title_ar) THEN 'altTextAr' END
  ], NULL)
$$;

CREATE OR REPLACE FUNCTION public.guard_listing_draft_publish()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE issues text[];
BEGIN
  IF NEW.status NOT IN ('draft','submitted') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  IF NEW.status = 'submitted' THEN
    issues := public.listing_draft_publish_issues(NEW);
    IF array_length(issues, 1) > 0 THEN
      RAISE EXCEPTION 'Mobile readiness checks failed: %', array_to_string(issues, ',') USING ERRCODE = 'P0001';
    END IF;
    IF OLD.status IS DISTINCT FROM 'submitted' THEN NEW.submitted_at := now(); END IF;
  ELSE
    NEW.submitted_at := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_listing_draft_publish ON public.listing_drafts;
CREATE TRIGGER guard_listing_draft_publish BEFORE INSERT OR UPDATE ON public.listing_drafts
  FOR EACH ROW EXECUTE FUNCTION public.guard_listing_draft_publish();