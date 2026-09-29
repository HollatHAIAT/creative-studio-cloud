import { useState } from "react";
import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { fmt, toArtwork, seedListings } from "@/lib/data";
import { useLocale } from "@/lib/i18n";
import { countdown, dbStatus, useDbAuctions, useNow } from "@/lib/auctions";

export const Route = createFileRoute("/auctions")({
  head: () => ({
    meta: [
      { title: "Live art auctions — Arwiqa أروقة" },
      { name: "description", content: "Bid live on original artworks with countdowns, reserve prices and full bid history." },
      { property: "og:title", content: "Live art auctions — Arwiqa أروقة" },
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
  const q = useDbAuctions();
  const now = useNow();
  const order = { live: 0, upcoming: 1, closed: 2 };
  const [tab, setTab] = useState<"all" | "live" | "upcoming" | "closed">("all");
  const { locale } = useLocale(); const ar = locale === "ar";
  const all0 = (q.data?.auctions ?? []).map((a) => ({ a, art: toArtwork(seedListings.find((l) => l.id === a.listing_id)!) })).filter((x) => x.art)
    .sort((x, y) => (now ? order[dbStatus(x.a, now)] - order[dbStatus(y.a, now)] || Date.parse(x.a.starts_at) - Date.parse(y.a.starts_at) : 0));
  const count = (k: string) => all0.filter((x) => now && dbStatus(x.a, now) === k).length;
  const list = tab === "all" || !now ? all0 : all0.filter((x) => dbStatus(x.a, now) === tab);
  const tabs = [["all", ar ? "الكل" : "All", all0.length], ["live", ar ? "مباشر الآن" : "Live now", count("live")], ["upcoming", ar ? "قادمة" : "Upcoming", count("upcoming")], ["closed", ar ? "منتهية" : "Ended", count("closed")]] as const;
  return (
    <SiteShell>
      <PageTitle eyebrow={t("auc.eyebrow")} title={t("auc.title")} sub={t("auc.sub")} />
      <div role="tablist" aria-label={ar ? "تصفية المزادات" : "Filter auctions"} className="mx-auto mb-6 flex max-w-7xl flex-wrap gap-2 px-6">
        {tabs.map(([k, label, n]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-full border px-4 py-1.5 text-sm ${tab === k ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{label} <span className="opacity-70">{num(n)}</span></button>)}
      </div>
      {list.length === 0 && <p className="mx-auto max-w-7xl px-6 text-sm text-muted-foreground">{ar ? "لا مزادات في هذا القسم الآن." : "No auctions in this section right now."}</p>}
      <div className="mx-auto grid max-w-7xl gap-8 px-6 md:grid-cols-2 lg:grid-cols-3">
        {list.map(({ a, art }) => {
          const st = now ? dbStatus(a, now) : "live";
          const all = (q.data?.bids ?? []).filter((b) => b.auction_id === a.id);
          const top = all.reduce<(typeof all)[number] | null>((m, b) => (!m || b.amount > m.amount ? b : m), null);
          const tm = { start: Date.parse(a.starts_at), end: Date.parse(a.ends_at) };
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
                  <div><p className="text-xs text-muted-foreground">{top ? t("auc.current") : t("auc.start")}</p><p className="font-display text-2xl">{fmt(top?.amount ?? a.start_bid)}</p></div>
                  <div className="text-end text-sm">
                    <p className="text-xs text-muted-foreground">{st === "upcoming" ? t("auc.opens") : st === "live" ? t("auc.endsIn") : t("auc.ended")}</p>
                    <p className="font-mono" dir="ltr">{now ? (st === "upcoming" ? countdown(tm.start - now) : st === "live" ? countdown(tm.end - now) : "—") : "…"}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{num(all.length)} {t("auc.bids")}{st === "upcoming" && ` · ${new Date(tm.start).toLocaleString(ar ? "ar-SA" : "en-GB", { dateStyle: "medium", timeStyle: "short" })}`}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </SiteShell>
  );
}
