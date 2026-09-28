CREATE TABLE public.revision_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.listing_drafts(id) ON DELETE CASCADE,
  author uuid NOT NULL DEFAULT auth.uid(),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  field text NOT NULL DEFAULT 'general',
  action text NOT NULL CHECK (char_length(action) BETWEEN 1 AND 500),
  action_ar text NOT NULL DEFAULT '' CHECK (char_length(action_ar) <= 500),
  why text NOT NULL DEFAULT '' CHECK (char_length(why) <= 500),
  why_ar text NOT NULL DEFAULT '' CHECK (char_length(why_ar) <= 500),
  done_at timestamptz,
  done_by uuid,
  seller_note text CHECK (seller_note IS NULL OR char_length(seller_note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.revision_checklist_items(draft_id);
GRANT SELECT, INSERT ON public.revision_checklist_items TO authenticated;
GRANT ALL ON public.revision_checklist_items TO service_role;
ALTER TABLE public.revision_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner, invited reviewers and staff read checklist"
ON public.revision_checklist_items FOR SELECT TO authenticated
USING (public.draft_owner(draft_id) = auth.uid() OR public.active_reviewer(draft_id, auth.uid()) IS NOT NULL OR public.caller_is_staff());

CREATE POLICY "Commenting reviewers add checklist items"
ON public.revision_checklist_items FOR INSERT TO authenticated
WITH CHECK (author = auth.uid() AND done_at IS NULL AND done_by IS NULL
  AND coalesce(public.active_reviewer(draft_id, auth.uid()), 'view') <> 'view');

CREATE OR REPLACE FUNCTION public.set_checklist_item_done(_item uuid, _done boolean, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d uuid;
BEGIN
  SELECT draft_id INTO d FROM revision_checklist_items WHERE id = _item;
  IF d IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF (SELECT user_id FROM listing_drafts WHERE id = d) IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'only the seller can update progress';
  END IF;
  UPDATE revision_checklist_items
     SET done_at = CASE WHEN _done THEN now() END,
         done_by = CASE WHEN _done THEN auth.uid() END,
         seller_note = nullif(left(coalesce(_note, seller_note, ''), 500), '')
   WHERE id = _item;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_checklist_item_done(uuid, boolean, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_checklist_item_done(uuid, boolean, text) TO authenticated;