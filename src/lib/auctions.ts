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
