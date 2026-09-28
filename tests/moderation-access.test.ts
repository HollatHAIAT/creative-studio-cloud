import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Role-based access to private field comments (listing_version_comments), focused-check results,
 * staff-only review comments and the moderation history (moderation_audit).
 *
 * Expected: moderators + admins read and add; sellers, buyers, invited reviewers and signed-out
 * visitors never see them; nobody edits or deletes.
 *
 * 1. Signed-out visitor — live against the database.
 * 2. Rules — reads the live access rules and grants and checks them per role (needs database access).
 * 3. Signed-in roles — live, runs only when test accounts are provided:
 *    TEST_{MODERATOR|ADMIN|SELLER|BUYER|REVIEWER}_EMAIL and _PASSWORD.
 */
const envFile = (() => { try { return readFileSync(".env", "utf8"); } catch { return ""; } })();
const fromEnv = (k: string) => process.env[k] ?? envFile.match(new RegExp(`${k}="?([^"\\n]+)`))?.[1];
const url = fromEnv("VITE_SUPABASE_URL"), key = fromEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
const client = () => createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });

const PRIVATE = ["listing_version_comments", "moderation_audit", "listing_check_results"] as const;
const DRAFT = "00000000-0000-0000-0000-000000000000";
const insertRow: Record<string, Record<string, unknown>> = {
  listing_version_comments: { draft_id: DRAFT, version: 1, field: "title", body: "probe" },
  moderation_audit: { action: "probe", target_type: "x", target_id: "x", reason: "" },
  listing_check_results: { draft_id: DRAFT, check_text: "probe", result: "passed" },
};

// ---------- 1. Signed-out visitors ----------
describe.skipIf(!url || !key)("signed-out visitor (live database)", () => {
  for (const t of PRIVATE) {
    it(`cannot read ${t}`, async () => {
      const { data, error } = await client().from(t).select("*").limit(1);
      expect(error !== null || (data ?? []).length === 0).toBe(true);
    });
    it(`cannot add to ${t}`, async () => {
      const { error } = await client().from(t).insert(insertRow[t]!);
      expect(error).not.toBeNull();
    });
  }
  it("cannot read any staff-only review comment", async () => {
    const { data, error } = await client().from("listing_review_comments").select("id").eq("visibility", "internal");
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });
  it("cannot ask who is a moderator or admin", async () => {
    const r1 = await client().rpc("can_view_private_comments", { _uid: DRAFT });
    const r2 = await client().rpc("has_role", { _user_id: DRAFT, _role: "admin" });
    expect(r1.error).not.toBeNull();
    expect(r2.error).not.toBeNull();
  });
});

// ---------- 2. Rules, checked per role ----------
const sql = (q: string) => execSync(`psql -At -F '|' -c ${JSON.stringify(q)}`, { encoding: "utf8" }).trim();
const hasDb = (() => { try { return !!process.env["PGHOST"] && sql("select 1") === "1"; } catch { return false; } })();

type Role = "moderator" | "admin" | "seller" | "buyer" | "reviewer" | "visitor";
const ROLES: Role[] = ["moderator", "admin", "seller", "buyer", "reviewer", "visitor"];
const isStaff = (r: Role) => r === "moderator" || r === "admin";

describe.skipIf(!hasDb)("access rules for private comments & moderation history", () => {
  const policies = hasDb ? sql(`select tablename, cmd, roles::text, coalesce(qual,''), coalesce(with_check,'') from pg_policies where schemaname='public' and tablename in ('listing_version_comments','moderation_audit','listing_check_results','listing_review_comments')`)
    .split("\n").map((l) => { const [table, cmd, roles, using, check] = l.split("|"); return { table: table!, cmd: cmd!, roles: roles!, using: using!, check: check! }; }) : [];

  /** Evaluate a rule for a role. The only role-dependent parts are can_view_private_comments / is_staff;
   *  draft_owner/active_reviewer/author are treated as matching (worst case), so a rule that needs staff must still say so. */
  const allows = (expr: string, role: Role) => {
    if (role === "visitor") return false; // every rule here is for signed-in users only (checked below)
    if (!expr) return true;
    const staffOnly = /^\(?can_view_private_comments\(auth\.uid\(\)\)( AND \(author = auth\.uid\(\)\))?\)?$/.test(expr);
    return staffOnly ? isStaff(role) : true;
  };

  for (const t of PRIVATE) {
    it(`${t}: only signed-in users are covered by any rule`, () => {
      for (const p of policies.filter((x) => x.table === t)) expect(p.roles).toBe("{authenticated}");
    });
    it(`${t}: nobody can edit or delete`, () => {
      expect(policies.filter((p) => p.table === t && ["UPDATE", "DELETE", "ALL"].includes(p.cmd))).toEqual([]);
    });
    for (const role of ROLES) {
      it(`${t}: ${role} ${isStaff(role) ? "can" : "cannot"} read`, () => {
        const reads = policies.filter((p) => p.table === t && p.cmd === "SELECT");
        expect(reads.length).toBeGreaterThan(0);
        expect(reads.some((p) => allows(p.using, role))).toBe(isStaff(role));
      });
    }
    it(`${t}: signed-out visitors have no table access at all`, () => {
      expect(sql(`select has_table_privilege('anon','public.${t}','select')::text || has_table_privilege('anon','public.${t}','insert')::text`)).toBe("falsefalse");
    });
  }

  it("moderation_audit: nobody adds entries directly (only the system does)", () => {
    expect(policies.filter((p) => p.table === "moderation_audit" && p.cmd === "INSERT")).toEqual([]);
  });

  it("private comments and check results: only moderators and admins can add", () => {
    for (const t of ["listing_version_comments", "listing_check_results"]) {
      const ins = policies.filter((p) => p.table === t && p.cmd === "INSERT");
      for (const role of ROLES) expect(ins.some((p) => allows(p.check, role))).toBe(isStaff(role));
    }
  });

  it("staff-only review comments: reading needs moderator/admin", () => {
    const read = policies.find((p) => p.table === "listing_review_comments" && p.cmd === "SELECT")!;
    expect(read.using).toMatch(/\(visibility = 'internal'::text\) AND can_view_private_comments\(auth\.uid\(\)\)/);
    // every other branch explicitly excludes internal comments
    expect(read.using).toMatch(/\(visibility <> 'internal'::text\) AND/);
  });

  it("staff-only review comments: only staff can write internal ones, reviewers never", () => {
    const ins = policies.find((p) => p.table === "listing_review_comments" && p.cmd === "INSERT")!;
    expect(ins.check).toMatch(/is_staff\(auth\.uid\(\)\) AND \(visibility = 'internal'::text\)/);
    expect(ins.check).toMatch(/visibility <> 'internal'::text/);
  });

  it("the moderator/admin check only returns yes for those two roles", () => {
    const body = sql(`select prosrc from pg_proc where proname='can_view_private_comments'`);
    expect(body).toMatch(/has_role\(_uid, 'moderator'\) OR public\.has_role\(_uid, 'admin'\)/);
  });

  it("users can't ask whether someone else is a moderator or admin", () => {
    expect(sql(`select prosrc from pg_proc where proname='has_role'`)).toMatch(/_user_id = auth\.uid\(\) OR public\.caller_is_staff\(\)/);
    expect(sql(`select has_function_privilege('anon','public.can_view_private_comments(uuid)','execute')::text`)).toBe("false");
  });
});

// ---------- 3. Signed-in roles (live, needs test accounts) ----------
const accounts = (["moderator", "admin", "seller", "buyer", "reviewer"] as const)
  .map((r) => ({ role: r, email: fromEnv(`TEST_${r.toUpperCase()}_EMAIL`), password: fromEnv(`TEST_${r.toUpperCase()}_PASSWORD`) }))
  .filter((a) => a.email && a.password);

describe.skipIf(!url || !key || accounts.length === 0)("signed-in roles (live database)", () => {
  const signIn = async (email: string, password: string): Promise<SupabaseClient> => {
    const c = client(); const { error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw error; return c;
  };
  for (const a of accounts) {
    const staff = a.role === "moderator" || a.role === "admin";
    for (const t of PRIVATE) {
      it(`${a.role} ${staff ? "can" : "cannot"} read ${t}`, async () => {
        const c = await signIn(a.email!, a.password!);
        const { data, error } = await c.from(t).select("*").limit(5);
        if (staff) expect(error).toBeNull();
        else expect(error !== null || (data ?? []).length === 0).toBe(true);
      });
    }
    it(`${a.role} cannot edit or delete moderation history`, async () => {
      const c = await signIn(a.email!, a.password!);
      const u = await c.from("moderation_audit").update({ reason: "tamper" }).neq("id", DRAFT).select("id");
      const d = await c.from("moderation_audit").delete().neq("id", DRAFT).select("id");
      expect(u.error !== null || (u.data ?? []).length === 0).toBe(true);
      expect(d.error !== null || (d.data ?? []).length === 0).toBe(true);
    });
    if (!staff) it(`${a.role} cannot add a private field comment`, async () => {
      const c = await signIn(a.email!, a.password!);
      const { error } = await c.from("listing_version_comments").insert(insertRow["listing_version_comments"]!);
      expect(error).not.toBeNull();
    });
  }
});
