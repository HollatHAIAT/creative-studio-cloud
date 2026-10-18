import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/** New supplier shops stay hidden until staff approve them; visitors can't approve. Runs live as a signed-out visitor. */
const envFile = (() => { try { return readFileSync(".env", "utf8"); } catch { return ""; } })();
const fromEnv = (k: string) => process.env[k] ?? envFile.match(new RegExp(`${k}="?([^"\\n]+)`))?.[1];
const url = fromEnv("VITE_SUPABASE_URL"), key = fromEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
const db = () => createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } }) as any;

describe.skipIf(!url || !key)("supplier approval", () => {
  it("visitors never see pending supplier shops", async () => {
    const { data } = await db().from("supplier_accounts").select("user_id").eq("status", "pending");
    expect(data ?? []).toHaveLength(0);
  });
  it("visitors only see products of approved suppliers", async () => {
    const { data } = await db().from("supplier_products").select("id, supplier_accounts(status)").limit(200);
    for (const p of data ?? []) expect(p.supplier_accounts?.status).toBe("active");
  });
  it("visitors cannot approve a supplier", async () => {
    const { error } = await db().rpc("admin_review_supplier", { _user: "00000000-0000-0000-0000-000000000000", _decision: "active", _note: "" });
    expect(error).not.toBeNull();
  });
});
