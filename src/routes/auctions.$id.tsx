import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { SiteShell } from "@/components/SiteShell";
import { auctions, fmt, seedListings, toArtwork } from "@/lib/data";
import { actions, useStore } from "@/lib/store";
import { useLocale } from "@/lib/i18n";
import { allBids, countdown, minNext, statusOf, times, topBid, useNow } from "@/lib/auctions";

export const Route = createFileRoute("/auctions/$id")({
  loader: ({ params }) => {
    const a = auctions.find((x) => x.id === params.id);
    if (!a) throw notFound();
    return { a, art: toArtwork(seedListings.find((l) => l.id === a.listingId)!) };
  },
  head: ({ loaderData }) => loaderData ? { meta: [
    { title: `Auction: ${loaderData.art.title} — creativestudio` },
    { name: "description", content: `Bid live on ${loaderData.art.title} by ${loaderData.art.artist}. Starting bid ${fmt(loaderData.a.startBid)}.` },
    { property: "og:title", content: `Auction: ${loaderData.art.title}` },
    { property: "og:description", content: `Live bidding on ${loaderData.art.title} by ${loaderData.art.artist}.` },
    { property: "og:type", content: "product" }, { name: "twitter:card", content: "summary_large_image" },
  ] } : { meta: [{ title: "Auction not found" }, { name: "robots", content: "noindex" }] },
  notFoundComponent: () => <SiteShell><p className="p-16 text-center">Auction not found.</p></SiteShell>,
  component: AuctionPage,
});

const RIVALS = ["Collector 1142", "Gallery Nour", "Sara K.", "Faisal A.", "Hana M."];

function AuctionPage() {
  const { a, art } = Route.useLoaderData();
  const { t, pick, locale } = useLocale();
  const { bids } = useStore();
  const now = useNow();
  const all = now ? allBids(a, bids[a.id], now) : [];
  const top = topBid(all);
  const min = minNext(a, all);
  const st = now ? statusOf(a, now) : "live";
  const tm = now ? times(a, now) : { start: 0, end: 0 };
  const [amount, setAmount] = useState("");
  const mineTop = top?.mine;
  const prevMine = useRef<boolean | undefined>(undefined);

  // Simulated live competition: occasionally a rival outbids you while the auction is live.
  useEffect(() => {
    if (st !== "live") return;
    const i = setInterval(() => {
      const cur = allBids(a, actions.get().bids[a.id], Date.now());
      const tp = topBid(cur);
      if (!tp?.mine || Math.random() > 0.35 || tp.amount >= a.reserve * 1.4) return;
      actions.addBid(a.id, { id: crypto.randomUUID(), bidder: RIVALS[Math.floor(Math.random() * RIVALS.length)], amount: tp.amount + a.increment * (1 + Math.floor(Math.random() * 3)), at: Date.now() });
    }, 12000);
    return () => clearInterval(i);
  }, [a, st]);

  useEffect(() => {
    if (prevMine.current === true && mineTop === false) toast.warning(t("auc.outbid"));
    prevMine.current = mineTop;
  }, [mineTop, t]);

  function place(value: number) {
    if (st !== "live") return;
    if (!(value >= min)) { toast.error(`${t("auc.tooLow")} ${fmt(min)}`); return; }
    actions.addBid(a.id, { id: crypto.randomUUID(), bidder: "You", amount: value, at: Date.now(), mine: true });
    setAmount("");
    toast.success(`${t("auc.placed")} · ${fmt(value)}`);
  }
  const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? "ar" : "en", { numeric: "auto" });
  const ago = (at: number) => { const m = Math.round((at - now) / 60000); return Math.abs(m) < 60 ? rtf.format(m, "minute") : rtf.format(Math.round(m / 60), "hour"); };

  return (
    <SiteShell>
      <div className="mx-auto grid max-w-7xl gap-12 px-6 pt-12 md:grid-cols-2">
        <div>
          <img src={art.image} alt={pick(art, "title")} className="aspect-[4/5] w-full rounded-sm object-cover" />
          <p className="mt-4 text-sm text-muted-foreground">{t("auc.demo")}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-primary">{t(st === "live" ? "auc.live" : st === "upcoming" ? "auc.upcoming" : "auc.closed")}</p>
          <h1 className="mt-2 font-display text-5xl">{pick(art, "title")}</h1>
          <Link to="/artwork/$id" params={{ id: art.id }} className="mt-2 inline-block underline">{pick(art, "artist")}</Link>

          <div className="mt-8 grid grid-cols-2 gap-4 rounded-sm border border-border bg-card p-6">
            <div><p className="text-xs text-muted-foreground">{top ? t("auc.current") : t("auc.start")}</p><p className="font-display text-4xl">{fmt(top?.amount ?? a.startBid)}</p></div>
            <div className="text-end">
              <p className="text-xs text-muted-foreground">{st === "upcoming" ? t("auc.opens") : st === "live" ? t("auc.endsIn") : t("auc.ended")}</p>
              <p className="font-mono text-3xl" dir="ltr">{now ? (st === "upcoming" ? countdown(tm.start - now) : st === "live" ? countdown(tm.end - now) : "00:00:00") : "…"}</p>
            </div>
            <p className={`col-span-2 rounded-full px-3 py-1 text-center text-sm ${top && top.amount >= a.reserve ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{top && top.amount >= a.reserve ? t("auc.reserveMet") : t("auc.reserveNot")}</p>
            {st === "live" && top && <p className="col-span-2 text-center text-sm">{mineTop ? t("auc.winning") : all.some((b) => b.mine) ? t("auc.outbid") : ""}</p>}
            {st === "closed" && <p className="col-span-2 text-center font-display text-xl">{top && top.amount >= a.reserve ? `${t("auc.won")}: ${fmt(top.amount)} · ${top.mine ? t("auc.you") : top.bidder}` : t("auc.noSale")}</p>}
          </div>

          {st === "live" && (
            <form onSubmit={(e) => { e.preventDefault(); place(Number(amount || min)); }} className="mt-6">
              <div className="flex flex-wrap gap-2">
                {[min, min + a.increment * 2, min + a.increment * 5].map((v) => <button type="button" key={v} onClick={() => place(v)} className="rounded-full border border-border px-4 py-2 text-sm">{fmt(v)}</button>)}
              </div>
              <div className="mt-3 flex gap-2">
                <input type="number" min={min} step={a.increment} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`${t("auc.min")} ${fmt(min)}`} aria-label={t("auc.yourBid")} className="flex-1 rounded-full border border-border bg-background px-4 py-3" />
                <button className="rounded-full bg-primary px-6 py-3 text-primary-foreground">{t("auc.placeBid")}</button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t("auc.increment")}: {fmt(a.increment)}</p>
            </form>
          )}

          <h2 className="mt-10 font-display text-2xl">{t("auc.history")}</h2>
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {all.map((b) => (
              <li key={b.id} className={`flex justify-between py-3 text-sm ${b.mine ? "text-primary" : ""}`}>
                <span>{b.mine ? t("auc.you") : b.bidder}</span>
                <span className="text-muted-foreground">{ago(b.at)}</span>
                <span className="font-medium">{fmt(b.amount)}</span>
              </li>
            ))}
            {all.length === 0 && <li className="py-3 text-sm text-muted-foreground">{t("auc.none")}</li>}
          </ul>
        </div>
      </div>
    </SiteShell>
  );
}
