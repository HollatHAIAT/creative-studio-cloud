import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { auctions, fmt, toArtwork, seedListings } from "@/lib/data";
import { useStore } from "@/lib/store";
import { useLocale } from "@/lib/i18n";
import { allBids, countdown, statusOf, times, topBid, useNow } from "@/lib/auctions";

export const Route = createFileRoute("/auctions")({
  head: () => ({
    meta: [
      { title: "Live art auctions — creativestudio" },
      { name: "description", content: "Bid live on original artworks with countdowns, reserve prices and full bid history." },
      { property: "og:title", content: "Live art auctions — creativestudio" },
      { property: "og:description", content: "Bid on originals from artists worldwide." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuctionsLayout,
});

function AuctionsLayout() {
  const match = useMatchRoute();
  if (match({ to: "/auctions/$id" })) return <Outlet />;
  return <Auctions />;
}

function Auctions() {
  const { t, pick, num } = useLocale();
  const { bids } = useStore();
  const now = useNow();
  const order = { live: 0, upcoming: 1, closed: 2 };
  const list = auctions.map((a) => ({ a, art: toArtwork(seedListings.find((l) => l.id === a.listingId)!) }))
    .sort((x, y) => (now ? order[statusOf(x.a, now)] - order[statusOf(y.a, now)] : 0));
  return (
    <SiteShell>
      <PageTitle eyebrow={t("auc.eyebrow")} title={t("auc.title")} sub={t("auc.sub")} />
      <div className="mx-auto grid max-w-7xl gap-8 px-6 md:grid-cols-2 lg:grid-cols-3">
        {list.map(({ a, art }) => {
          const st = now ? statusOf(a, now) : "live";
          const all = now ? allBids(a, bids[a.id], now) : [];
          const top = topBid(all);
          const tm = now ? times(a, now) : { start: 0, end: 0 };
          return (
            <Link key={a.id} to="/auctions/$id" params={{ id: a.id }} className="group block rounded-sm border border-border bg-card hover:border-primary">
              <div className="relative">
                <img src={art.image} alt={pick(art, "title")} loading="lazy" className="aspect-[4/3] w-full rounded-t-sm object-cover" />
                <span className={`absolute start-3 top-3 rounded-full px-3 py-1 text-xs ${st === "live" ? "bg-primary text-primary-foreground" : "bg-background/90"}`}>{t(st === "live" ? "auc.live" : st === "upcoming" ? "auc.upcoming" : "auc.closed")}</span>
              </div>
              <div className="p-5">
                <p className="font-display text-2xl">{pick(art, "title")}</p>
                <p className="text-sm text-muted-foreground">{pick(art, "artist")}</p>
                <div className="mt-4 flex items-end justify-between">
                  <div><p className="text-xs text-muted-foreground">{top ? t("auc.current") : t("auc.start")}</p><p className="font-display text-2xl">{fmt(top?.amount ?? a.startBid)}</p></div>
                  <div className="text-end text-sm">
                    <p className="text-xs text-muted-foreground">{st === "upcoming" ? t("auc.opens") : st === "live" ? t("auc.endsIn") : t("auc.ended")}</p>
                    <p className="font-mono" dir="ltr">{now ? (st === "upcoming" ? countdown(tm.start - now) : st === "live" ? countdown(tm.end - now) : "—") : "…"}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{num(all.length)} {t("auc.bids")} · {top && top.amount >= a.reserve ? t("auc.reserveMet") : t("auc.reserveNot")}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </SiteShell>
  );
}
