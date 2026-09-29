import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Brush, ChevronDown, Heart, Languages, Search } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DiscoverySearch } from "@/components/DiscoverySearch";
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
  { to: "/explore", en: "Explore", ar: "استكشف" },
  { to: "/explore", en: "Artworks", ar: "الأعمال", search: { cat: "Painting" } },
  { to: "/artists", en: "Artists", ar: "الفنانون" },
  { to: "/exhibitions", en: "Exhibitions", ar: "المعارض" },
  { to: "/auctions", en: "Auctions", ar: "المزادات" },
] as const;
const more = [
  { to: "/collections/saudi-banks", en: "Collections", ar: "المجموعات" },
  { to: "/assets", en: "Images & digital assets", ar: "الصور والأصول الرقمية" },
  { to: "/supplies", en: "Saudi art supplies", ar: "مستلزمات الفن السعودية" },
  { to: "/heritage", en: "Explore Saudi & the Gulf", ar: "استكشف السعودية والخليج" },
  { to: "/collections/saudi-banks", en: "Saudi banks", ar: "البنوك السعودية" },
  { to: "/artists", en: "Galleries", ar: "صالات العرض" },
  { to: "/advisor", en: "Art advisor (AI)", ar: "مستشار الفن الذكي" },
] as const;

export function SiteShell({ children }: { children: ReactNode }) {
  useDocumentDirection();
  const { favorites } = useStore();
  const { t, toggle, locale } = useLocale();
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:bg-surface focus:px-4 focus:py-2">{L("Skip to content", "تخطَّ إلى المحتوى")}</a>
      <header className={`sticky top-0 z-40 transition-all duration-300 ease-editorial ${scrolled ? "bg-background/85 backdrop-blur-md" : "bg-background"}`}>
        <div aria-hidden className="sadu-thin" />
        <div className={`mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 transition-all duration-300 ${scrolled ? "py-2.5" : "py-4"}`}>
          <Link to="/" onKeyDown={(e) => { if (e.key !== "Enter" && e.key !== " ") return; if (e.key === " ") e.preventDefault(); replayLogo(e.currentTarget.querySelector<HTMLElement>(".logo-paint")); }} className="flex shrink-0 items-center gap-2 font-display text-2xl tracking-tight" aria-label="Arwiqa أروقة">
            <span onPointerEnter={(e) => replayLogo(e.currentTarget)} className={`logo-paint relative inline-block transition-all duration-300 ${scrolled ? "h-7 w-7" : "h-9 w-9"}`}><img src={logoMark} alt="" width={36} height={36} className="logo-paint-img h-full w-full object-contain" /><span aria-hidden className="logo-paint-brush" /></span><span>{t("brand.name")}</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm lg:flex" aria-label={L("Main", "الرئيسية")}>
            {nav.map((n) => (
              <Link key={n.en} to={n.to} search={("search" in n ? n.search : {}) as never} className="text-muted-foreground transition hover:text-foreground" activeOptions={{ includeSearch: true }} activeProps={{ className: "text-foreground" }}>{L(n.en, n.ar)}</Link>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-1 text-muted-foreground outline-none hover:text-foreground">{L("More", "المزيد")}<ChevronDown className="h-3.5 w-3.5" aria-hidden /></DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-56 bg-surface">
                {more.map((m) => <DropdownMenuItem key={m.en} asChild><Link to={m.to}>{L(m.en, m.ar)}</Link></DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
          <div className="flex items-center gap-4 text-sm">
            <button type="button" onClick={() => setSearchOpen(true)} aria-label={L("Search", "بحث")} className="hover:text-primary"><Search className="h-5 w-5" /></button>
            <button onClick={toggle} className={`items-center gap-1 rounded-full border border-border px-3 py-1.5 ${scrolled ? "hidden md:flex" : "flex"}`} aria-label="Switch language"><Languages className="h-4 w-4" />{t("lang.switch")}</button>
            <Link to="/favorites" className="relative" aria-label={t("nav.favorites")}><Heart className="h-5 w-5" />{favorites.length > 0 && <span className="absolute -end-2 -top-2 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{favorites.length}</span>}</Link>
            <AccountNav />
            <Link to="/sell" className="sell-cta group hidden items-center gap-2 whitespace-nowrap rounded-full py-1.5 ps-1.5 pe-4 text-sm font-medium text-primary-foreground sm:inline-flex">
              <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-primary-foreground/15 transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110">
                <Brush className="h-3.5 w-3.5" />
              </span>
              {L("Sell your art", "بع أعمالك")}
            </Link>
          </div>
        </div>
        <nav className={`no-scrollbar flex gap-5 overflow-x-auto px-6 text-sm transition-all lg:hidden ${scrolled ? "pb-2" : "pb-3"}`} aria-label={L("Main", "الرئيسية")}>
          {[...nav, ...more.slice(2)].map((n) => <Link key={n.en} to={n.to} search={("search" in n ? n.search : {}) as never} className="shrink-0 text-muted-foreground" activeProps={{ className: "text-foreground" }}>{L(n.en, n.ar)}</Link>)}
        </nav>
      </header>
      <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
        <SheetContent side="top" className="bg-background pb-10">
          <SheetTitle className="sr-only">{L("Search", "بحث")}</SheetTitle>
          <div className="mx-auto max-w-4xl pt-8"><DiscoverySearch autoFocus onNavigate={() => setSearchOpen(false)} /></div>
        </SheetContent>
      </Sheet>
      <OverdueNotifier />
      <main id="main">{children}</main>
      <footer className="najdi-top mt-32 bg-clay text-primary-foreground">
        <div className="mx-auto max-w-7xl px-6 pt-12 text-center">
          <p lang="ar" dir="rtl" className="font-calligraphy text-4xl text-gold md:text-5xl">فنٌّ عالمي بأيادٍ سعودية</p>
          <p className="mt-2 text-sm opacity-80">{L("Global art, crafted by Saudi hands", "منصة فنية عالمية من قلب المملكة")}</p>
          <div aria-hidden className="gold-rule mx-auto mt-6 max-w-md" />
        </div>
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 text-sm opacity-90 md:grid-cols-4 [&_.text-foreground]:text-gold">
          <div><span className="inline-block rounded-full bg-background p-2"><img src={logoFull} alt="Arwiqa أروقة" width={80} height={80} loading="lazy" className="h-20 w-20 object-contain" /></span><p className="mt-2">{t("brand.tagline")}</p></div>
          <div><p className="text-foreground">{t("footer.buy")}</p><p>{t("footer.originals")}</p><p>{t("footer.prints")}</p><p>{t("footer.licenses")}</p></div>
          <div><p className="text-foreground">{t("footer.sell")}</p><p>{t("footer.storefronts")}</p><p>{t("nav.auctions")}</p><p>{t("nav.exhibitions")}</p></div>
          <div><p className="text-foreground">{t("footer.company")}</p><p>{t("footer.about")}</p><p>{t("footer.licensing")}</p><p>{t("footer.support")}</p></div>
        </div>
        <div aria-hidden className="sadu-band" />
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
      <div className="arch-soft relative overflow-hidden bg-muted ring-1 ring-gold/40 ring-offset-4 ring-offset-background">
        <img src={a.image} alt={pick(a, "title")} loading="lazy" className="aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-105" />
        <span className="absolute bottom-3 start-3 rounded-full bg-background/90 px-3 py-1 text-xs">{t(`cat.${a.category}` as Key)}</span>
        <FavButton id={a.id} className="absolute bottom-3 end-3" />
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
    <div className="banner-live sadu-bg relative isolate overflow-hidden border-b border-border">
      <span aria-hidden className="banner-glow banner-glow-a" />
      <span aria-hidden className="banner-glow banner-glow-b" />
      <span aria-hidden className="banner-brush" />
      <span aria-hidden className="banner-diamond end-[12%] top-10 h-10 w-10" />
      <span aria-hidden className="banner-diamond banner-diamond-slow end-[24%] bottom-8 h-5 w-5" />
      <span aria-hidden className="banner-diamond banner-diamond-fast end-[6%] bottom-14 h-3 w-3" />
      <div className="relative mx-auto max-w-7xl px-6 pb-12 pt-16">
        <p className="banner-rise flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-primary">
          <span aria-hidden className="banner-spin inline-block h-2.5 w-2.5 rotate-45 bg-gold" />{eyebrow}
          <span aria-hidden className="h-px w-12 bg-gradient-to-r from-gold to-transparent rtl:bg-gradient-to-l" />
        </p>
        <h1 className="banner-rise banner-shimmer mt-3 font-display text-5xl md:text-7xl [animation-delay:120ms]">{title}</h1>
        {sub && <p className="banner-rise mt-4 max-w-2xl text-muted-foreground [animation-delay:240ms]">{sub}</p>}
        <div aria-hidden className="banner-weave mt-8 w-56" />
      </div>
    </div>
  );
}

/** Restart the brush-paint logo drawing; skipped when the visitor prefers reduced motion. */
function replayLogo(el: HTMLElement | null) {
  if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  el.classList.remove("is-replay"); void el.offsetWidth; el.classList.add("is-replay");
}
