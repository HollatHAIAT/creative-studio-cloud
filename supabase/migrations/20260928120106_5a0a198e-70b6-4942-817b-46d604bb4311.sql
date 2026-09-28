CREATE OR REPLACE FUNCTION public.can_view_private_comments(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND (public.has_role(_uid, 'moderator') OR public.has_role(_uid, 'admin'))
$$;
REVOKE EXECUTE ON FUNCTION public.can_view_private_comments(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_private_comments(uuid) TO authenticated;

REVOKE ALL ON public.listing_version_comments FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE ON public.listing_version_comments FROM authenticated;
GRANT SELECT, INSERT ON public.listing_version_comments TO authenticated;
DROP POLICY IF EXISTS "Staff read version comments" ON public.listing_version_comments;
DROP POLICY IF EXISTS "Staff add version comments" ON public.listing_version_comments;
CREATE POLICY "Moderators read private comments" ON public.listing_version_comments FOR SELECT TO authenticated
  USING (public.can_view_private_comments(auth.uid()));
CREATE POLICY "Moderators add private comments" ON public.listing_version_comments FOR INSERT TO authenticated
  WITH CHECK (public.can_view_private_comments(auth.uid()) AND author = auth.uid());

REVOKE ALL ON public.moderation_audit FROM anon;
DROP POLICY IF EXISTS "Staff read audit" ON public.moderation_audit;
CREATE POLICY "Moderators read audit" ON public.moderation_audit FOR SELECT TO authenticated
  USING (public.can_view_private_comments(auth.uid()));

DROP POLICY IF EXISTS "Comment read by visibility" ON public.listing_review_comments;
CREATE POLICY "Comment read by visibility" ON public.listing_review_comments FOR SELECT TO authenticated USING (
  (visibility = 'internal' AND public.can_view_private_comments(auth.uid()))
  OR (visibility <> 'internal' AND (
    author = auth.uid() OR public.can_view_private_comments(auth.uid())
    OR (visibility IN ('team','reviewers','artist','anonymous') AND public.draft_owner(draft_id) = auth.uid())
    OR (visibility IN ('team','reviewers') AND public.active_reviewer(draft_id, auth.uid()) IS NOT NULL))));