import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Permanently deletes the caller's own account after they re-type their email. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ confirmEmail: z.string().trim().max(320) }).parse(d))
  .handler(async ({ data, context }) => {
    const email = String((context.claims as { email?: string }).email ?? "").toLowerCase();
    if (!email || data.confirmEmail.toLowerCase() !== email) return { ok: false as const, error: "The email doesn't match your account." };
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (isAdmin) return { ok: false as const, error: "Admins must hand over their admin role before deleting their account." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: files } = await supabaseAdmin.storage.from("avatars").list(context.userId);
    if (files?.length) await supabaseAdmin.storage.from("avatars").remove(files.map((f) => `${context.userId}/${f.name}`));
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) { console.error(error); return { ok: false as const, error: "The account couldn't be deleted. Please contact support." }; }
    return { ok: true as const };
  });
