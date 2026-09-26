CREATE TABLE public.pending_admins (email text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.pending_admins TO service_role;
ALTER TABLE public.pending_admins ENABLE ROW LEVEL SECURITY;
INSERT INTO public.pending_admins (email) VALUES ('alhabaty@gmail.com');

CREATE OR REPLACE FUNCTION public.claim_pending_role()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e text; uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  SELECT lower(email) INTO e FROM auth.users WHERE id = uid AND email_confirmed_at IS NOT NULL;
  IF e IS NULL OR NOT EXISTS (SELECT 1 FROM public.pending_admins WHERE email = e) THEN RETURN false; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin') ON CONFLICT DO NOTHING;
  DELETE FROM public.pending_admins WHERE email = e;
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.claim_pending_role() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_pending_role() TO authenticated;