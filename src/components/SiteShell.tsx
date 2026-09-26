import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Heart, Languages } from "lucide-react";
import type { Artwork } from "@/lib/data";
import { fmt, minPrice } from "@/lib/data";
import { actions, useStore } from "@/lib/store";
import { OverdueNotifier } from "@/components/OverdueNotifier";
import { AccountNav } from "@/components/AccountNav";
import { useDocumentDirection, useLocale, type Key } from "@/lib/i18n";
import { dbStatus, useDbAuctions, useNow } from "@/lib/auctions";
import logoMark from "@/assets/arwiqa-mark.png";
import logoFull from "@/assets/arwiqa-logo.png";

const nav = [
  { to: "/explore", k: "nav.explore" },
  { to: "/auctions", k: "nav.auctions" },
  { to: "/exhibitions", k: "nav.exhibitions" },
  { to: "/artists", k: "nav.artists" },
  { to: "/collections/saudi-banks", k: "nav.collections" },
  { to: "/dashboard", k: "nav.dashboard" },
  { to: "/analytics", k: "nav.analytics" },
] as const satisfies readonly { to: string; k: Key }[];

export function SiteShell({ children }: { children: ReactNode }) {
  useDocumentDirection();
  const { favorites } = useStore();
  const { t, toggle } = useLocale();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <Link to="/" className="flex items-center gap-2 font-display text-2xl tracking-tight" aria-label="Arwiqa أروقة"><img src={logoMark} alt="" width={36} height={36} className="h-9 w-9 object-contain" /><span>{t("brand.name")}</span></Link>
          <nav className="hidden gap-6 text-sm lg:flex">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} className="text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground" }}>{t(n.k)}</Link>
            ))}
          </nav>
          <div className="flex items-center gap-4 text-sm">
            <button onClick={toggle} className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5" aria-label="Switch language"><Languages className="h-4 w-4" />{t("lang.switch")}</button>
            <Link to="/favorites" className="flex items-center gap-1" aria-label={t("nav.favorites")}><Heart className="h-5 w-5" />{favorites.length > 0 && <span>{favorites.length}</span>}</Link>
            <AccountNav />
            <Link to="/sell" className="hidden rounded-full bg-primary px-4 py-2 text-primary-foreground hover:opacity-90 sm:inline-block">{t("nav.sell")}</Link>
          </div>
        </div>
        <nav className="flex gap-5 overflow-x-auto px-6 pb-3 text-sm lg:hidden">
          {nav.map((n) => <Link key={n.to} to={n.to} className="shrink-0 text-muted-foreground" activeProps={{ className: "text-foreground" }}>{t(n.k)}</Link>)}
        </nav>
      </header>
      <OverdueNotifier />
      <main>{children}</main>
      <footer className="mt-24 border-t border-border">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 text-sm text-muted-foreground md:grid-cols-4">
          <div><img src={logoFull} alt="Arwiqa أروقة" width={96} height={96} loading="lazy" className="h-24 w-24 object-contain" /><p className="mt-2">{t("brand.tagline")}</p></div>
          <div><p className="text-foreground">{t("footer.buy")}</p><p>{t("footer.originals")}</p><p>{t("footer.prints")}</p><p>{t("footer.licenses")}</p></div>
          <div><p className="text-foreground">{t("footer.sell")}</p><p>{t("footer.storefronts")}</p><p>{t("nav.auctions")}</p><p>{t("nav.exhibitions")}</p></div>
          <div><p className="text-foreground">{t("footer.company")}</p><p>{t("footer.about")}</p><p>{t("footer.licensing")}</p><p>{t("footer.support")}</p></div>
        </div>
      </footer>
    </div>
  );
}

export function FavButton({ id, className = "" }: { id: string; className?: string }) {
  const { favorites } = useStore();
  const { t } = useLocale();
  const on = favorites.includes(id);
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); actions.toggleFavorite(id); }}
      aria-label={on ? t("fav.remove") : t("fav.save")}
      className={`rounded-full bg-background/90 p-2 ${className}`}
    >
      <Heart className={`h-4 w-4 ${on ? "fill-primary text-primary" : ""}`} />
    </button>
  );
}

export function ArtCard({ a }: { a: Artwork }) {
  const { t, pick } = useLocale();
  const q = useDbAuctions();
  const now = useNow(30_000);
  const auc = q.data?.auctions.find((x) => x.listing_id === a.id);
  const live = auc && now > 0 && dbStatus(auc, now) === "live";
  const top = live ? Math.max(0, ...(q.data?.bids ?? []).filter((b) => b.auction_id === auc.id).map((b) => b.amount)) : 0;
  return (
    <Link to="/artwork/$id" params={{ id: a.id }} className="group block">
      <div className="relative overflow-hidden rounded-sm bg-muted">
        <img src={a.image} alt={pick(a, "title")} loading="lazy" className="aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-105" />
        <span className="absolute start-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs">{t(`cat.${a.category}` as Key)}</span>
        <FavButton id={a.id} className="absolute end-3 top-3" />
      </div>
      <div className="mt-3 flex items-start justify-between gap-2">
        <div><p className="font-display text-lg">{pick(a, "title")}</p><p className="text-sm text-muted-foreground">{pick(a, "artist")}</p></div>
        <div className="text-end text-sm">
          {live ? (<><p className="text-primary">{fmt(top || auc.start_bid)}</p><p className="text-muted-foreground">{t("auc.live")}</p></>) : <p>{fmt(minPrice(a))}</p>}
        </div>
      </div>
    </Link>
  );
}

export function PageTitle({ eyebrow, title, sub }: { eyebrow: ReactNode; title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-6 pb-10 pt-16">
      <p className="text-xs uppercase tracking-[0.3em] text-primary">{eyebrow}</p>
      <h1 className="mt-3 font-display text-5xl md:text-6xl">{title}</h1>
      {sub && <p className="mt-4 max-w-2xl text-muted-foreground">{sub}</p>}
    </div>
  );
}
