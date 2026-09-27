import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * Access control for listings:
 *  - Visitors (not signed in) can read published artworks — no staff approval needed.
 *  - Visitors can never read draft / pending / archived listings.
 */
const envFile = (() => { try { return readFileSync(".env", "utf8"); } catch { return ""; } })();
const fromEnv = (k: string) => process.env[k] ?? envFile.match(new RegExp(`${k}="?([^"\\n]+)`))?.[1];
const url = fromEnv("VITE_SUPABASE_URL"), key = fromEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
const visitor = () => createClient(url!, key!, { auth: { persistSession: false } });

describe.skipIf(!url || !key)("visitor access to listings (live database)", () => {
  it("lets a visitor read published artworks", async () => {
    const { data, error } = await visitor().from("listings").select("id,status").eq("id", "ochre-tide");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: "ochre-tide", status: "published" }]);
  });

  it("only ever returns published listings to a visitor", async () => {
    const { data, error } = await visitor().from("listings").select("id,status");
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.every((r) => r.status === "published")).toBe(true);
  });

  it("returns nothing when a visitor asks for unpublished listings", async () => {
    const { data, error } = await visitor().from("listings").select("id").neq("status", "published");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("does not let a visitor publish or create listings", async () => {
    const c = visitor();
    const ins = await c.from("listings").insert({ id: "zz-visitor", title: "x", title_ar: "x", creator_id: "x", category: "Painting", status: "published", price: 1 });
    expect(ins.error).not.toBeNull();
    const upd = await c.from("listings").update({ status: "published" }).neq("status", "published").select("id");
    expect(upd.data ?? []).toEqual([]);
  });
});

/**
 * The visitor rule itself: the only anonymous read policy must be "status = published"
 * and must not depend on staff approval (is_staff). Runs where direct database access exists.
 */
const hasDb = !!process.env["PGHOST"];
describe.skipIf(!hasDb)("listings visibility rules (database policies)", () => {
  const rows = hasDb
    ? execSync(`psql -Atc "select roles::text || '|' || cmd || '|' || coalesce(qual,'') from pg_policies where schemaname='public' and tablename='listings'"`).toString().trim().split("\n")
    : [];
  const anon = rows.filter((r) => r.includes("anon"));

  it("has exactly one visitor read rule, limited to published listings", () => {
    expect(anon).toHaveLength(1);
    expect(anon[0]).toMatch(/\|SELECT\|\(status = 'published'::text\)$/);
  });

  it("does not require staff approval for visitors", () => {
    expect(anon[0]).not.toMatch(/is_staff/);
  });

  it("gives visitors no write rules", () => {
    expect(anon.every((r) => r.includes("|SELECT|"))).toBe(true);
  });
});
