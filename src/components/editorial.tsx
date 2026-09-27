import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Eye, Heart } from "lucide-react";
import type { Artwork } from "@/lib/data";
import { fmt, minPrice } from "@/lib/data";
import { actions, useStore } from "@/lib/store";
import { useLocale } from "@/lib/i18n";
import { dbStatus, useDbAuctions, useNow } from "@/lib/auctions";

/** Bilingual inline copy helper. */
export function useL() {
  const { locale } = useLocale();
  return (en: string, ar: string) => (locale === "ar" ? ar : en);
}

/** Fades content up once it scrolls into view (respects reduced motion via CSS). */
export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { rootMargin: "0px 0px -10% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} style={{ transitionDelay: `${delay}ms` }} className={`reveal ${on ? "reveal-in" : ""} ${className}`}>{children}</div>;
}

export function SectionHead({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-3 text-xs uppercase tracking-[0.3em] text-primary">{eyebrow}</p>}
        <h2 className="font-display text-4xl leading-tight md:text-5xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function LiveBadge({ label }: { label: string }) {
  return <span className="inline-flex items-center gap-2 text-xs font-medium text-live"><span className="live-dot" aria-hidden />{label}</span>;
}

/** Live-auction lookup for a listing, read from the shared cache. */
export function useLiveAuction(listingId: string) {
  const q = useDbAuctions();
  const now = useNow(1000);
  const auc = q.data?.auctions.find((x) => x.listing_id === listingId);
  if (!auc || now === 0 || dbStatus(auc, now) !== "live") return null;
  const bids = (q.data?.bids ?? []).filter((b) => b.auction_id === auc.id);
  const top = bids.reduce((m, b) => Math.max(m, b.amount), 0);
  return { auction: auc, current: top || auc.start_bid, count: bids.length, left: Date.parse(auc.ends_at) - now };
}

export function Countdown({ ms, className = "" }: { ms: number; className?: string }) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const parts = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0"));
  return <span dir="ltr" className={`font-display tabular-nums ${className}`} aria-label={`${parts[0]}h ${parts[1]}m ${parts[2]}s`}>{parts.join(" : ")}</span>;
}

/** Gallery-label artwork tile: almost no container, metadata sits below like a wall label. */
export function ArtTile({ a, ratio = "aspect-[4/5]", onQuick, size = "md" }: { a: Artwork; ratio?: string; onQuick?: (a: Artwork) => void; size?: "md" | "lg" }) {
  const { pick } = useLocale();
  const L = useL();
  const { favorites } = useStore();
  const fav = favorites.includes(a.id);
  const live = useLiveAuction(a.id);
  const badge = live ? L("Auction", "مزاد") : a.variants.some((v) => v.kind === "original") ? L("Original", "أصلية") : a.variants.some((v) => v.kind === "print") ? L("Limited edition", "نسخة محدودة") : null;
  return (
    <article className="group relative">
      <Link to="/artwork/$id" params={{ id: a.id }} className="block overflow-hidden bg-muted" aria-label={pick(a, "title")}>
        <img src={a.image} alt={pick(a, "title")} loading="lazy" className={`${ratio} w-full object-cover transition duration-700 ease-editorial group-hover:scale-[1.03]`} />
      </Link>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-end gap-2 p-3 opacity-0 transition duration-300 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <button type="button" onClick={() => actions.toggleFavorite(a.id)} aria-label={fav ? L("Remove from favorites", "إزالة من المفضلة") : L("Save to favorites", "حفظ في المفضلة")} className="rounded-full bg-surface/95 p-2 shadow-float">
          <Heart className={`h-4 w-4 ${fav ? "fill-primary text-primary" : ""}`} />
        </button>
        {onQuick && (
          <button type="button" onClick={() => onQuick(a)} className="inline-flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-2 text-xs shadow-float">
            <Eye className="h-3.5 w-3.5" aria-hidden />{L("Quick view", "عرض سريع")}
          </button>
        )}
      </div>
      <div className="mt-4 flex items-start justify-between gap-4 transition duration-500 ease-editorial group-hover:-translate-y-0.5">
        <div className="min-w-0">
          <p className={`font-display leading-snug ${size === "lg" ? "text-2xl" : "text-lg"}`}>{pick(a, "title")}</p>
          <p className="text-sm">{pick(a, "artist")}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{pick(a, "medium").split(",")[0]} • {a.year}</p>
        </div>
        <div className="shrink-0 text-end">
          {live ? (<><p className="text-sm text-primary">{fmt(live.current)}</p><LiveBadge label={L("Live", "مباشر")} /></>) : <p className="text-sm">{fmt(minPrice(a))}</p>}
          {badge && !live && <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{badge}</p>}
        </div>
      </div>
    </article>
  );
}
