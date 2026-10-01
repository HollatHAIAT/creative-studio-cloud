import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * Order tracking, payment retry and moderation-tool access for people who are not allowed.
 * Runs live against the database as a signed-out visitor; every call must be refused or return nothing.
 */
const envFile = (() => { try { return readFileSync(".env", "utf8"); } catch { return ""; } })();
const fromEnv = (k: string) => process.env[k] ?? envFile.match(new RegExp(`${k}="?([^"\\n]+)`))?.[1];
const url = fromEnv("VITE_SUPABASE_URL"), key = fromEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
const db = () => createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
const ID = "00000000-0000-0000-0000-000000000000";
const rpc = (name: string, args: Record<string, unknown>) => db().rpc(name as never, args as never);

describe.skipIf(!url || !key)("order tracking", () => {
  it("visitors cannot list orders", async () => {
    const { data, error } = await db().from("orders").select("id").limit(1);
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });
  it("visitors cannot read order history events", async () => {
    const { data, error } = await db().from("order_events").select("id").limit(1);
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });
  it("visitors cannot create an order directly", async () => {
    const { error } = await db().from("orders").insert({ reference: "X", user_id: ID, items: [], subtotal: 0, vat: 0, shipping: 0, total: 0, currency: "SAR", contact: {}, payment_method: "bank", status: "paid" } as never);
    expect(error).not.toBeNull();
  });
});

describe.skipIf(!url || !key)("payment retry", () => {
  it("visitors cannot retry a payment", async () => {
    expect((await rpc("retry_payment", { _order: ID })).error).not.toBeNull();
  });
  it("visitors cannot mark a payment confirmed or failed", async () => {
    expect((await rpc("admin_confirm_payment", { _order: ID, _ref: "x" })).error).not.toBeNull();
    expect((await rpc("admin_mark_payment_failed", { _order: ID, _error: "x" })).error).not.toBeNull();
  });
  it("visitors cannot read payments", async () => {
    const { data, error } = await db().from("payments").select("id").limit(1);
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });
});

describe.skipIf(!url || !key)("moderation tools are blocked for unauthorised users", () => {
  const calls: [string, Record<string, unknown>][] = [
    ["admin_set_order_status", { _order_id: ID, _status: "paid", _note: "" }],
    ["admin_set_role", { _uid: ID, _role: "admin", _grant: true, _reason: "" }],
    ["admin_block_user", { _uid: ID, _until: null, _reason: "x" }],
    ["admin_lift_block", { _uid: ID, _reason: "x" }],
    ["admin_moderate_review", { _review: ID, _remove: true, _reason: "x" }],
    ["admin_decide_refund", { _request_id: ID, _approve: true, _note: "" }],
    ["admin_review_listing", { _id: ID, _approve: true, _note: "" }],
  ];
  for (const [name, args] of calls) {
    it(`refuses ${name}`, async () => { expect((await rpc(name, args)).error).not.toBeNull(); });
  }
  it("the old email-based admin claim no longer exists", async () => {
    expect((await rpc("claim_pending_role", {})).error).not.toBeNull();
  });
  it("visitors cannot grant themselves a role", async () => {
    const { error } = await db().from("user_roles").insert({ user_id: ID, role: "admin" } as never);
    expect(error).not.toBeNull();
  });
});
