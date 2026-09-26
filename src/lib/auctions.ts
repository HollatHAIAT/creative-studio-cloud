import { useEffect, useState } from "react";
import { auctions, type Auction } from "./data";
import type { Bid } from "./store";

const H = 3600_000;
export const dayStart = (now: number) => { const d = new Date(now); d.setUTCHours(0, 0, 0, 0); return d.getTime(); };
export const times = (a: Auction, now: number) => ({ start: dayStart(now) + a.startOffsetH * H, end: dayStart(now) + a.endOffsetH * H });
export type AuctionStatus = "upcoming" | "live" | "closed";
export const statusOf = (a: Auction, now: number): AuctionStatus => { const t = times(a, now); return now < t.start ? "upcoming" : now >= t.end ? "closed" : "live"; };

export function allBids(a: Auction, extra: Bid[] | undefined, now: number): Bid[] {
  const seed: Bid[] = a.seedBids.map((b, i) => ({ id: `${a.id}-s${i}`, bidder: b.bidder, amount: b.amount, at: now - b.hoursAgo * H }));
  return [...seed, ...(extra ?? [])].sort((x, y) => y.at - x.at);
}
export const topBid = (bids: Bid[]) => bids.reduce<Bid | null>((m, b) => (!m || b.amount > m.amount ? b : m), null);
export const minNext = (a: Auction, bids: Bid[]) => { const t = topBid(bids); return t ? t.amount + a.increment : a.startBid; };
export const auctionFor = (listingId: string) => auctions.find((a) => a.listingId === listingId);

export function countdown(ms: number) {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d > 0 ? `${d}d ` : ""}${p(h)}:${p(m)}:${p(sec)}`;
}

/** Ticking clock; returns 0 during SSR so markup is stable until hydration. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(0);
  useEffect(() => { setNow(Date.now()); const i = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(i); }, [ms]);
  return now;
}

// ---------- Database-backed auctions ----------
import { useEffect as useEff } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DbAuction = { id: string; listing_id: string; start_bid: number; increment: number; starts_at: string; ends_at: string };
export type DbBid = { id: string; auction_id: string; user_id: string | null; bidder_name: string; amount: number; created_at: string };

export function useDbAuctions() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["auctions"],
    queryFn: async () => {
      const [a, b] = await Promise.all([
        supabase.from("auctions").select("id, listing_id, start_bid, increment, starts_at, ends_at"),
        supabase.from("bids").select("id, auction_id, user_id, bidder_name, amount, created_at").order("created_at", { ascending: false }),
      ]);
      if (a.error) throw a.error;
      return { auctions: (a.data ?? []).map((x) => ({ ...x, start_bid: Number(x.start_bid), increment: Number(x.increment) })) as DbAuction[],
        bids: (b.data ?? []).map((x) => ({ ...x, amount: Number(x.amount) })) as DbBid[] };
    },
  });
  // Live updates arrive via the single <BidsLiveProvider /> which invalidates this cache.
  return q;
}
export const dbStatus = (a: DbAuction, now: number): AuctionStatus => now < Date.parse(a.starts_at) ? "upcoming" : now >= Date.parse(a.ends_at) ? "closed" : "live";
export function useReserveMet(id: string) {
  return useQuery({ queryKey: ["reserve", id], queryFn: async () => !!(await supabase.rpc("auction_reserve_met", { _auction_id: id })).data });
}
/** Maps database rejection codes to a reason the bidder can understand. */
export function bidRejection(message: string): { code: string; min?: number } {
  const m = message.match(/(AUCTION_NOT_FOUND|AUCTION_NOT_STARTED|AUCTION_ENDED|BID_TOO_HIGH|BID_TOO_LOW)(?::([\d.]+))?/);
  if (!m) return { code: "failed" };
  return m[2] ? { code: m[1]!, min: Number(m[2]) } : { code: m[1]! };
}

type RT = { channel: (name: string) => { on: (...a: never[]) => unknown; subscribe: () => unknown }; removeChannel: (c: never) => unknown };
/** Opens ONE bids channel: handlers are attached before subscribe(); returns cleanup that removes it. */
export function subscribeBidsLive(client: RT, onBid: () => void) {
  const ch = (client.channel(`bids-live-${crypto.randomUUID()}`) as unknown as { on: (e: string, f: object, cb: () => void) => { subscribe: () => unknown } })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "bids" }, onBid);
  const sub = ch.subscribe();
  return () => { client.removeChannel(sub as never); };
}
