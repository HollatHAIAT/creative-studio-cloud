DROP FUNCTION IF EXISTS public.claim_pending_role();
DROP TABLE IF EXISTS public.pending_admins;
-- Roles are granted only by an existing admin via admin_set_role (checked + audited server-side).
REVOKE EXECUTE ON FUNCTION public.admin_set_role(uuid, app_role, boolean, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, app_role, boolean, text) TO authenticated;