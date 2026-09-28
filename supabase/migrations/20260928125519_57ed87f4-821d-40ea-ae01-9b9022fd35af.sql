CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'team' CHECK (kind IN ('team','gallery')),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  name_ar text NOT NULL DEFAULT '' CHECK (char_length(name_ar) <= 80),
  city text NOT NULL DEFAULT '' CHECK (char_length(city) <= 80),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid,
  email text NOT NULL CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role text NOT NULL DEFAULT 'editor' CHECK (role IN ('owner','manager','editor','reviewer','viewer')),
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active')),
  invited_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, email)
);
CREATE TABLE public.org_review_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  steps jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(steps) = 'array' AND jsonb_array_length(steps) BETWEEN 1 AND 8),
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.org_workflow_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.listing_drafts(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES public.org_review_workflows(id) ON DELETE CASCADE,
  step integer NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved','changes')),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 1000),
  actor uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.listing_drafts
  ADD COLUMN org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN workflow_id uuid REFERENCES public.org_review_workflows(id) ON DELETE SET NULL,
  ADD COLUMN workflow_step integer NOT NULL DEFAULT 0;

-- Caller's own role in an org (never answers for other users).
CREATE OR REPLACE FUNCTION public.my_org_role(_org uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM organization_members WHERE org_id = _org AND user_id = auth.uid() AND status = 'active' LIMIT 1
$$;
CREATE OR REPLACE FUNCTION public.org_rank(_role text) RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _role WHEN 'owner' THEN 5 WHEN 'manager' THEN 4 WHEN 'editor' THEN 3 WHEN 'reviewer' THEN 2 WHEN 'viewer' THEN 1 ELSE 0 END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations, public.organization_members, public.org_review_workflows TO authenticated;
GRANT SELECT, INSERT ON public.org_workflow_decisions TO authenticated;
GRANT ALL ON public.organizations, public.organization_members, public.org_review_workflows, public.org_workflow_decisions TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_review_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_workflow_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members and staff read orgs" ON public.organizations FOR SELECT TO authenticated
  USING (public.my_org_role(id) IS NOT NULL OR created_by = auth.uid() OR public.caller_is_staff());
CREATE POLICY "Signed-in users create orgs" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND NOT public.is_blocked(auth.uid()));
CREATE POLICY "Managers edit orgs" ON public.organizations FOR UPDATE TO authenticated
  USING (public.org_rank(public.my_org_role(id)) >= 4) WITH CHECK (public.org_rank(public.my_org_role(id)) >= 4);
CREATE POLICY "Owners delete orgs" ON public.organizations FOR DELETE TO authenticated
  USING (public.my_org_role(id) = 'owner');

CREATE POLICY "Members see members; invitees see own invite" ON public.organization_members FOR SELECT TO authenticated
  USING (public.my_org_role(org_id) IS NOT NULL OR user_id = auth.uid() OR lower(email) = lower(auth.jwt()->>'email') OR public.caller_is_staff());
CREATE POLICY "Managers invite (not owners)" ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (public.org_rank(public.my_org_role(org_id)) >= 4 AND role <> 'owner' AND status = 'invited' AND user_id IS NULL);
CREATE POLICY "Managers change roles below owner" ON public.organization_members FOR UPDATE TO authenticated
  USING (public.org_rank(public.my_org_role(org_id)) >= 4 AND role <> 'owner')
  WITH CHECK (public.org_rank(public.my_org_role(org_id)) >= 4 AND role <> 'owner');
CREATE POLICY "Managers remove members; anyone leaves" ON public.organization_members FOR DELETE TO authenticated
  USING ((public.org_rank(public.my_org_role(org_id)) >= 4 AND role <> 'owner') OR (user_id = auth.uid() AND role <> 'owner'));

CREATE POLICY "Members read workflows" ON public.org_review_workflows FOR SELECT TO authenticated
  USING (public.my_org_role(org_id) IS NOT NULL OR public.caller_is_staff());
CREATE POLICY "Managers write workflows" ON public.org_review_workflows FOR ALL TO authenticated
  USING (public.org_rank(public.my_org_role(org_id)) >= 4) WITH CHECK (public.org_rank(public.my_org_role(org_id)) >= 4);

CREATE POLICY "Members read decisions" ON public.org_workflow_decisions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM listing_drafts d WHERE d.id = draft_id AND (d.user_id = auth.uid() OR public.my_org_role(d.org_id) IS NOT NULL)) OR public.caller_is_staff());

-- Shared artwork management
CREATE POLICY "Org members read shared drafts" ON public.listing_drafts FOR SELECT TO authenticated
  USING (org_id IS NOT NULL AND public.my_org_role(org_id) IS NOT NULL);
CREATE POLICY "Org editors edit shared drafts" ON public.listing_drafts FOR UPDATE TO authenticated
  USING (org_id IS NOT NULL AND public.org_rank(public.my_org_role(org_id)) >= 3)
  WITH CHECK (org_id IS NOT NULL AND public.org_rank(public.my_org_role(org_id)) >= 3);

-- Owner becomes a member on create
CREATE OR REPLACE FUNCTION public.org_add_creator() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO organization_members (org_id, user_id, email, role, status, invited_by)
  VALUES (NEW.id, NEW.created_by, coalesce(auth.jwt()->>'email', NEW.created_by::text || '@unknown.local'), 'owner', 'active', NEW.created_by);
  RETURN NEW;
END $$;
CREATE TRIGGER org_add_creator AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.org_add_creator();

CREATE OR REPLACE FUNCTION public.org_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER org_touch BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.org_touch();
CREATE TRIGGER wf_touch BEFORE UPDATE ON public.org_review_workflows FOR EACH ROW EXECUTE FUNCTION public.org_touch();

-- Accept an invitation sent to the caller's email
CREATE OR REPLACE FUNCTION public.accept_org_invite(_invite uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m organization_members;
BEGIN
  SELECT * INTO m FROM organization_members WHERE id = _invite FOR UPDATE;
  IF m.id IS NULL OR m.status <> 'invited' OR lower(m.email) <> lower(coalesce(auth.jwt()->>'email','')) THEN RAISE EXCEPTION 'NOT_YOUR_INVITE'; END IF;
  UPDATE organization_members SET user_id = auth.uid(), status = 'active' WHERE id = _invite;
END $$;

-- Share a draft with an org (draft owner, must be an editor+ there)
CREATE OR REPLACE FUNCTION public.share_draft_with_org(_draft uuid, _org uuid, _workflow uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT user_id FROM listing_drafts WHERE id = _draft) IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'NOT_OWNER'; END IF;
  IF _org IS NOT NULL AND public.org_rank(public.my_org_role(_org)) < 3 THEN RAISE EXCEPTION 'NOT_EDITOR'; END IF;
  IF _workflow IS NOT NULL AND NOT EXISTS (SELECT 1 FROM org_review_workflows WHERE id = _workflow AND org_id = _org) THEN RAISE EXCEPTION 'BAD_WORKFLOW'; END IF;
  UPDATE listing_drafts SET org_id = _org, workflow_id = CASE WHEN _org IS NULL THEN NULL ELSE _workflow END, workflow_step = 0 WHERE id = _draft;
END $$;

-- Record a decision for the current workflow step; caller's role must match the step's role (or be manager+)
CREATE OR REPLACE FUNCTION public.decide_workflow_step(_draft uuid, _approve boolean, _note text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d listing_drafts; w org_review_workflows; st jsonb; r text; n integer;
BEGIN
  SELECT * INTO d FROM listing_drafts WHERE id = _draft FOR UPDATE;
  IF d.id IS NULL OR d.workflow_id IS NULL THEN RAISE EXCEPTION 'NO_WORKFLOW'; END IF;
  SELECT * INTO w FROM org_review_workflows WHERE id = d.workflow_id;
  n := jsonb_array_length(w.steps);
  IF d.workflow_step >= n THEN RAISE EXCEPTION 'WORKFLOW_DONE'; END IF;
  st := w.steps -> d.workflow_step;
  r := public.my_org_role(d.org_id);
  IF r IS NULL OR (public.org_rank(r) < 4 AND public.org_rank(r) < public.org_rank(coalesce(st->>'role','reviewer'))) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  IF d.user_id = auth.uid() AND coalesce((st->>'allowSelf')::boolean, false) = false AND public.org_rank(r) < 5 THEN RAISE EXCEPTION 'NO_SELF_APPROVAL'; END IF;
  IF NOT _approve AND char_length(coalesce(_note,'')) < 3 THEN RAISE EXCEPTION 'NOTE_REQUIRED'; END IF;
  INSERT INTO org_workflow_decisions (draft_id, workflow_id, step, decision, note, actor)
    VALUES (_draft, w.id, d.workflow_step, CASE WHEN _approve THEN 'approved' ELSE 'changes' END, left(coalesce(_note,''),1000), auth.uid());
  UPDATE listing_drafts SET workflow_step = CASE WHEN _approve THEN d.workflow_step + 1 ELSE 0 END WHERE id = _draft;
  PERFORM public.push_notification(d.user_id, 'listing', CASE WHEN _approve THEN 'Workflow step approved' ELSE 'Changes requested' END,
    CASE WHEN _approve THEN 'تمت الموافقة على خطوة المراجعة' ELSE 'طُلبت تعديلات' END,
    coalesce(st->>'name','Step'), coalesce(st->>'nameAr', st->>'name','خطوة'), '/teams');
  RETURN CASE WHEN _approve THEN d.workflow_step + 1 ELSE 0 END;
END $$;

REVOKE EXECUTE ON FUNCTION public.my_org_role(uuid), public.accept_org_invite(uuid), public.share_draft_with_org(uuid,uuid,uuid), public.decide_workflow_step(uuid,boolean,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.my_org_role(uuid), public.accept_org_invite(uuid), public.share_draft_with_org(uuid,uuid,uuid), public.decide_workflow_step(uuid,boolean,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.org_add_creator() FROM anon, public, authenticated;