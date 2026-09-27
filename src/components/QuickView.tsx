import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import type { Artwork } from "@/lib/data";
import { fmt, minPrice } from "@/lib/data";
import { actions, useStore } from "@/lib/store";
import { useLocale } from "@/lib/i18n";
import { Countdown, LiveBadge, useL, useLiveAuction } from "@/components/editorial";

/** Side drawer preview of an artwork, so shoppers can browse without leaving the page. */
export function QuickView({ a, onClose }: { a: Artwork | null; onClose: () => void }) {
  const { dir } = useLocale();
  return (
    <Sheet open={!!a} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full overflow-y-auto bg-background sm:max-w-lg">
        {a && <Body a={a} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function Body({ a, onClose }: { a: Artwork; onClose: () => void }) {
  const { pick } = useLocale();
  const L = useL();
  const { favorites } = useStore();
  const fav = favorites.includes(a.id);
  const live = useLiveAuction(a.id);
  const original = a.variants.find((v) => v.kind === "original");
  const cheapest = a.variants.reduce((m, v) => (v.price < m.price ? v : m), a.variants[0]);
  const kinds = [...new Set(a.variants.map((v) => v.kind))];
  const kindLabel = { original: L("Original", "أصلية"), print: L("Print", "مطبوعة"), license: L("Digital license", "ترخيص رقمي") };
  return (
    <div className="space-y-6 pt-6">
      <img src={a.image} alt={pick(a, "title")} className="max-h-[52vh] w-full bg-muted object-contain" />
      <div>
        <SheetTitle className="font-display text-3xl font-normal">{pick(a, "title")}</SheetTitle>
        <SheetDescription className="mt-1 text-base text-foreground">{pick(a, "artist")}</SheetDescription>
        <p className="mt-2 text-sm text-muted-foreground">{pick(a, "medium")} • {a.year}</p>
        <div className="mt-3 flex flex-wrap gap-2">{kinds.map((k) => <span key={k} className="rounded-full border border-border px-3 py-1 text-xs">{kindLabel[k]}</span>)}</div>
      </div>
      {live ? (
        <div className="grid grid-cols-3 gap-4 border-y border-border py-5">
          <div><p className="text-xs text-muted-foreground">{L("Current bid", "المزايدة الحالية")}</p><p className="font-display text-2xl">{fmt(live.current)}</p></div>
          <div><p className="text-xs text-muted-foreground">{L("Bids", "المزايدات")}</p><p className="font-display text-2xl">{live.count}</p></div>
          <div><p className="text-xs text-muted-foreground">{L("Ends in", "ينتهي خلال")}</p><Countdown ms={live.left} className="text-xl" /></div>
          <div className="col-span-3"><LiveBadge label={L("Live now", "مباشر الآن")} /></div>
        </div>
      ) : (
        <div className="border-y border-border py-5">
          <p className="text-xs text-muted-foreground">{L("From", "ابتداءً من")}</p>
          <p className="font-display text-3xl">{fmt(minPrice(a))}</p>
        </div>
      )}
      <div className="flex flex-col gap-3">
        {live ? (
          <Link to="/auctions/$id" params={{ id: live.auction.id }} onClick={onClose} className="rounded-full bg-primary px-6 py-3 text-center text-primary-foreground hover:bg-primary-hover">{L("Place a bid", "قدّم مزايدة")}</Link>
        ) : (
          <button type="button" onClick={() => { actions.addToCart({ kind: "artwork", listingId: a.id, variantId: (original ?? cheapest).id, qty: 1 } as never); toast.success(L("Added to basket", "أضيف إلى السلة")); }}
            className="rounded-full bg-primary px-6 py-3 text-primary-foreground hover:bg-primary-hover">{L("Add to basket", "أضف إلى السلة")}</button>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={() => actions.toggleFavorite(a.id)} aria-pressed={fav} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-border px-4 py-3">
            <Heart className={`h-4 w-4 ${fav ? "fill-primary text-primary" : ""}`} />{fav ? L("Saved", "محفوظ") : L("Favorite", "المفضلة")}
          </button>
          <Link to="/artwork/$id" params={{ id: a.id }} onClick={onClose} className="flex-1 rounded-full border border-foreground px-4 py-3 text-center">{L("View full artwork", "عرض العمل كاملاً")}</Link>
        </div>
      </div>
    </div>
  );
}
