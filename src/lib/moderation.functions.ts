import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Suspends a user: records the block + audit via RPC (staff-checked), then blocks sign-in for the period. */
export const suspendUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), days: z.number().int().min(1).max(3650).nullable(), reason: z.string().trim().min(2).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const until = data.days ? new Date(Date.now() + data.days * 86400_000).toISOString() : null;
    const { error } = await context.supabase.rpc("admin_block_user", { _uid: data.userId, _until: until as string, _reason: data.reason });
    if (error) return { ok: false as const, error: error.message };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: be } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: data.days ? `${data.days * 24}h` : "876000h" });
    if (be) { console.error(be); return { ok: true as const, warning: "Sign-in block could not be applied" }; }
    return { ok: true as const };
  });

export const reinstateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), reason: z.string().trim().max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("admin_lift_block", { _uid: data.userId, _reason: data.reason });
    if (error) return { ok: false as const, error: error.message };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: "none" });
    return { ok: true as const };
  });
