import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SiteShell } from "@/components/SiteShell";
import { auctions, fmt, seedListings, toArtwork } from "@/lib/data";
import { useLocale, type Key } from "@/lib/i18n";
import { bidRejection, countdown, dbStatus, useDbAuctions, useNow, useReserveMet } from "@/lib/auctions";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/auctions/$id")({
  loader: ({ params }) => {
    const a = auctions.find((x) => x.id === params.id);
    if (!a) throw notFound();
    return { id: a.id, art: toArtwork(seedListings.find((l) => l.id === a.listingId)!) };
  },
  head: ({ loaderData }) => loaderData ? { meta: [
    { title: `Auction: ${loaderData.art.title} — Arwiqa أروقة` },
    { name: "description", content: `Bid live on ${loaderData.art.title} by ${loaderData.art.artist}.` },
    { property: "og:title", content: `Auction: ${loaderData.art.title}` },
    { property: "og:description", content: `Live bidding on ${loaderData.art.title} by ${loaderData.art.artist}.` },
    { property: "og:type", content: "product" }, { name: "twitter:card", content: "summary_large_image" },
  ] } : { meta: [{ title: "Auction not found" }, { name: "robots", content: "noindex" }] },
  notFoundComponent: () => <SiteShell><p className="p-16 text-center">Auction not found.</p></SiteShell>,
  errorComponent: () => <SiteShell><p className="p-16 text-center">This auction couldn't load. Please refresh.</p></SiteShell>,
  component: AuctionPage,
});

function AuctionPage() {
  const { id, art } = Route.useLoaderData();
  const { t, pick, locale } = useLocale();
  const { user } = useSession();
  const q = useDbAuctions();
  const reserve = useReserveMet(id);
  const now = useNow();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<string | null>(null);
  const a = q.data?.auctions.find((x) => x.id === id);
  const bids = (q.data?.bids ?? []).filter((b) => b.auction_id === id);
  const top = bids.reduce<(typeof bids)[number] | null>((m, b) => (!m || b.amount > m.amount ? b : m), null);
  const min = a ? (top ? top.amount + a.increment : a.start_bid) : 0;
  const st = a && now ? dbStatus(a, now) : "live";
  const mineTop = !!user && top?.user_id === user.id;
  const prevMine = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (prevMine.current === true && !mineTop) toast.warning(t("auc.outbid"));
    prevMine.current = mineTop;
  }, [mineTop, t]);

  const bid = useMutation({
    mutationFn: async (value: number) => {
      const name = (user?.user_metadata?.["display_name"] as string | undefined) || user?.email?.split("@")[0] || "Collector";
      const { error } = await supabase.from("bids").insert({ auction_id: id, user_id: user!.id, bidder_name: name.slice(0, 40), amount: value });
      if (error) throw new Error(error.message);
      return value;
    },
    onSuccess: (v) => { setAmount(""); setReason(null); toast.success(`${t("auc.placed")} · ${fmt(v)}`); },
    onError: (e: Error) => {
      const r = bidRejection(e.message);
      const msg = r.code === "failed" ? t("bid.failed") : `${t(`bid.${r.code}` as Key)}${r.min ? ` ${fmt(r.min)}` : ""}`;
      setReason(msg); toast.error(msg);
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["auctions"] }); qc.invalidateQueries({ queryKey: ["reserve", id] }); },
  });
  function place(v: number) {
    if (!user) return;
    if (!(v >= min)) { const msg = `${t("auc.tooLow")} ${fmt(min)}`; setReason(msg); toast.error(msg); return; }
    bid.mutate(v);
  }
  const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? "ar" : "en", { numeric: "auto" });
  const ago = (iso: string) => { const m = Math.round((Date.parse(iso) - now) / 60000); return Math.abs(m) < 60 ? rtf.format(m, "minute") : Math.abs(m) < 2880 ? rtf.format(Math.round(m / 60), "hour") : rtf.format(Math.round(m / 1440), "day"); };
  const tm = a ? { start: Date.parse(a.starts_at), end: Date.parse(a.ends_at) } : { start: 0, end: 0 };

  return (
    <SiteShell>
      <div className="mx-auto grid max-w-7xl gap-12 px-6 pt-12 md:grid-cols-2">
        <div><img src={art.image} alt={pick(art, "title")} className="aspect-[4/5] w-full rounded-sm object-cover" /></div>
        <div>
          <p className="text-xs uppercase tracking-widest text-primary">{t(st === "live" ? "auc.live" : st === "upcoming" ? "auc.upcoming" : "auc.closed")}</p>
          <h1 className="mt-2 font-display text-5xl">{pick(art, "title")}</h1>
          <Link to="/artwork/$id" params={{ id: art.id }} className="mt-2 inline-block underline">{pick(art, "artist")}</Link>

          <div className="mt-8 grid grid-cols-2 gap-4 rounded-sm border border-border bg-card p-6">
            <div><p className="text-xs text-muted-foreground">{top ? t("auc.current") : t("auc.start")}</p><p className="font-display text-4xl">{a ? fmt(top?.amount ?? a.start_bid) : "…"}</p></div>
            <div className="text-end">
              <p className="text-xs text-muted-foreground">{st === "upcoming" ? t("auc.opens") : st === "live" ? t("auc.endsIn") : t("auc.ended")}</p>
              <p className="font-mono text-3xl" dir="ltr">{a && now ? (st === "upcoming" ? countdown(tm.start - now) : st === "live" ? countdown(tm.end - now) : "00:00:00") : "…"}</p>
            </div>
            <p className={`col-span-2 rounded-full px-3 py-1 text-center text-sm ${reserve.data ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{reserve.data ? t("auc.reserveMet") : t("auc.reserveNot")}</p>
            {st === "live" && top && user && <p className="col-span-2 text-center text-sm">{mineTop ? t("auc.winning") : bids.some((b) => b.user_id === user.id) ? t("auc.outbid") : ""}</p>}
            {st === "closed" && <p className="col-span-2 text-center font-display text-xl">{top && reserve.data ? `${t("auc.won")}: ${fmt(top.amount)} · ${mineTop ? t("auc.you") : top.bidder_name}` : t("auc.noSale")}</p>}
          </div>

          {st === "live" && a && (user ? (
            <form onSubmit={(e) => { e.preventDefault(); place(Number(amount || min)); }} className="mt-6">
              <div className="flex flex-wrap gap-2">
                {[min, min + a.increment * 2, min + a.increment * 5].map((v) => <button type="button" disabled={bid.isPending} key={v} onClick={() => place(v)} className="rounded-full border border-border px-4 py-2 text-sm">{fmt(v)}</button>)}
              </div>
              <div className="mt-3 flex gap-2">
                <input type="number" min={min} step={a.increment} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`${t("auc.min")} ${fmt(min)}`} aria-label={t("auc.yourBid")} className="flex-1 rounded-full border border-border bg-background px-4 py-3" />
                <button disabled={bid.isPending} className="rounded-full bg-primary px-6 py-3 text-primary-foreground disabled:opacity-50">{t("auc.placeBid")}</button>
              </div>
              {reason && <p role="alert" className="mt-2 text-sm text-destructive">{reason}</p>}
              <p className="mt-2 text-xs text-muted-foreground">{t("auc.increment")}: {fmt(a.increment)}</p>
            </form>
          ) : <Link to="/auth" search={{ next: `/auctions/${id}` }} className="mt-6 inline-block rounded-full bg-primary px-6 py-3 text-primary-foreground">{t("bid.signin")}</Link>)}

          <h2 className="mt-10 font-display text-2xl">{t("auc.history")}</h2>
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {bids.map((b) => (
              <li key={b.id} className={`flex justify-between py-3 text-sm ${user && b.user_id === user.id ? "text-primary" : ""}`}>
                <span>{user && b.user_id === user.id ? t("auc.you") : b.bidder_name}</span>
                <span className="text-muted-foreground">{now ? ago(b.created_at) : ""}</span>
                <span className="font-medium">{fmt(b.amount)}</span>
              </li>
            ))}
            {bids.length === 0 && <li className="py-3 text-sm text-muted-foreground">{t("auc.none")}</li>}
          </ul>
        </div>
      </div>
    </SiteShell>
  );
}
