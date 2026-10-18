import { createFileRoute, Link } from "@tanstack/react-router";
import { useLocale } from "@/lib/i18n";
import { SiteShell, ArtCard, PageTitle } from "@/components/SiteShell";
import { useListings, useStore } from "@/lib/store";

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
  const { t } = useLocale();
  const list = useListings().filter((l) => favorites.includes(l.id));
  return (
    <SiteShell>
      <PageTitle eyebrow={t("fav.eyebrow")} title={t("fav.title")} />
      {list.length >= 2 && <div className="mx-auto max-w-7xl px-6"><Link to="/compare" className="inline-block rounded-full border border-primary px-4 py-1.5 text-sm text-primary">{t("fav.eyebrow") && (useLocaleAr() ? "قارن مفضلاتك جنبًا إلى جنب" : "Compare your favorites side by side")}</Link></div>}
      <div className="mx-auto max-w-7xl px-6">
        {list.length === 0 ? (
          <p className="text-muted-foreground">{t("fav.empty")} <Link to="/explore" className="underline">{t("nav.explore")}</Link></p>
        ) : <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">{list.map((a) => <ArtCard key={a.id} a={a} />)}</div>}
      </div>
    </SiteShell>
  );
}
