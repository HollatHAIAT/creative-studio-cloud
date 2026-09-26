import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Current session (browser only; null during SSR and when signed out). */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, user: session?.user ?? null, ready };
}

/** Staff = admin or moderator, checked in the database. */
export function useStaff() {
  const { user } = useSession();
  const q = useQuery({
    queryKey: ["staff", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [a, m] = await Promise.all([
        supabase.rpc("has_role", { _user_id: user!.id, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: user!.id, _role: "moderator" }),
      ]);
      return { admin: !!a.data, staff: !!a.data || !!m.data };
    },
  });
  return { isAdmin: q.data?.admin ?? false, isStaff: q.data?.staff ?? false, loading: q.isLoading };
}

export const safeNext = (n: unknown) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : "/");
