import { createFileRoute, Link } from "@tanstack/react-router";
import { useLocale } from "@/lib/i18n";
import { SiteShell, ArtCard, PageTitle } from "@/components/SiteShell";
import { useListings, useStore, actions } from "@/lib/store";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { getSellerListingsByIds } from "@/lib/seller-listings.functions";

export const Route = createFileRoute("/favorites")({
  head: () => ({
    meta: [
      { title: "Your favorites — Arwiqa أروقة" },
      { name: "description", content: "Artworks you've saved on Arwiqa." },
      { property: "og:title", content: "Favorites — Arwiqa أروقة" },
      { property: "og:description", content: "Artworks you've saved." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Favorites,
});

function Favorites() {
  const { favorites } = useStore();
  const { t, locale } = useLocale();
  const list = useListings().filter((l) => favorites.includes(l.id));
  const ar = locale === "ar";
  const sellerIds = favorites.filter((id) => /^sl-[a-f0-9]{10}$/.test(id)).slice(0, 60);
  const wish = useQuery({ queryKey: ["wishlist", sellerIds], queryFn: () => getSellerListingsByIds({ data: { ids: sellerIds } }), enabled: sellerIds.length > 0 });
  const sellerList = sellerIds.length ? wish.data ?? [] : [];
  return (
    <SiteShell>
      <PageTitle eyebrow={t("fav.eyebrow")} title={t("fav.title")} />
      {list.length >= 2 && <div className="mx-auto max-w-7xl px-6"><Link to="/compare" className="inline-block rounded-full border border-primary px-4 py-1.5 text-sm text-primary">{(locale === "ar" ? "قارن مفضلاتك جنبًا إلى جنب" : "Compare your favorites side by side")}</Link></div>}
      <div className="mx-auto max-w-7xl px-6">
        {sellerIds.length > 0 && (
          <section aria-labelledby="wish-h" className="mb-12">
            <h2 id="wish-h" className="font-display text-2xl">{ar ? "من متاجر البائعين" : "From seller shops"}</h2>
            {wish.isLoading ? <p className="mt-3 text-muted-foreground">{ar ? "جارٍ التحميل…" : "Loading…"}</p>
              : sellerList.length === 0 ? <p className="mt-3 text-muted-foreground">{ar ? "لم تعد الأعمال المحفوظة معروضة." : "The works you saved are no longer on sale."}</p>
              : <div className="mt-4 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">{sellerList.map((s) => (
                <div key={s.id} className="group relative">
                  <Link to="/listing/$id" params={{ id: s.id }} className="block">
                    {s.imageUrl ? <img src={s.imageUrl} alt={ar ? s.altTextAr : s.altText} className="aspect-[4/5] w-full rounded-xl object-cover" loading="lazy" /> : <div className="aspect-[4/5] w-full rounded-xl bg-muted" />}
                    <p className="mt-3 font-display text-lg">{ar ? s.titleAr : s.title}</p>
                    <p className="text-sm text-muted-foreground">{s.medium} · ${s.price.toLocaleString()}</p>
                  </Link>
                  <button type="button" onClick={() => actions.toggleFavorite(s.id)} aria-label={ar ? "إزالة من قائمة الأمنيات" : "Remove from wishlist"}
                    className="absolute end-3 top-3 rounded-full bg-background/90 p-2 text-primary"><Heart aria-hidden className="h-4 w-4 fill-current" /></button>
                </div>))}</div>}
          </section>
        )}
        {list.length === 0 && sellerIds.length > 0 ? null : list.length === 0 ? (
          <p className="text-muted-foreground">{t("fav.empty")} <Link to="/explore" className="underline">{t("nav.explore")}</Link></p>
        ) : <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">{list.map((a) => <ArtCard key={a.id} a={a} />)}</div>}
      </div>
    </SiteShell>
  );
}
