CREATE TABLE public.listing_check_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.listing_drafts(id) ON DELETE CASCADE,
  check_text text NOT NULL CHECK (char_length(check_text) BETWEEN 1 AND 1000),
  field text NOT NULL DEFAULT 'general',
  result text NOT NULL CHECK (result IN ('passed','unresolved','follow_up')),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 1000),
  author uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.listing_check_results TO authenticated;
GRANT ALL ON public.listing_check_results TO service_role;
ALTER TABLE public.listing_check_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Moderators read check results" ON public.listing_check_results FOR SELECT TO authenticated USING (public.can_view_private_comments(auth.uid()));
CREATE POLICY "Moderators record check results" ON public.listing_check_results FOR INSERT TO authenticated WITH CHECK (public.can_view_private_comments(auth.uid()) AND author = auth.uid());
CREATE INDEX ON public.listing_check_results (draft_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_check_result() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.moderation_audit(actor, action, target_type, target_id, reason, details)
  VALUES (NEW.author, 'focused_check', 'listing_draft', NEW.draft_id::text, left(coalesce(nullif(NEW.note, ''), NEW.check_text), 500),
    jsonb_build_object('check', NEW.check_text, 'field', NEW.field, 'result', NEW.result, 'result_id', NEW.id));
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.log_check_result() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_log_check_result AFTER INSERT ON public.listing_check_results FOR EACH ROW EXECUTE FUNCTION public.log_check_result();