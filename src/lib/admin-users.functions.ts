import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminUser = {
  id: string; email: string; createdAt: string; lastSignIn: string | null; confirmed: boolean;
  roles: string[]; blocked: { until: string | null; reason: string } | null;
};

/** Lists accounts with roles and active suspensions — staff only (checked before any privileged read). */
export const listAdminUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().trim().max(120).default(""), page: z.number().int().min(1).max(1000).default(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: staff } = await context.supabase.rpc("is_staff", { _uid: context.userId });
    if (!staff) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const perPage = 50;
    const { data: res, error } = await supabaseAdmin.auth.admin.listUsers({ page: data.q ? 1 : data.page, perPage: data.q ? 1000 : perPage });
    if (error) throw new Error(error.message);
    let users = res.users;
    if (data.q) { const q = data.q.toLowerCase(); users = users.filter((u) => (u.email ?? "").toLowerCase().includes(q) || u.id === data.q); }
    const ids = users.map((u) => u.id);
    const [{ data: roles }, { data: blocks }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
      supabaseAdmin.from("user_blocks").select("user_id, blocked_until, reason, lifted_at, created_at").in("user_id", ids).is("lifted_at", null).order("created_at", { ascending: false }),
    ]);
    const now = Date.now();
    const out: AdminUser[] = users.map((u) => {
      const b = (blocks ?? []).find((x) => x.user_id === u.id && (!x.blocked_until || new Date(x.blocked_until).getTime() > now));
      return {
        id: u.id, email: u.email ?? "", createdAt: u.created_at, lastSignIn: u.last_sign_in_at ?? null, confirmed: !!u.email_confirmed_at,
        roles: (roles ?? []).filter((r) => r.user_id === u.id).map((r) => r.role),
        blocked: b ? { until: b.blocked_until, reason: b.reason } : null,
      };
    });
    return { users: out, hasMore: !data.q && res.users.length === perPage, me: context.userId };
  });

/** Grants or removes a role; the database checks the caller is an admin and logs the change. */
export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), role: z.enum(["admin", "moderator"]), grant: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("admin_set_role" as never, { _uid: data.userId, _role: data.role, _grant: data.grant, _reason: "" } as never);
    if (error) return { ok: false as const, error: (error as { message: string }).message };
    return { ok: true as const };
  });
