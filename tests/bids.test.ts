import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { bidRejection } from "../src/lib/auctions";

describe("bid rejection reasons", () => {
  it("maps too-low bids with the new minimum", () => {
    expect(bidRejection('BID_TOO_LOW:5400')).toEqual({ code: "BID_TOO_LOW", min: 5400 });
  });
  it("maps ended / not started auctions", () => {
    expect(bidRejection("AUCTION_ENDED").code).toBe("AUCTION_ENDED");
    expect(bidRejection("AUCTION_NOT_STARTED").code).toBe("AUCTION_NOT_STARTED");
  });
  it("falls back for unknown errors", () => {
    expect(bidRejection("network down").code).toBe("failed");
  });
});

/**
 * Integration: two signed-in bidders race the same amount. Exactly one must win,
 * the other is rejected with BID_TOO_LOW, and the top bid stays consistent.
 * Needs two confirmed test accounts: TEST_BIDDER1_EMAIL/PASSWORD, TEST_BIDDER2_EMAIL/PASSWORD.
 */
const env = process.env;
const url = env["VITE_SUPABASE_URL"], key = env["VITE_SUPABASE_PUBLISHABLE_KEY"];
const ready = url && key && env["TEST_BIDDER1_EMAIL"] && env["TEST_BIDDER2_EMAIL"];

describe.skipIf(!ready)("concurrent bids (live database)", () => {
  it("accepts one of two simultaneous equal bids and keeps the price correct", async () => {
    const mk = async (e: string, p: string) => {
      const c = createClient(url!, key!, { auth: { persistSession: false } });
      const { data, error } = await c.auth.signInWithPassword({ email: e, password: p });
      if (error) throw error;
      return { c, uid: data.user!.id };
    };
    const a = await mk(env["TEST_BIDDER1_EMAIL"]!, env["TEST_BIDDER1_PASSWORD"]!);
    const b = await mk(env["TEST_BIDDER2_EMAIL"]!, env["TEST_BIDDER2_PASSWORD"]!);
    const auction = "the-line-auction";
    const top = async () => Number((await a.c.from("bids").select("amount").eq("auction_id", auction).order("amount", { ascending: false }).limit(1)).data?.[0]?.amount ?? 0);
    const before = await top();
    const amount = before + 50;
    const results = await Promise.all([
      a.c.from("bids").insert({ auction_id: auction, user_id: a.uid, bidder_name: "Test A", amount }),
      b.c.from("bids").insert({ auction_id: auction, user_id: b.uid, bidder_name: "Test B", amount }),
    ]);
    const ok = results.filter((r) => !r.error);
    const rejected = results.filter((r) => r.error);
    expect(ok).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(bidRejection(rejected[0]!.error!.message).code).toBe("BID_TOO_LOW");
    expect(await top()).toBe(amount);
  }, 20000);
});
